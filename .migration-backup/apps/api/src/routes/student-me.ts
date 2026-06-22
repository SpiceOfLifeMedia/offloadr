/**
 * Stage 2.1.5 / 2.1.5b — managed-student-account upload routes.
 *
 * Mounted at `/student/me/*` and gated behind STUDENT_ACCOUNTS_ENABLED
 * (same env flag that gates `/student/auth/*` in routes/index.ts).
 *
 * Two-phase model:
 *   POST /student/me/projects/:id/upload  → files saved as DRAFT
 *   GET  /student/me/projects/:id         → list drafts + status
 *   DELETE /student/me/projects/:id/files/:fileId → remove a draft
 *   POST /student/me/projects/:id/offload → "Offload Project" handoff
 *
 * The legacy `/student-upload/codes/*` flow is UNTOUCHED — it keeps
 * firing a per-file email and stays as a fallback for Quick Upload Mode.
 */

import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import crypto from "node:crypto";
import {
  db,
  mediaFilesTable,
  projectsTable,
  organizationsTable,
  classesTable,
  classMembershipsTable,
  projectClassAccessTable,
  projectStudentAccessTable,
  studentAccountsTable,
  studentProjectSubmissionsTable,
  usersTable,
  timelinesTable,
  renderJobsTable,
} from "@workspace/db";
import { and, eq, isNull, sql, desc } from "drizzle-orm";
import { z } from "zod";
import { requireStudent, getStudent } from "../lib/student-auth";
import { detectFileType } from "../lib/storage";
import { getStorageDriver } from "../lib/storage/index";
import { sendUploadNotification } from "../lib/uploadNotifier";
import { logActivityRich } from "../lib/activity";

const router: IRouter = Router();

const TMP_UPLOAD_DIR = path.join(os.tmpdir(), "offloadr-student-me-uploads");
fs.mkdirSync(TMP_UPLOAD_DIR, { recursive: true });

const studentUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, TMP_UPLOAD_DIR),
    filename: (_req, _file, cb) =>
      cb(null, `${Date.now()}_${Math.random().toString(36).slice(2)}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 * 1024 },
});

const API_MOUNT_PATH = process.env["API_MOUNT_PATH"] ?? "/api";

// ---------------------------------------------------------------------
// Helpers

/**
 * A project is "locked" for a given student if they have at least one
 * student_project_submissions row with reopened_at IS NULL. The student
 * cannot add or delete draft files until a teacher reopens the project.
 */
async function isProjectLockedForStudent(
  studentAccountId: number,
  projectId: number,
  organizationId: number,
): Promise<boolean> {
  const [row] = await db
    .select({ id: studentProjectSubmissionsTable.id })
    .from(studentProjectSubmissionsTable)
    .where(
      and(
        eq(studentProjectSubmissionsTable.studentAccountId, studentAccountId),
        eq(studentProjectSubmissionsTable.projectId, projectId),
        eq(studentProjectSubmissionsTable.organizationId, organizationId),
        isNull(studentProjectSubmissionsTable.reopenedAt),
      ),
    )
    .limit(1);
  return Boolean(row);
}

interface ProjectAccess {
  projectId: number;
  projectName: string;
  projectStatus: string;
  organizationName: string;
  teacherName: string | null;
  dueDate: string | null;
}

/**
 * Tenant-safe access check. Tries two paths in priority order:
 *
 *   1. Class-based  — student is an active member of a class that has
 *      can_upload = true on this project (the original pathway).
 *   2. Direct       — student has a project_student_access row with
 *      can_upload = true (one-off individual grants, e.g. a student
 *      who needs access to a project their class isn't assigned to).
 *
 * The class path is tried first; if it matches we skip the second query.
 * Both paths enforce org-scoping — a student in org A can never reach
 * a project in org B.
 */
async function getProjectAccess(
  studentAccountId: number,
  organizationId: number,
  projectId: number,
): Promise<ProjectAccess | null> {
  // ── Path 1: class-based access ─────────────────────────────────────
  const [classRow] = await db
    .select({
      projectId: projectsTable.id,
      projectName: projectsTable.projectName,
      projectStatus: projectsTable.status,
      organizationName: organizationsTable.name,
      teacherName: usersTable.name,
      dueDate: projectsTable.dueDate,
    })
    .from(projectsTable)
    .innerJoin(
      organizationsTable,
      eq(organizationsTable.id, projectsTable.organizationId),
    )
    .innerJoin(usersTable, eq(usersTable.id, projectsTable.userId))
    .innerJoin(
      projectClassAccessTable,
      and(
        eq(projectClassAccessTable.projectId, projectsTable.id),
        eq(
          projectClassAccessTable.organizationId,
          projectsTable.organizationId,
        ),
        eq(projectClassAccessTable.canUpload, true),
      ),
    )
    .innerJoin(
      classMembershipsTable,
      and(
        eq(classMembershipsTable.classId, projectClassAccessTable.classId),
        eq(
          classMembershipsTable.organizationId,
          projectClassAccessTable.organizationId,
        ),
        eq(classMembershipsTable.studentAccountId, studentAccountId),
        isNull(classMembershipsTable.removedAt),
      ),
    )
    .where(
      and(
        eq(projectsTable.id, projectId),
        eq(projectsTable.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (classRow) return classRow;

  // ── Path 2: direct per-student access ──────────────────────────────
  const [directRow] = await db
    .select({
      projectId: projectsTable.id,
      projectName: projectsTable.projectName,
      projectStatus: projectsTable.status,
      organizationName: organizationsTable.name,
      teacherName: usersTable.name,
      dueDate: projectsTable.dueDate,
    })
    .from(projectsTable)
    .innerJoin(
      organizationsTable,
      eq(organizationsTable.id, projectsTable.organizationId),
    )
    .innerJoin(usersTable, eq(usersTable.id, projectsTable.userId))
    .innerJoin(
      projectStudentAccessTable,
      and(
        eq(projectStudentAccessTable.projectId, projectsTable.id),
        eq(
          projectStudentAccessTable.organizationId,
          projectsTable.organizationId,
        ),
        eq(projectStudentAccessTable.studentAccountId, studentAccountId),
        eq(projectStudentAccessTable.canUpload, true),
      ),
    )
    .where(
      and(
        eq(projectsTable.id, projectId),
        eq(projectsTable.organizationId, organizationId),
      ),
    )
    .limit(1);
  return directRow ?? null;
}

// ---------------------------------------------------------------------
// GET /student/me/upload-targets — list of accessible projects (My Media
// Projects landing page). Includes draft file count + lock state so the
// UI can badge each card.

router.get(
  "/student/me/upload-targets",
  requireStudent,
  async (req: Request, res: Response): Promise<void> => {
    const ctx = getStudent(req);
    if (!ctx) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // ── Path 1: class-based access ─────────────────────────────────────
    // student → active class_membership → project_class_access (can_upload)
    // → project. Filters out soft-removed memberships.
    const classRows = await db
      .selectDistinct({
        projectId: projectsTable.id,
        projectName: projectsTable.projectName,
        accessMode: projectsTable.accessMode,
        organizationName: organizationsTable.name,
        teacherName: usersTable.name,
        dueDate: projectsTable.dueDate,
      })
      .from(classMembershipsTable)
      .innerJoin(
        classesTable,
        and(
          eq(classesTable.id, classMembershipsTable.classId),
          eq(classesTable.organizationId, classMembershipsTable.organizationId),
        ),
      )
      .innerJoin(
        projectClassAccessTable,
        and(
          eq(projectClassAccessTable.classId, classesTable.id),
          eq(
            projectClassAccessTable.organizationId,
            classesTable.organizationId,
          ),
          eq(projectClassAccessTable.canUpload, true),
        ),
      )
      .innerJoin(
        projectsTable,
        and(
          eq(projectsTable.id, projectClassAccessTable.projectId),
          eq(
            projectsTable.organizationId,
            projectClassAccessTable.organizationId,
          ),
        ),
      )
      .innerJoin(
        organizationsTable,
        eq(organizationsTable.id, projectsTable.organizationId),
      )
      .innerJoin(usersTable, eq(usersTable.id, projectsTable.userId))
      .where(
        and(
          eq(classMembershipsTable.studentAccountId, ctx.studentAccountId),
          eq(classMembershipsTable.organizationId, ctx.organizationId),
          isNull(classMembershipsTable.removedAt),
        ),
      );

    // ── Path 2: direct per-student access ──────────────────────────────
    // project_student_access (can_upload) → project. Used for individual
    // grants where a student needs access to a project their class isn't
    // assigned to (e.g. extension work, catch-up submissions).
    const directRows = await db
      .selectDistinct({
        projectId: projectsTable.id,
        projectName: projectsTable.projectName,
        accessMode: projectsTable.accessMode,
        organizationName: organizationsTable.name,
        teacherName: usersTable.name,
        dueDate: projectsTable.dueDate,
      })
      .from(projectStudentAccessTable)
      .innerJoin(
        projectsTable,
        and(
          eq(projectsTable.id, projectStudentAccessTable.projectId),
          eq(
            projectsTable.organizationId,
            projectStudentAccessTable.organizationId,
          ),
        ),
      )
      .innerJoin(
        organizationsTable,
        eq(organizationsTable.id, projectsTable.organizationId),
      )
      .innerJoin(usersTable, eq(usersTable.id, projectsTable.userId))
      .where(
        and(
          eq(projectStudentAccessTable.studentAccountId, ctx.studentAccountId),
          eq(projectStudentAccessTable.organizationId, ctx.organizationId),
          eq(projectStudentAccessTable.canUpload, true),
        ),
      );

    // Merge: class rows first, then direct rows for projects not already
    // included. A student with both class and direct access to the same
    // project only sees it once (class row wins, direct row is dropped).
    const seenIds = new Set(classRows.map((r) => r.projectId));
    const rows = [
      ...classRows,
      ...directRows.filter((r) => !seenIds.has(r.projectId)),
    ];

    // Decorate each project with a draft file count + lock state.
    const decorated = await Promise.all(
      rows.map(async (r) => {
        const [counts] = await db
          .select({
            draftCount: sql<number>`COUNT(*) FILTER (WHERE ${mediaFilesTable.submittedAt} IS NULL)`,
            submittedCount: sql<number>`COUNT(*) FILTER (WHERE ${mediaFilesTable.submittedAt} IS NOT NULL)`,
          })
          .from(mediaFilesTable)
          .where(
            and(
              eq(mediaFilesTable.projectId, r.projectId),
              eq(
                mediaFilesTable.uploaderStudentAccountId,
                ctx.studentAccountId,
              ),
            ),
          );
        const locked = await isProjectLockedForStudent(
          ctx.studentAccountId,
          r.projectId,
          ctx.organizationId,
        );
        return {
          ...r,
          draftCount: Number(counts?.draftCount ?? 0),
          submittedCount: Number(counts?.submittedCount ?? 0),
          locked,
        };
      }),
    );

    res.json({ projects: decorated });
  },
);

// ---------------------------------------------------------------------
// GET /student/me/projects/:projectId — project detail for the student:
// list their own draft files + lock state. Tenant-scoped + permission-
// checked.

router.get(
  "/student/me/projects/:projectId",
  requireStudent,
  async (req: Request, res: Response): Promise<void> => {
    const ctx = getStudent(req);
    if (!ctx) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const projectId = Number(req.params["projectId"]);
    if (!Number.isInteger(projectId) || projectId <= 0) {
      res.status(400).json({ error: "Bad Request", message: "Invalid projectId" });
      return;
    }
    const access = await getProjectAccess(
      ctx.studentAccountId,
      ctx.organizationId,
      projectId,
    );
    if (!access) {
      res.status(404).json({ error: "Not Found" });
      return;
    }

    const files = await db
      .select({
        id: mediaFilesTable.id,
        originalFileName: mediaFilesTable.originalFileName,
        fileSize: mediaFilesTable.fileSize,
        uploadedAt: mediaFilesTable.uploadedAt,
        submittedAt: mediaFilesTable.submittedAt,
        submissionId: mediaFilesTable.submissionId,
      })
      .from(mediaFilesTable)
      .where(
        and(
          eq(mediaFilesTable.projectId, projectId),
          eq(mediaFilesTable.uploaderStudentAccountId, ctx.studentAccountId),
        ),
      );

    const locked = await isProjectLockedForStudent(
      ctx.studentAccountId,
      projectId,
      ctx.organizationId,
    );

    res.json({
      project: {
        projectId: access.projectId,
        projectName: access.projectName,
        organizationName: access.organizationName,
        teacherName: access.teacherName,
        dueDate: access.dueDate,
      },
      locked,
      draftFiles: files.filter((f) => f.submittedAt == null),
      submittedFiles: files.filter((f) => f.submittedAt != null),
    });
  },
);

// ---------------------------------------------------------------------
// POST /student/me/projects/:projectId/upload-url — issues a short-lived
// presigned S3/R2 PUT URL so the browser can upload DIRECTLY to object
// storage without any data transiting the API server or Vercel proxy.
//
// Flow:
//   1. Client POSTs { originalFileName, contentType, fileSize } here.
//   2. Server validates access, generates a storage key, and returns
//      { uploadUrl, storageKey, expiresAt }.
//   3. Client PUTs the file body directly to uploadUrl (XHR to R2).
//   4. Client calls /confirm-upload to create the DB record.
//
// Falls back gracefully when the storage driver can't issue presigned
// URLs (e.g. local filesystem dev driver) — returns { uploadUrl: null }
// so the client can fall back to the legacy multipart path.

const UPLOAD_URL_TTL_SECONDS = 15 * 60; // 15 minutes

router.post(
  "/student/me/projects/:projectId/upload-url",
  requireStudent,
  async (req: Request, res: Response): Promise<void> => {
    const ctx = getStudent(req);
    if (!ctx) { res.status(401).json({ error: "Unauthorized" }); return; }

    const projectId = Number(req.params["projectId"]);
    if (!Number.isInteger(projectId) || projectId <= 0) {
      res.status(400).json({ error: "Bad Request", message: "Invalid projectId" });
      return;
    }

    const { originalFileName, contentType, fileSize } = req.body as {
      originalFileName?: unknown;
      contentType?: unknown;
      fileSize?: unknown;
    };
    if (typeof originalFileName !== "string" || originalFileName.trim().length === 0) {
      res.status(400).json({ error: "Bad Request", message: "originalFileName is required" });
      return;
    }
    if (typeof contentType !== "string" || contentType.trim().length === 0) {
      res.status(400).json({ error: "Bad Request", message: "contentType is required" });
      return;
    }
    if (typeof fileSize !== "number" || fileSize <= 0) {
      res.status(400).json({ error: "Bad Request", message: "fileSize must be a positive number" });
      return;
    }

    const access = await getProjectAccess(ctx.studentAccountId, ctx.organizationId, projectId);
    if (!access) {
      res.status(404).json({ error: "Not Found", message: "Project not available for this account." });
      return;
    }
    if (await isProjectLockedForStudent(ctx.studentAccountId, projectId, ctx.organizationId)) {
      res.status(409).json({
        error: "Conflict",
        message: "This project has already been offloaded. Ask your teacher to reopen it.",
      });
      return;
    }

    const timestamp = Date.now();
    const ext = path.extname(originalFileName);
    const base = path
      .basename(originalFileName, ext)
      .replace(/[^a-zA-Z0-9_-]/g, "_");
    const nonce = crypto.randomBytes(6).toString("hex");
    const storageKey = `offloadr/projects/${projectId}/${timestamp}_studentacct_${ctx.studentAccountId}_${nonce}_${base}${ext}`;

    req.log.info(
      { projectId, studentAccountId: ctx.studentAccountId, originalFileName, fileSize, storageKey },
      "upload:url_issuing",
    );

    let uploadUrl: string | null;
    try {
      const driver = getStorageDriver();
      uploadUrl = await driver.getSignedUploadUrl(storageKey, contentType.trim(), UPLOAD_URL_TTL_SECONDS);
    } catch (err) {
      req.log.error({ err, projectId, storageKey }, "upload:url_sign_error — getSignedUploadUrl threw");
      res.status(500).json({
        error: "Internal Server Error",
        message: `Failed to generate upload URL: ${err instanceof Error ? err.message : String(err)}`,
      });
      return;
    }

    if (!uploadUrl) {
      // Driver (e.g. local fs) can't issue presigned URLs. Client falls back.
      req.log.warn({ projectId, storageKey }, "upload:url_unavailable — driver does not support presigned PUTs");
      res.json({ uploadUrl: null, storageKey: null, expiresAt: null });
      return;
    }

    const expiresAt = new Date(Date.now() + UPLOAD_URL_TTL_SECONDS * 1000).toISOString();
    req.log.info({ projectId, storageKey, expiresAt }, "upload:url_issued");

    res.json({ uploadUrl, storageKey, expiresAt });
  },
);

// ---------------------------------------------------------------------
// POST /student/me/projects/:projectId/confirm-upload — called by the
// browser AFTER a successful direct PUT to R2. Verifies the object
// landed in storage (HeadObject), creates the draft media_files record,
// and logs the activity.
//
// Security:
//   • Same access + lock checks as the upload-url endpoint.
//   • storageKey is verified to start with the canonical prefix for
//     this project — prevents a student from claiming an arbitrary R2
//     object (from another project or org) as their own upload.
//   • driver.exists() calls HeadObject — confirms the object is actually
//     in the bucket before the DB record is created. A student who forges
//     a storageKey for a non-existent object gets a 422.

router.post(
  "/student/me/projects/:projectId/confirm-upload",
  requireStudent,
  async (req: Request, res: Response): Promise<void> => {
    const ctx = getStudent(req);
    if (!ctx) { res.status(401).json({ error: "Unauthorized" }); return; }

    const projectId = Number(req.params["projectId"]);
    if (!Number.isInteger(projectId) || projectId <= 0) {
      res.status(400).json({ error: "Bad Request", message: "Invalid projectId" });
      return;
    }

    const { storageKey, originalFileName, contentType, fileSize } = req.body as {
      storageKey?: unknown;
      originalFileName?: unknown;
      contentType?: unknown;
      fileSize?: unknown;
    };
    if (typeof storageKey !== "string" || storageKey.trim().length === 0) {
      res.status(400).json({ error: "Bad Request", message: "storageKey is required" });
      return;
    }
    if (typeof originalFileName !== "string" || originalFileName.trim().length === 0) {
      res.status(400).json({ error: "Bad Request", message: "originalFileName is required" });
      return;
    }
    if (typeof contentType !== "string" || contentType.trim().length === 0) {
      res.status(400).json({ error: "Bad Request", message: "contentType is required" });
      return;
    }
    if (typeof fileSize !== "number" || fileSize <= 0) {
      res.status(400).json({ error: "Bad Request", message: "fileSize must be a positive number" });
      return;
    }

    // Enforce that the storageKey belongs to THIS project. Prevents a student
    // from registering an object from another project as their own upload.
    const expectedPrefix = `offloadr/projects/${projectId}/`;
    if (!storageKey.startsWith(expectedPrefix)) {
      req.log.warn(
        { storageKey, expectedPrefix, studentAccountId: ctx.studentAccountId },
        "upload:confirm_key_mismatch — storageKey does not match project",
      );
      res.status(403).json({ error: "Forbidden", message: "Storage key does not belong to this project." });
      return;
    }

    const access = await getProjectAccess(ctx.studentAccountId, ctx.organizationId, projectId);
    if (!access) {
      res.status(404).json({ error: "Not Found", message: "Project not available for this account." });
      return;
    }
    if (await isProjectLockedForStudent(ctx.studentAccountId, projectId, ctx.organizationId)) {
      res.status(409).json({
        error: "Conflict",
        message: "This project has already been offloaded. Ask your teacher to reopen it.",
      });
      return;
    }

    req.log.info(
      { projectId, storageKey, originalFileName, fileSize, studentAccountId: ctx.studentAccountId },
      "upload:confirming",
    );

    // Verify the object actually landed in R2. HeadObject is cheap and
    // provides certainty — if this returns false the PUT either failed
    // silently or the key was fabricated.
    let objectExists: boolean;
    try {
      const driver = getStorageDriver();
      objectExists = await driver.exists(storageKey);
    } catch (err) {
      req.log.error({ err, storageKey, projectId }, "upload:confirm_head_error — exists() threw");
      res.status(500).json({
        error: "Internal Server Error",
        message: `Storage check failed: ${err instanceof Error ? err.message : String(err)}`,
      });
      return;
    }
    if (!objectExists) {
      req.log.warn({ storageKey, projectId }, "upload:confirm_object_missing — HeadObject returned 404");
      res.status(422).json({
        error: "Unprocessable Entity",
        message: "Upload not found in storage. The file may not have completed uploading — try again.",
      });
      return;
    }

    let student: { displayName: string } | undefined;
    try {
      [student] = await db
        .select({ displayName: studentAccountsTable.displayName })
        .from(studentAccountsTable)
        .where(
          and(
            eq(studentAccountsTable.id, ctx.studentAccountId),
            eq(studentAccountsTable.organizationId, ctx.organizationId),
          ),
        )
        .limit(1);
    } catch (err) {
      req.log.error({ err, projectId }, "upload:confirm_student_query_error");
      res.status(500).json({
        error: "Internal Server Error",
        message: `Database query failed: ${err instanceof Error ? err.message : String(err)}`,
      });
      return;
    }
    const studentName = student?.displayName ?? `student#${ctx.studentAccountId}`;

    let file: typeof mediaFilesTable.$inferSelect | undefined;
    try {
      const result = await db.execute(sql`
        INSERT INTO media_files (
          project_id, original_file_name, clean_file_name, file_type, media_role,
          file_size, upload_status, storage_path, public_url, notes, uploaded_at,
          uploader_kind, student_uploader_name, uploader_student_account_id,
          submitted_at, submission_id
        ) VALUES (
          ${projectId}, ${originalFileName.trim()}, NULL, ${detectFileType(contentType)}, NULL,
          ${fileSize}, 'uploaded', ${storageKey}, NULL, NULL, ${new Date().toISOString().replace('Z', '')},
          'student', ${studentName}, ${ctx.studentAccountId},
          NULL, NULL
        )
        RETURNING *
      `);
      file = result.rows?.[0] as typeof mediaFilesTable.$inferSelect | undefined;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const errorStack = err instanceof Error ? err.stack : '';
      req.log.error({ errorMsg, errorStack, projectId, storageKey }, "upload:confirm_insert_error — DB insert threw");
      res.status(500).json({
        error: "Internal Server Error",
        message: `Failed to record file in database: ${err instanceof Error ? err.message : String(err)}`,
      });
      return;
    }

    if (!file) {
      res.status(500).json({ error: "Internal Server Error", message: "Failed to record file" });
      return;
    }

    try {
      await db
        .update(mediaFilesTable)
        .set({ publicUrl: `${API_MOUNT_PATH}/files/${file.id}/download` })
        .where(eq(mediaFilesTable.id, file.id));
    } catch (err) {
      req.log.warn({ err, fileId: file.id }, "upload:confirm_publicurl_update_error — non-fatal");
      // Non-fatal: file is recorded, just publicUrl not set yet
    }

    req.log.info(
      { fileId: file.id, projectId, storageKey, studentAccountId: ctx.studentAccountId },
      "upload:draft_created",
    );

    await logActivityRich({
      action: "student_draft_uploaded",
      message: `Student "${studentName}" added "${originalFileName.trim()}" to draft (direct upload)`,
      actorKind: "student_account",
      projectId,
      organizationId: ctx.organizationId,
      actorStudentAccountId: ctx.studentAccountId,
    });

    res.status(201).json({
      ok: true,
      fileId: file.id,
      originalFileName: file.originalFileName,
      submittedAt: null,
    });
  },
);

// ---------------------------------------------------------------------
// POST /student/me/projects/:projectId/upload — adds ONE file to the
// student's DRAFT for this project. Rejected if the project is locked
// for this student (an unopened submission exists).

router.post(
  "/student/me/projects/:projectId/upload",
  requireStudent,
  (req, res, next) => {
    studentUpload.single("file")(req, res, (err: unknown) => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          res
            .status(413)
            .json({ error: "Payload Too Large", message: "File too large." });
          return;
        }
        res.status(400).json({ error: "Bad Request", message: err.code });
        return;
      }
      next(err);
    });
  },
  async (req: Request, res: Response): Promise<void> => {
    const ctx = getStudent(req);
    if (!ctx) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const cleanupTmp = (): void => {
      if (req.file?.path) {
        fs.promises.unlink(req.file.path).catch(() => undefined);
      }
    };
    const projectId = Number(req.params["projectId"]);
    if (!Number.isInteger(projectId) || projectId <= 0) {
      cleanupTmp();
      res.status(400).json({ error: "Bad Request", message: "Invalid projectId" });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: "Bad Request", message: "No file uploaded" });
      return;
    }

    const access = await getProjectAccess(
      ctx.studentAccountId,
      ctx.organizationId,
      projectId,
    );
    if (!access) {
      cleanupTmp();
      res.status(404).json({
        error: "Not Found",
        message: "Project not available for this account.",
      });
      return;
    }

    if (
      await isProjectLockedForStudent(
        ctx.studentAccountId,
        projectId,
        ctx.organizationId,
      )
    ) {
      cleanupTmp();
      res.status(409).json({
        error: "Conflict",
        message:
          "This project has already been offloaded. Ask your teacher to reopen it before adding more files.",
      });
      return;
    }

    const [student] = await db
      .select({ displayName: studentAccountsTable.displayName })
      .from(studentAccountsTable)
      .where(
        and(
          eq(studentAccountsTable.id, ctx.studentAccountId),
          eq(studentAccountsTable.organizationId, ctx.organizationId),
        ),
      )
      .limit(1);
    const studentName =
      student?.displayName ?? `student#${ctx.studentAccountId}`;

    const timestamp = Date.now();
    const ext = path.extname(req.file.originalname);
    const base = path
      .basename(req.file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, "_");
    const storageKey = `offloadr/projects/${projectId}/${timestamp}_studentacct_${ctx.studentAccountId}_${base}${ext}`;

    try {
      await getStorageDriver().upload(
        storageKey,
        fs.createReadStream(req.file.path),
        req.file.mimetype,
      );
    } catch (err) {
      req.log.error(
        { err, storageKey, studentAccountId: ctx.studentAccountId },
        "Failed to upload student-account file to object storage",
      );
      cleanupTmp();
      res
        .status(500)
        .json({ error: "Internal Server Error", message: "Failed to store file" });
      return;
    } finally {
      cleanupTmp();
    }

    // Insert as DRAFT (submitted_at NULL, submission_id NULL).
    // Use raw SQL to bypass Drizzle's z.coerce.date() on timestamp columns,
    // which converts null → new Date("") → empty string, rejected by PostgreSQL.
    let insertResult: Awaited<ReturnType<typeof db.execute>>;
    try {
      insertResult = await db.execute(sql`
        INSERT INTO media_files (
          project_id, original_file_name, clean_file_name, file_type, media_role,
          file_size, upload_status, storage_path, public_url, notes, uploaded_at,
          uploader_kind, student_uploader_name, uploader_student_account_id,
          submitted_at, submission_id
        ) VALUES (
          ${projectId}, ${req.file.originalname}, NULL, ${detectFileType(req.file.mimetype)}, NULL,
          ${req.file.size}, 'uploaded', ${storageKey}, NULL, NULL, ${new Date().toISOString().replace('Z', '')},
          'student', ${studentName}, ${ctx.studentAccountId},
          NULL, NULL
        )
        RETURNING *
      `);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const errorStack = err instanceof Error ? err.stack : '';
      req.log.error({ errorMsg, errorStack, projectId, storageKey }, "upload:confirm_insert_error — DB insert threw");
      res.status(500).json({
        error: "Internal Server Error",
        message: `Failed to record file in database: ${err instanceof Error ? err.message : String(err)}`,
      });
      return;
    }
    const file = insertResult.rows?.[0] as typeof mediaFilesTable.$inferSelect | undefined;

    if (!file) {
      res
        .status(500)
        .json({ error: "Internal Server Error", message: "Failed to record file" });
      return;
    }

    await db
      .update(mediaFilesTable)
      .set({ publicUrl: `${API_MOUNT_PATH}/files/${file.id}/download` })
      .where(eq(mediaFilesTable.id, file.id));

    // NOTE: deliberately NO sendUploadNotification here — drafts must
    // not email the teacher. The notification fires once on
    // POST /offload below.
    await logActivityRich({
      action: "student_draft_uploaded",
      message: `Student "${studentName}" added "${req.file.originalname}" to draft (managed pipeline)`,
      actorKind: "student_account",
      projectId,
      organizationId: ctx.organizationId,
      actorStudentAccountId: ctx.studentAccountId,
    });

    res.status(201).json({
      ok: true,
      fileId: file.id,
      originalFileName: file.originalFileName,
      submittedAt: null,
    });
  },
);

// ---------------------------------------------------------------------
// DELETE /student/me/projects/:projectId/files/:fileId — remove a draft
// file. Only the owning student, only while the file is still draft
// and the project is not locked. Submitted files cannot be deleted by
// the student.

router.delete(
  "/student/me/projects/:projectId/files/:fileId",
  requireStudent,
  async (req: Request, res: Response): Promise<void> => {
    const ctx = getStudent(req);
    if (!ctx) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const projectId = Number(req.params["projectId"]);
    const fileId = Number(req.params["fileId"]);
    if (
      !Number.isInteger(projectId) ||
      projectId <= 0 ||
      !Number.isInteger(fileId) ||
      fileId <= 0
    ) {
      res.status(400).json({ error: "Bad Request" });
      return;
    }

    const access = await getProjectAccess(
      ctx.studentAccountId,
      ctx.organizationId,
      projectId,
    );
    if (!access) {
      res.status(404).json({ error: "Not Found" });
      return;
    }

    if (
      await isProjectLockedForStudent(
        ctx.studentAccountId,
        projectId,
        ctx.organizationId,
      )
    ) {
      res.status(409).json({
        error: "Conflict",
        message:
          "Project is already offloaded; drafts can no longer be edited.",
      });
      return;
    }

    const [file] = await db
      .select({
        id: mediaFilesTable.id,
        storagePath: mediaFilesTable.storagePath,
        submittedAt: mediaFilesTable.submittedAt,
        uploaderStudentAccountId: mediaFilesTable.uploaderStudentAccountId,
      })
      .from(mediaFilesTable)
      .where(
        and(
          eq(mediaFilesTable.id, fileId),
          eq(mediaFilesTable.projectId, projectId),
        ),
      )
      .limit(1);
    if (
      !file ||
      file.uploaderStudentAccountId !== ctx.studentAccountId ||
      file.submittedAt != null
    ) {
      // Don't disclose whether the file exists if it isn't this
      // student's draft.
      res.status(404).json({ error: "Not Found" });
      return;
    }

    // Best-effort: remove from object storage. If it fails, log but
    // still delete the DB row so the user isn't stuck.
    if (file.storagePath) {
      try {
        await getStorageDriver().delete(file.storagePath);
      } catch (err) {
        req.log.warn(
          { err, fileId, storagePath: file.storagePath },
          "Failed to delete draft file from object storage; removing DB row anyway.",
        );
      }
    }

    await db.delete(mediaFilesTable).where(eq(mediaFilesTable.id, fileId));

    res.json({ ok: true });
  },
);

// ---------------------------------------------------------------------
// POST /student/me/projects/:projectId/offload — the "Offload Project"
// button. Atomically:
//   1. Verify access + not-already-locked
//   2. Gather all draft files for (student, project)
//   3. Generate a submission_id, stamp every draft with it
//   4. Insert student_project_submissions row (this is the lock)
//   5. Fire ONE batched email
//   6. Structured audit log line (Stage 3 will move to a DB audit table)

// ---------------------------------------------------------------------
// Shared offload helper. Used by both POST /offload (raw fallback) and
// POST /timelines/:id/finalize (First Cut path). Single transaction;
// returns a discriminated result rather than touching `res` so both
// callers can render their own response shapes.
// ---------------------------------------------------------------------
type OffloadOk = {
  ok: true;
  submissionId: string;
  fileCount: number;
  submittedAt: Date;
  totalBytes: number;
};
type OffloadErr = { ok: false; status: number; message: string };
type OffloadResult = OffloadOk | OffloadErr;

// ---------------------------------------------------------------------
// Duplicate-offload protection (in-process mutex).
//
// Students can rapid-click "Offload to Teacher" / "Send Raw Files" /
// "Finalize". The DB has no unique constraint on (student, project,
// unreopened-submission), so two concurrent requests can both pass
// `isProjectLockedForStudent` and end up writing two submission rows,
// sending two emails, and stamping submittedAt on the same files twice.
//
// This map de-duplicates concurrent calls per (student, project): the
// second caller awaits the first call's result and returns it as-is.
// Single-machine Fly deployment makes in-process locking sufficient
// for the pilot; if/when we scale horizontally this needs to be
// promoted to a DB-level guard (e.g. unique index on
// (student_account_id, project_id) WHERE reopened_at IS NULL).
// ---------------------------------------------------------------------
const inflightOffloads = new Map<string, Promise<OffloadResult>>();

async function performStudentOffload(
  ctx: { studentAccountId: number; organizationId: number },
  projectId: number,
  log: Request["log"],
): Promise<OffloadResult> {
  const key = `${ctx.studentAccountId}:${projectId}`;
  const existing = inflightOffloads.get(key);
  if (existing) {
    log.warn(
      {
        event: "offload.duplicate_prevented",
        studentAccountId: ctx.studentAccountId,
        projectId,
      },
      "[offload] duplicate finalize prevented — returning in-flight result",
    );
    return existing;
  }
  const promise = performStudentOffloadInner(ctx, projectId, log).finally(() => {
    inflightOffloads.delete(key);
  });
  inflightOffloads.set(key, promise);
  return promise;
}

async function performStudentOffloadInner(
  ctx: { studentAccountId: number; organizationId: number },
  projectId: number,
  log: Request["log"],
): Promise<OffloadResult> {
  const access = await getProjectAccess(
    ctx.studentAccountId,
    ctx.organizationId,
    projectId,
  );
  if (!access) return { ok: false, status: 404, message: "Not Found" };
  if (
    await isProjectLockedForStudent(
      ctx.studentAccountId,
      projectId,
      ctx.organizationId,
    )
  ) {
    return {
      ok: false,
      status: 409,
      message: "This project has already been offloaded.",
    };
  }

  const [draftPing] = await db
    .select({ id: mediaFilesTable.id })
    .from(mediaFilesTable)
    .where(
      and(
        eq(mediaFilesTable.projectId, projectId),
        eq(mediaFilesTable.uploaderStudentAccountId, ctx.studentAccountId),
        isNull(mediaFilesTable.submittedAt),
      ),
    )
    .limit(1);
  if (!draftPing) {
    return {
      ok: false,
      status: 400,
      message:
        "Add at least one file before offloading the project to your teacher.",
    };
  }

  const [student] = await db
    .select({
      username: studentAccountsTable.username,
      displayName: studentAccountsTable.displayName,
    })
    .from(studentAccountsTable)
    .where(
      and(
        eq(studentAccountsTable.id, ctx.studentAccountId),
        eq(studentAccountsTable.organizationId, ctx.organizationId),
      ),
    )
    .limit(1);
  const studentName = student?.displayName ?? `student#${ctx.studentAccountId}`;
  const studentUsername =
    student?.username ?? `student#${ctx.studentAccountId}`;

  const submissionId = `sub_${crypto.randomBytes(12).toString("hex")}`;
  const submittedAt = new Date();
  let stampedFiles: Array<{
    id: number;
    originalFileName: string;
    fileSize: number | null;
  }> = [];

  try {
    await db.transaction(async (tx) => {
      await tx.insert(studentProjectSubmissionsTable).values({
        submissionId,
        studentAccountId: ctx.studentAccountId,
        projectId,
        organizationId: ctx.organizationId,
        fileCount: 0,
        totalBytes: 0,
        submittedAt,
      });

      stampedFiles = await tx
        .update(mediaFilesTable)
        .set({ submittedAt, submissionId })
        .where(
          and(
            eq(mediaFilesTable.projectId, projectId),
            eq(
              mediaFilesTable.uploaderStudentAccountId,
              ctx.studentAccountId,
            ),
            isNull(mediaFilesTable.submittedAt),
          ),
        )
        .returning({
          id: mediaFilesTable.id,
          originalFileName: mediaFilesTable.originalFileName,
          fileSize: mediaFilesTable.fileSize,
        });

      const totalBytes = stampedFiles.reduce(
        (acc, f) => acc + (f.fileSize ?? 0),
        0,
      );
      await tx
        .update(studentProjectSubmissionsTable)
        .set({ fileCount: stampedFiles.length, totalBytes })
        .where(eq(studentProjectSubmissionsTable.submissionId, submissionId));

      if (access.projectStatus === "draft") {
        await tx
          .update(projectsTable)
          .set({ status: "uploading", updatedAt: new Date() })
          .where(eq(projectsTable.id, projectId));
      }
    });
  } catch (err) {
    const code =
      typeof err === "object" && err && "code" in err
        ? (err as { code?: string }).code
        : undefined;
    if (code === "23505") {
      return {
        ok: false,
        status: 409,
        message: "This project has already been offloaded.",
      };
    }
    log.error(
      { err, projectId, studentAccountId: ctx.studentAccountId },
      "Offload transaction failed",
    );
    return {
      ok: false,
      status: 500,
      message: "Failed to offload project.",
    };
  }

  if (stampedFiles.length === 0) {
    return {
      ok: false,
      status: 409,
      message: "No draft files were available to offload.",
    };
  }

  await logActivityRich({
    action: "student_project_offloaded",
    message: `Student "${studentName}" offloaded ${stampedFiles.length} file${stampedFiles.length === 1 ? "" : "s"} (submission ${submissionId})`,
    actorKind: "student_account",
    projectId,
    organizationId: ctx.organizationId,
    actorStudentAccountId: ctx.studentAccountId,
  });

  const totalBytes = stampedFiles.reduce(
    (acc, f) => acc + (f.fileSize ?? 0),
    0,
  );

  log.info(
    {
      event: "student.offload.submitted",
      submissionId,
      studentAccountId: ctx.studentAccountId,
      studentUsername,
      organizationId: ctx.organizationId,
      organizationName: access.organizationName,
      projectId,
      projectName: access.projectName,
      fileCount: stampedFiles.length,
      totalBytes,
      submittedAt: submittedAt.toISOString(),
    },
    "Student offloaded project — submission locked, teacher notified.",
  );

  void sendUploadNotification({
    projectId,
    projectName: access.projectName,
    uploaderName: studentName,
    uploaderKind: "student",
    files: stampedFiles.map((d) => ({
      originalFileName: d.originalFileName,
      fileSizeBytes: d.fileSize ?? 0,
      fileId: d.id,
    })),
    uploadedAt: submittedAt,
  });

  return {
    ok: true,
    submissionId,
    fileCount: stampedFiles.length,
    submittedAt,
    totalBytes,
  };
}

router.post(
  "/student/me/projects/:projectId/offload",
  requireStudent,
  async (req: Request, res: Response): Promise<void> => {
    const ctx = getStudent(req);
    if (!ctx) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const projectId = Number(req.params["projectId"]);
    if (!Number.isInteger(projectId) || projectId <= 0) {
      res
        .status(400)
        .json({ error: "Bad Request", message: "Invalid projectId" });
      return;
    }
    const result = await performStudentOffload(ctx, projectId, req.log);
    if (!result.ok) {
      res.status(result.status).json({
        error:
          result.status === 404
            ? "Not Found"
            : result.status === 409
              ? "Conflict"
              : result.status === 400
                ? "Bad Request"
                : "Internal Server Error",
        message: result.message,
      });
      return;
    }
    res.json({
      ok: true,
      submissionId: result.submissionId,
      fileCount: result.fileCount,
      submittedAt: result.submittedAt.toISOString(),
    });
  },
);

// ---------------------------------------------------------------------
// (Below: the original /offload handler — now superseded by the helper
// above. Kept the structured fall-through for safety; this block is
// dead code reached only if the early `return` above is removed.)
// ---------------------------------------------------------------------

// ---------------------------------------------------------------------
// Stage 2.1.5c — Student First Cut + Timeline Review (DEV-only V1)
// ---------------------------------------------------------------------
//
// Flow:
//   1. Student finishes uploads on /s/:school/projects/:id
//   2. Student clicks "Prepare First Cut"
//      → POST /student/me/projects/:id/prepare-draft
//        creates a timelines row (studentAccountId = ctx.studentAccountId,
//        data = { clips, titleCardText }) seeded from current draft files,
//        returns { timelineId }
//   3. Client navigates to /student-projects/:id/draft-review
//      → GET  /student/me/timelines/:id          (read)
//      → PATCH /student/me/timelines/:id         (reorder, remove, title)
//   4. Student clicks "Offload to Teacher"
//      → POST /student/me/timelines/:id/finalize
//        records a stub render_job (provider='stub', status='complete'),
//        marks timeline.smartDraftGenerated = true,
//        logs activity. Client then calls existing /offload to lock
//        files + email the teacher.
//
// Force-stub policy: in DEV (NODE_ENV !== 'production') we never call
// Shotstack, even if SHOTSTACK_API_KEY is set. The render_job is created
// with provider='stub', status='complete' so the existing teacher-side
// surface can still see "a draft was prepared" without burning credits.
//
// All routes are student-scoped via requireStudent + an explicit
// ownership check (timelines.studentAccountId === ctx.studentAccountId).
// Reading or mutating another student's timeline returns 404.

const timelineClipSchema = z.object({
  fileId: z.number().int().positive(),
});

const timelineDataSchema = z.object({
  clips: z.array(timelineClipSchema).max(50),
  titleCardText: z.string().max(120).default(""),
});

type TimelineData = z.infer<typeof timelineDataSchema>;

const timelinePatchSchema = z.object({
  clips: z.array(timelineClipSchema).max(50).optional(),
  titleCardText: z.string().max(120).optional(),
});

function readTimelineData(raw: unknown): TimelineData {
  const parsed = timelineDataSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  // Be permissive on read so a malformed legacy row doesn't 500 the UI.
  return { clips: [], titleCardText: "" };
}

// POST /student/me/projects/:projectId/prepare-draft
// Creates a timeline owned by this student, seeded from their current
// draft files (in upload order). Idempotent: if the student already has
// an unfinalised timeline for this project, return it instead of
// creating a duplicate.
router.post(
  "/student/me/projects/:projectId/prepare-draft",
  requireStudent,
  async (req: Request, res: Response): Promise<void> => {
    const ctx = getStudent(req);
    if (!ctx) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const projectId = Number(req.params["projectId"]);
    if (!Number.isInteger(projectId) || projectId <= 0) {
      res
        .status(400)
        .json({ error: "Bad Request", message: "Invalid projectId" });
      return;
    }

    const access = await getProjectAccess(
      ctx.studentAccountId,
      ctx.organizationId,
      projectId,
    );
    if (!access) {
      res.status(404).json({ error: "Not Found" });
      return;
    }
    if (
      await isProjectLockedForStudent(
        ctx.studentAccountId,
        projectId,
        ctx.organizationId,
      )
    ) {
      res.status(409).json({
        error: "Conflict",
        message: "This project has already been offloaded.",
      });
      return;
    }

    const draftFiles = await db
      .select({
        id: mediaFilesTable.id,
        originalFileName: mediaFilesTable.originalFileName,
        uploadedAt: mediaFilesTable.uploadedAt,
      })
      .from(mediaFilesTable)
      .where(
        and(
          eq(mediaFilesTable.projectId, projectId),
          eq(mediaFilesTable.uploaderStudentAccountId, ctx.studentAccountId),
          isNull(mediaFilesTable.submittedAt),
        ),
      )
      .orderBy(mediaFilesTable.uploadedAt);

    if (draftFiles.length === 0) {
      res.status(400).json({
        error: "Bad Request",
        message: "Add at least one file before preparing a first cut.",
      });
      return;
    }

    // Idempotency: reuse the most recent unfinalised timeline for this
    // (student, project) instead of stacking duplicates if the student
    // double-clicks "Prepare First Cut". On reuse, MERGE any newly
    // uploaded files into the clip list (preserving existing order and
    // any user-removed clips) so re-clicking after adding a file
    // doesn't silently drop it from the cut.
    const [existing] = await db
      .select({ id: timelinesTable.id, data: timelinesTable.data })
      .from(timelinesTable)
      .where(
        and(
          eq(timelinesTable.projectId, projectId),
          eq(timelinesTable.studentAccountId, ctx.studentAccountId),
          eq(timelinesTable.smartDraftGenerated, false),
        ),
      )
      .orderBy(desc(timelinesTable.createdAt))
      .limit(1);

    if (existing) {
      const existingData = readTimelineData(existing.data);
      const existingIds = new Set(existingData.clips.map((c) => c.fileId));
      const draftIds = new Set(draftFiles.map((f) => f.id));
      // Keep existing clips that still point at a live draft file
      // (drops clips for files the student deleted in the meantime).
      const kept = existingData.clips.filter((c) => draftIds.has(c.fileId));
      // Append any newly-uploaded draft files at the end.
      const newOnes = draftFiles
        .filter((f) => !existingIds.has(f.id))
        .map((f) => ({ fileId: f.id }));
      const merged: TimelineData = {
        ...existingData,
        clips: [...kept, ...newOnes],
      };
      const added = newOnes.length;
      const removed = existingData.clips.length - kept.length;
      if (added > 0 || removed > 0) {
        await db
          .update(timelinesTable)
          .set({
            data: merged as unknown as Record<string, unknown>,
            updatedAt: new Date(),
          })
          .where(eq(timelinesTable.id, existing.id));
      }
      res.status(200).json({
        ok: true,
        timelineId: existing.id,
        reused: true,
        added,
        removed,
      });
      return;
    }

    const initial: TimelineData = {
      clips: draftFiles.map((f) => ({ fileId: f.id })),
      titleCardText: access.projectName,
    };

    const [created] = await db
      .insert(timelinesTable)
      .values({
        projectId,
        studentAccountId: ctx.studentAccountId,
        provider: "stub",
        smartDraftGenerated: false,
        data: initial as unknown as Record<string, unknown>,
      })
      .returning({ id: timelinesTable.id });

    await logActivityRich({
      action: "smart_draft_requested",
      message: `Student prepared first cut (timeline ${created!.id}, ${draftFiles.length} clip${draftFiles.length === 1 ? "" : "s"})`,
      actorKind: "student_account",
      projectId,
      organizationId: ctx.organizationId,
      actorStudentAccountId: ctx.studentAccountId,
    });

    res.status(201).json({ ok: true, timelineId: created!.id, reused: false });
  },
);

// GET /student/me/timelines/:timelineId
// Returns the timeline + denormalised clip metadata (filename, size,
// mime, upload order) so the review page can render without a second
// roundtrip per clip.
router.get(
  "/student/me/timelines/:timelineId",
  requireStudent,
  async (req: Request, res: Response): Promise<void> => {
    const ctx = getStudent(req);
    if (!ctx) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const timelineId = Number(req.params["timelineId"]);
    if (!Number.isInteger(timelineId) || timelineId <= 0) {
      res.status(400).json({ error: "Bad Request" });
      return;
    }

    const [row] = await db
      .select({
        id: timelinesTable.id,
        projectId: timelinesTable.projectId,
        data: timelinesTable.data,
        smartDraftGenerated: timelinesTable.smartDraftGenerated,
        studentAccountId: timelinesTable.studentAccountId,
      })
      .from(timelinesTable)
      .where(eq(timelinesTable.id, timelineId))
      .limit(1);

    if (!row || row.studentAccountId !== ctx.studentAccountId) {
      res.status(404).json({ error: "Not Found" });
      return;
    }

    const access = await getProjectAccess(
      ctx.studentAccountId,
      ctx.organizationId,
      row.projectId,
    );
    if (!access) {
      res.status(404).json({ error: "Not Found" });
      return;
    }

    const data = readTimelineData(row.data);

    // Hydrate clip metadata from media_files, then filter the clips
    // array to only files that still exist + still belong to this
    // student. A clip whose file was deleted between prepare-draft and
    // review just disappears from the list — no error, no 500.
    const allowedFiles = await db
      .select({
        id: mediaFilesTable.id,
        originalFileName: mediaFilesTable.originalFileName,
        fileSize: mediaFilesTable.fileSize,
        fileType: mediaFilesTable.fileType,
      })
      .from(mediaFilesTable)
      .where(
        and(
          eq(mediaFilesTable.projectId, row.projectId),
          eq(mediaFilesTable.uploaderStudentAccountId, ctx.studentAccountId),
          isNull(mediaFilesTable.submittedAt),
        ),
      );
    const byId = new Map(allowedFiles.map((f) => [f.id, f]));

    const hydratedClips = data.clips
      .filter((c) => byId.has(c.fileId))
      .map((c) => {
        const f = byId.get(c.fileId)!;
        return {
          fileId: f.id,
          fileName: f.originalFileName,
          fileSize: f.fileSize ?? 0,
          fileType: f.fileType ?? null,
        };
      });

    res.json({
      ok: true,
      timeline: {
        id: row.id,
        projectId: row.projectId,
        projectName: access.projectName,
        organizationName: access.organizationName,
        teacherName: access.teacherName,
        smartDraftGenerated: row.smartDraftGenerated,
        titleCardText: data.titleCardText,
        clips: hydratedClips,
      },
    });
  },
);

// PATCH /student/me/timelines/:timelineId
// Whitelisted edits: clip reorder/remove, title card text. Any other
// field is ignored. Validates every fileId in the new clip list against
// the student's current drafts so a malicious client can't smuggle in
// another student's file.
router.patch(
  "/student/me/timelines/:timelineId",
  requireStudent,
  async (req: Request, res: Response): Promise<void> => {
    const ctx = getStudent(req);
    if (!ctx) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const timelineId = Number(req.params["timelineId"]);
    if (!Number.isInteger(timelineId) || timelineId <= 0) {
      res.status(400).json({ error: "Bad Request" });
      return;
    }

    const parsed = timelinePatchSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "Bad Request", message: "Invalid timeline payload" });
      return;
    }

    const [row] = await db
      .select({
        id: timelinesTable.id,
        projectId: timelinesTable.projectId,
        data: timelinesTable.data,
        smartDraftGenerated: timelinesTable.smartDraftGenerated,
        studentAccountId: timelinesTable.studentAccountId,
      })
      .from(timelinesTable)
      .where(eq(timelinesTable.id, timelineId))
      .limit(1);

    if (!row || row.studentAccountId !== ctx.studentAccountId) {
      res.status(404).json({ error: "Not Found" });
      return;
    }
    if (row.smartDraftGenerated) {
      res.status(409).json({
        error: "Conflict",
        message: "This first cut has already been offloaded.",
      });
      return;
    }
    if (
      await isProjectLockedForStudent(
        ctx.studentAccountId,
        row.projectId,
        ctx.organizationId,
      )
    ) {
      res.status(409).json({
        error: "Conflict",
        message: "This project has already been offloaded.",
      });
      return;
    }

    const current = readTimelineData(row.data);
    const next: TimelineData = {
      clips: parsed.data.clips ?? current.clips,
      titleCardText: parsed.data.titleCardText ?? current.titleCardText,
    };

    if (parsed.data.clips) {
      const allowed = await db
        .select({ id: mediaFilesTable.id })
        .from(mediaFilesTable)
        .where(
          and(
            eq(mediaFilesTable.projectId, row.projectId),
            eq(
              mediaFilesTable.uploaderStudentAccountId,
              ctx.studentAccountId,
            ),
            isNull(mediaFilesTable.submittedAt),
          ),
        );
      const allowedIds = new Set(allowed.map((f) => f.id));
      const filtered = next.clips.filter((c) => allowedIds.has(c.fileId));
      if (filtered.length !== next.clips.length) {
        res.status(400).json({
          error: "Bad Request",
          message: "One or more clips reference files you do not own.",
        });
        return;
      }
      next.clips = filtered;
    }

    await db
      .update(timelinesTable)
      .set({
        data: next as unknown as Record<string, unknown>,
        updatedAt: new Date(),
      })
      .where(eq(timelinesTable.id, timelineId));

    res.json({ ok: true });
  },
);

// POST /student/me/timelines/:timelineId/finalize
// Atomic submit: performs the offload (file lock + teacher email) FIRST,
// then marks the timeline as generated and records the stub render job.
// One round-trip from the client — no finalize→offload race window.
router.post(
  "/student/me/timelines/:timelineId/finalize",
  requireStudent,
  async (req: Request, res: Response): Promise<void> => {
    const ctx = getStudent(req);
    if (!ctx) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const timelineId = Number(req.params["timelineId"]);
    if (!Number.isInteger(timelineId) || timelineId <= 0) {
      res.status(400).json({ error: "Bad Request" });
      return;
    }

    const [row] = await db
      .select({
        id: timelinesTable.id,
        projectId: timelinesTable.projectId,
        data: timelinesTable.data,
        smartDraftGenerated: timelinesTable.smartDraftGenerated,
        studentAccountId: timelinesTable.studentAccountId,
      })
      .from(timelinesTable)
      .where(eq(timelinesTable.id, timelineId))
      .limit(1);

    if (!row || row.studentAccountId !== ctx.studentAccountId) {
      res.status(404).json({ error: "Not Found" });
      return;
    }

    // Idempotent retry: if both the timeline and the project lock are
    // already in place, just acknowledge — the previous call succeeded.
    if (
      row.smartDraftGenerated &&
      (await isProjectLockedForStudent(
        ctx.studentAccountId,
        row.projectId,
        ctx.organizationId,
      ))
    ) {
      res.json({ ok: true, alreadyFinalized: true });
      return;
    }

    // Step 1: do the offload. If it fails (locked, no files, 500), we
    // bail BEFORE flipping smartDraftGenerated, so the timeline stays
    // editable and the student can retry from the review page.
    const offload = await performStudentOffload(
      ctx,
      row.projectId,
      req.log,
    );
    if (!offload.ok) {
      res.status(offload.status).json({
        error:
          offload.status === 404
            ? "Not Found"
            : offload.status === 409
              ? "Conflict"
              : offload.status === 400
                ? "Bad Request"
                : "Internal Server Error",
        message: offload.message,
      });
      return;
    }

    // Step 2: stamp the timeline + record the stub render. Best-effort
    // — if this throws, the offload is already committed and the
    // teacher already has the files, so we log and return success
    // rather than misleadingly 500-ing.
    const data = readTimelineData(row.data);
    const stubPayload = {
      generatedBy: "stub",
      clipCount: data.clips.length,
      titleCardText: data.titleCardText,
      submissionId: offload.submissionId,
    };
    try {
      await db.transaction(async (tx) => {
        await tx
          .update(timelinesTable)
          .set({ smartDraftGenerated: true, updatedAt: new Date() })
          .where(eq(timelinesTable.id, timelineId));
        await tx.insert(renderJobsTable).values({
          projectId: row.projectId,
          timelineId: row.id,
          provider: "stub",
          kind: "smart_draft",
          status: "complete",
          rawPayload: stubPayload as unknown as Record<string, unknown>,
        });
      });
      await logActivityRich({
        action: "smart_draft_requested",
        message: `Student finalised first cut (timeline ${row.id}, stub render complete, submission ${offload.submissionId})`,
        actorKind: "student_account",
        projectId: row.projectId,
        organizationId: ctx.organizationId,
        actorStudentAccountId: ctx.studentAccountId,
      });
    } catch (err) {
      req.log.error(
        { err, timelineId, submissionId: offload.submissionId },
        "Timeline stamp failed AFTER offload committed — files are with teacher; review record is stale.",
      );
    }

    res.json({
      ok: true,
      submissionId: offload.submissionId,
      fileCount: offload.fileCount,
      submittedAt: offload.submittedAt.toISOString(),
    });
  },
);

export default router;

