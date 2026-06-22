import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import path from "path";
import os from "os";
import fs from "fs";
import { z } from "zod";
import {
  db,
  mediaFilesTable,
  projectsTable,
  organizationsTable,
  studentUploadCodesTable,
} from "@workspace/db";
import { and, desc, eq, sql, or, isNull, gt, inArray } from "drizzle-orm";
import {
  requireAuth,
  requireOrganization,
  getUserId,
  getOrganizationId,
} from "../lib/auth";
import { canManageProjects, requireRole } from "../lib/permissions";
import { logActivity } from "../lib/activity";
import { detectFileType } from "../lib/storage";
import { parseBody } from "../lib/validate";
import { getStorageDriver } from "../lib/storage/index";
import { sendUploadNotification } from "../lib/uploadNotifier";
import {
  generateStudentUploadCode,
  normalizeStudentUploadCode,
} from "../lib/studentCodeGenerator";
import {
  studentCodeResolveLimiter,
  studentCodeUploadLimiter,
  studentCodeUploadIpLimiter,
} from "../lib/rateLimit";
import type { NextFunction } from "express";
import { signUploadGrant, verifyUploadGrant } from "../lib/uploadGrant";

const router: IRouter = Router();

const TMP_UPLOAD_DIR = path.join(os.tmpdir(), "offloadr-student-uploads");
fs.mkdirSync(TMP_UPLOAD_DIR, { recursive: true });

const studentUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, TMP_UPLOAD_DIR),
    filename: (_req, _file, cb) =>
      cb(null, `${Date.now()}_${Math.random().toString(36).slice(2)}`),
  }),
  // Match the teacher upload limit (10 GiB) so a student raw recording
  // is never rejected for being too big. Abuse via a leaked code is
  // mitigated by the per-code maxUploads cap, per-IP rate limits, and
  // the short-lived signed upload grant — not by clamping file size
  // below what teachers themselves can submit.
  limits: { fileSize: 10 * 1024 * 1024 * 1024 },
});

const API_MOUNT_PATH = process.env["API_MOUNT_PATH"] ?? "/api";

const createCodeSchema = z
  .object({
    expiresAt: z
      .union([
        z.string().datetime({ offset: true, message: "expiresAt must be an ISO 8601 datetime" }),
        z.null(),
      ])
      .optional(),
    maxUploads: z
      .union([z.number().int().min(1).max(10000), z.null()])
      .optional(),
  })
  .strict();

const studentNameSchema = z
  .string()
  .trim()
  .min(1, "studentName is required")
  .max(120, "studentName is too long");

async function generateUniqueCode(): Promise<string> {
  // Collisions are astronomically rare in a 887M space, but loop just in
  // case so we never accidentally violate the unique index in production.
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = generateStudentUploadCode();
    const [existing] = await db
      .select({ id: studentUploadCodesTable.id })
      .from(studentUploadCodesTable)
      .where(eq(studentUploadCodesTable.code, candidate))
      .limit(1);
    if (!existing) return candidate;
  }
  throw new Error("Failed to allocate a unique student upload code after 8 attempts");
}

router.get(
  "/projects/:projectId/student-upload-codes",
  requireAuth,
  requireOrganization,
  requireRole(canManageProjects),
  async (req, res): Promise<void> => {
    const organizationId = getOrganizationId(req)!;
    const raw = Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId;
    const projectId = parseInt(raw, 10);
    if (Number.isNaN(projectId)) {
      res.status(400).json({ error: "Bad Request", message: "Invalid projectId" });
      return;
    }

    const [project] = await db
      .select()
      .from(projectsTable)
      .where(and(eq(projectsTable.id, projectId), eq(projectsTable.organizationId, organizationId)));
    if (!project) {
      res.status(404).json({ error: "Not Found", message: "Project not found" });
      return;
    }

    const codes = await db
      .select()
      .from(studentUploadCodesTable)
      .where(
        and(
          eq(studentUploadCodesTable.projectId, projectId),
          // Defence in depth: org guard at the code level too, not just
          // via the project ownership check above.
          eq(studentUploadCodesTable.organizationId, organizationId),
        ),
      )
      .orderBy(desc(studentUploadCodesTable.createdAt));

    // Enrich each code with the most recent upload time. Done as a
    // single GROUP BY on media_files filtered by the code IDs above,
    // then merged in JS — avoids N+1 and keeps the response shape flat.
    const codeIds = codes.map((c) => c.id);
    const lastUploadsByCode = new Map<number, string>();
    if (codeIds.length > 0) {
      const rows = await db
        .select({
          codeId: mediaFilesTable.studentUploadCodeId,
          lastUploadAt: sql<Date>`MAX(${mediaFilesTable.uploadedAt})`.as("last_upload_at"),
        })
        .from(mediaFilesTable)
        .where(
          and(
            inArray(mediaFilesTable.studentUploadCodeId, codeIds),
            eq(mediaFilesTable.projectId, projectId),
          ),
        )
        .groupBy(mediaFilesTable.studentUploadCodeId);
      for (const r of rows) {
        if (r.codeId != null && r.lastUploadAt) {
          lastUploadsByCode.set(r.codeId, new Date(r.lastUploadAt).toISOString());
        }
      }
    }
    const enriched = codes.map((c) => ({
      ...c,
      lastUploadAt: lastUploadsByCode.get(c.id) ?? null,
    }));
    res.json(enriched);
  },
);

// Per-name upload summary for a project. Powers the "Uploads received"
// teacher view: a teacher can see at a glance who has actually uploaded
// without opening the file browser. Aggregates ALL student uploads
// (across every code) and groups by uploader name. Null/empty names
// are bucketed as "Unknown".
router.get(
  "/projects/:projectId/uploader-summary",
  requireAuth,
  requireOrganization,
  requireRole(canManageProjects),
  async (req, res): Promise<void> => {
    const organizationId = getOrganizationId(req)!;
    const raw = Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId;
    const projectId = parseInt(raw, 10);
    if (Number.isNaN(projectId)) {
      res.status(400).json({ error: "Bad Request", message: "Invalid projectId" });
      return;
    }

    const [project] = await db
      .select()
      .from(projectsTable)
      .where(and(eq(projectsTable.id, projectId), eq(projectsTable.organizationId, organizationId)));
    if (!project) {
      res.status(404).json({ error: "Not Found", message: "Project not found" });
      return;
    }

    const rows = await db
      .select({
        name: mediaFilesTable.studentUploaderName,
        fileCount: sql<number>`COUNT(*)::int`.as("file_count"),
        lastUploadAt: sql<Date>`MAX(${mediaFilesTable.uploadedAt})`.as("last_upload_at"),
      })
      .from(mediaFilesTable)
      .where(
        and(
          eq(mediaFilesTable.projectId, projectId),
          eq(mediaFilesTable.uploaderKind, "student"),
        ),
      )
      .groupBy(mediaFilesTable.studentUploaderName)
      .orderBy(desc(sql`MAX(${mediaFilesTable.uploadedAt})`));

    const summary = rows.map((r) => ({
      name: r.name && r.name.trim().length > 0 ? r.name : null,
      fileCount: r.fileCount,
      lastUploadAt: r.lastUploadAt ? new Date(r.lastUploadAt).toISOString() : null,
    }));
    res.json(summary);
  },
);

router.post(
  "/projects/:projectId/student-upload-codes",
  requireAuth,
  requireOrganization,
  requireRole(canManageProjects),
  async (req, res): Promise<void> => {
    const userId = getUserId(req)!;
    const organizationId = getOrganizationId(req)!;
    const raw = Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId;
    const projectId = parseInt(raw, 10);
    if (Number.isNaN(projectId)) {
      res.status(400).json({ error: "Bad Request", message: "Invalid projectId" });
      return;
    }

    const [project] = await db
      .select()
      .from(projectsTable)
      .where(and(eq(projectsTable.id, projectId), eq(projectsTable.organizationId, organizationId)));
    if (!project) {
      res.status(404).json({ error: "Not Found", message: "Project not found" });
      return;
    }

    // Body is optional — a teacher can create a code with no caps at all.
    const body = req.body && Object.keys(req.body).length > 0
      ? parseBody(req, res, createCodeSchema)
      : { expiresAt: null, maxUploads: null };
    if (!body) return;

    const code = await generateUniqueCode();
    const [created] = await db
      .insert(studentUploadCodesTable)
      .values({
        projectId,
        // organizationId is taken from the project, NEVER from the client.
        organizationId,
        code,
        status: "active",
        maxUploads: body.maxUploads ?? null,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        createdByUserId: userId,
      })
      .returning();

    await logActivity(
      projectId,
      "student_upload_code_created",
      `Student upload code ${code} created`,
      userId,
    );
    res.status(201).json(created);
  },
);

router.post(
  "/student-upload-codes/:codeId/regenerate",
  requireAuth,
  requireOrganization,
  requireRole(canManageProjects),
  async (req, res): Promise<void> => {
    const userId = getUserId(req)!;
    const organizationId = getOrganizationId(req)!;
    const raw = Array.isArray(req.params.codeId) ? req.params.codeId[0] : req.params.codeId;
    const codeId = parseInt(raw, 10);
    if (Number.isNaN(codeId)) {
      res.status(400).json({ error: "Bad Request", message: "Invalid codeId" });
      return;
    }

    // Verify ownership before doing any work. Org binding from the
    // resolved row is the source of truth; the URL alone is not.
    const [existing] = await db
      .select()
      .from(studentUploadCodesTable)
      .where(
        and(
          eq(studentUploadCodesTable.id, codeId),
          eq(studentUploadCodesTable.organizationId, organizationId),
        ),
      );
    if (!existing) {
      res.status(404).json({ error: "Not Found", message: "Code not found" });
      return;
    }

    // Allocate the new code BEFORE the transaction so the unique-code
    // probe can't deadlock against the close+insert. The transaction
    // then atomically closes the old row and inserts the new one, so
    // the teacher never sees a window with neither code active.
    const newCode = await generateUniqueCode();
    const created = await db.transaction(async (tx) => {
      if (existing.status !== "closed") {
        await tx
          .update(studentUploadCodesTable)
          .set({ status: "closed", closedAt: new Date() })
          .where(eq(studentUploadCodesTable.id, existing.id));
      }
      const [row] = await tx
        .insert(studentUploadCodesTable)
        .values({
          projectId: existing.projectId,
          organizationId: existing.organizationId,
          code: newCode,
          status: "active",
          maxUploads: existing.maxUploads ?? null,
          expiresAt: existing.expiresAt ?? null,
          createdByUserId: userId,
        })
        .returning();
      return row;
    });

    await logActivity(
      existing.projectId,
      "student_upload_code_regenerated",
      `Student upload code ${existing.code} rotated → ${newCode}`,
      userId,
    );
    res.status(201).json(created);
  },
);

router.post(
  "/student-upload-codes/:codeId/close",
  requireAuth,
  requireOrganization,
  requireRole(canManageProjects),
  async (req, res): Promise<void> => {
    const userId = getUserId(req)!;
    const organizationId = getOrganizationId(req)!;
    const raw = Array.isArray(req.params.codeId) ? req.params.codeId[0] : req.params.codeId;
    const codeId = parseInt(raw, 10);
    if (Number.isNaN(codeId)) {
      res.status(400).json({ error: "Bad Request", message: "Invalid codeId" });
      return;
    }

    const [existing] = await db
      .select()
      .from(studentUploadCodesTable)
      .where(
        and(
          eq(studentUploadCodesTable.id, codeId),
          eq(studentUploadCodesTable.organizationId, organizationId),
        ),
      );
    if (!existing) {
      res.status(404).json({ error: "Not Found", message: "Code not found" });
      return;
    }

    if (existing.status === "closed") {
      res.json(existing);
      return;
    }

    const [updated] = await db
      .update(studentUploadCodesTable)
      .set({ status: "closed", closedAt: new Date() })
      .where(eq(studentUploadCodesTable.id, codeId))
      .returning();

    await logActivity(
      existing.projectId,
      "student_upload_code_closed",
      `Student upload code ${existing.code} closed`,
      userId,
    );
    res.json(updated);
  },
);

interface ResolvedCode {
  row: typeof studentUploadCodesTable.$inferSelect;
  organizationDisplayName: string;
  projectName: string;
  projectId: number;
  studentInstructions: string | null;
  studentWorkflowChoice: "smart_draft" | "manual" | null;
  uploadsRemaining: number | null;
}

/**
 * Look up a code from public input, validate it's usable (active, not
 * expired, not exhausted), and return the row + the project/org names
 * a student needs to confirm where they're uploading. Returns null on
 * any failure so we can answer 404 uniformly — don't leak whether a
 * code was right-but-closed vs never existed.
 */
async function resolveCodeForPublic(rawCode: unknown): Promise<ResolvedCode | null> {
  const normalized = normalizeStudentUploadCode(rawCode);
  if (!normalized) return null;

  const [row] = await db
    .select()
    .from(studentUploadCodesTable)
    .where(eq(studentUploadCodesTable.code, normalized))
    .limit(1);
  if (!row) return null;
  if (row.status !== "active") return null;
  if (row.expiresAt && new Date(row.expiresAt) <= new Date()) return null;
  const remaining =
    typeof row.maxUploads === "number" ? row.maxUploads - row.uploadCount : null;
  if (remaining !== null && remaining <= 0) return null;

  const [project] = await db
    .select({
      id: projectsTable.id,
      projectName: projectsTable.projectName,
      organizationId: projectsTable.organizationId,
      studentInstructions: projectsTable.studentInstructions,
      studentWorkflowChoice: projectsTable.studentWorkflowChoice,
    })
    .from(projectsTable)
    .where(eq(projectsTable.id, row.projectId))
    .limit(1);
  if (!project) return null;
  // Defence in depth: the code is supposed to carry the same org as the
  // project. If those ever disagree (e.g. someone hand-edited DB), refuse.
  if (project.organizationId !== row.organizationId) return null;

  const [org] = await db
    .select({
      displayName: organizationsTable.displayName,
      name: organizationsTable.name,
    })
    .from(organizationsTable)
    .where(eq(organizationsTable.id, row.organizationId))
    .limit(1);
  if (!org) return null;

  return {
    row,
    organizationDisplayName: org.displayName ?? org.name,
    projectName: project.projectName,
    projectId: project.id,
    studentInstructions: project.studentInstructions ?? null,
    studentWorkflowChoice: project.studentWorkflowChoice ?? null,
    uploadsRemaining: remaining,
  };
}

router.get(
  "/student-upload/codes/:code",
  studentCodeResolveLimiter,
  async (req: Request, res: Response): Promise<void> => {
    const raw = Array.isArray(req.params.code) ? req.params.code[0] : req.params.code;
    const resolved = await resolveCodeForPublic(raw);
    if (!resolved) {
      res.status(404).json({
        error: "Not Found",
        message: "This code isn't active. Ask your teacher for a fresh one.",
      });
      return;
    }
    const grant = signUploadGrant(resolved.row.id);
    res.json({
      code: resolved.row.code,
      projectName: resolved.projectName,
      organizationDisplayName: resolved.organizationDisplayName,
      projectId: resolved.projectId,
      studentInstructions: resolved.studentInstructions,
      studentWorkflowChoice: resolved.studentWorkflowChoice,
      expiresAt: resolved.row.expiresAt,
      uploadsRemaining: resolved.uploadsRemaining,
      uploadGrant: grant.token,
      uploadGrantExpiresAt: grant.expiresAt,
    });
  },
);

// Student workflow chooser — records the student's preferred
// post-upload path (smart_draft vs manual) against the project. Public
// endpoint scoped by the upload code and the short-lived uploadGrant
// signed for that code. NEVER triggers provider work directly — the
// teacher must still hit "Generate Smart Draft" on their side. This
// keeps school-paid provider spend behind teacher consent and avoids
// turning a leaked code into a billable abuse vector.
const workflowChoiceSchema = z
  .object({
    choice: z.enum(["smart_draft", "manual"]),
    uploadGrant: z.string().min(1, "uploadGrant is required"),
  })
  .strict();

router.post(
  "/student-upload/codes/:code/workflow-choice",
  studentCodeResolveLimiter,
  async (req: Request, res: Response): Promise<void> => {
    const raw = Array.isArray(req.params.code) ? req.params.code[0] : req.params.code;
    const resolved = await resolveCodeForPublic(raw);
    if (!resolved) {
      res.status(404).json({
        error: "Not Found",
        message: "This code isn't active. Ask your teacher for a fresh one.",
      });
      return;
    }

    const parsed = workflowChoiceSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Bad Request",
        message: parsed.error.issues[0]?.message ?? "Invalid request body",
      });
      return;
    }

    // The uploadGrant is a short-lived signed token bound to this code.
    // Without it, anyone who guessed/leaked a code could flip the choice
    // without ever having loaded the student page (which is what mints
    // the grant). With it, the attacker must have actually resolved the
    // code in the last ~grant lifetime, which is exactly the threshold
    // we already accept for uploads.
    const grantCheck = verifyUploadGrant(parsed.data.uploadGrant, resolved.row.id);
    if (!grantCheck.ok) {
      res.status(401).json({
        error: "Unauthorized",
        message:
          grantCheck.reason === "expired"
            ? "Your upload session expired. Refresh the page and try again."
            : "Invalid upload grant. Refresh the page and try again.",
      });
      return;
    }

    const [updated] = await db
      .update(projectsTable)
      .set({
        studentWorkflowChoice: parsed.data.choice,
        studentWorkflowChoiceAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(projectsTable.id, resolved.projectId))
      .returning({
        id: projectsTable.id,
        studentWorkflowChoice: projectsTable.studentWorkflowChoice,
        studentWorkflowChoiceAt: projectsTable.studentWorkflowChoiceAt,
      });

    req.log?.info?.(
      { projectId: resolved.projectId, choice: parsed.data.choice, code: resolved.row.code },
      "Student recorded workflow choice",
    );

    res.json({
      projectId: updated?.id ?? resolved.projectId,
      studentWorkflowChoice: updated?.studentWorkflowChoice ?? parsed.data.choice,
      studentWorkflowChoiceAt:
        updated?.studentWorkflowChoiceAt?.toISOString() ?? new Date().toISOString(),
    });
  },
);

// Resolve & cache the upload code BEFORE multer is allowed to parse the
// multipart body. Without this, an attacker could POST a 2 GiB body to a
// non-existent code, force multer to spool the file to disk, and only then
// hit the 404 — exhausting disk and bandwidth on the API host. With this
// middleware in front of multer, invalid codes short-circuit immediately
// and the request body is never read.
async function preValidateUploadCode(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const raw = Array.isArray(req.params.code) ? req.params.code[0] : req.params.code;
  const resolved = await resolveCodeForPublic(raw);
  if (!resolved) {
    res.status(404).json({
      error: "Not Found",
      message: "This code isn't active. Ask your teacher for a fresh one.",
    });
    return;
  }
  res.locals["studentUploadResolved"] = resolved;
  next();
}

/**
 * Wrap `multer.single("file")` so multipart-level failures (file too
 * large, unexpected fields, mid-stream aborts) become structured JSON
 * errors instead of leaking through the default Express HTML handler.
 */
function handleStudentUpload(req: Request, res: Response, next: NextFunction): void {
  studentUpload.single("file")(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        res.status(413).json({
          error: "Payload Too Large",
          message: "File is too large to upload.",
        });
        return;
      }
      res.status(400).json({
        error: "Bad Request",
        message: `Upload rejected: ${err.code}`,
      });
      return;
    }
    next(err);
  });
}

router.post(
  "/student-upload/codes/:code/upload",
  studentCodeUploadIpLimiter,
  studentCodeUploadLimiter,
  preValidateUploadCode,
  handleStudentUpload,
  async (req: Request, res: Response): Promise<void> => {
    const cleanupTmp = (): void => {
      if (req.file?.path) {
        fs.promises.unlink(req.file.path).catch(() => undefined);
      }
    };

    // Re-resolve to pick up any state change during the multipart upload
    // window (code closed, cap exhausted, expired). The cached value from
    // preValidateUploadCode is only used for fast-path short-circuiting.
    const raw = Array.isArray(req.params.code) ? req.params.code[0] : req.params.code;
    const resolved = await resolveCodeForPublic(raw);
    if (!resolved) {
      cleanupTmp();
      res.status(404).json({
        error: "Not Found",
        message: "This code isn't active. Ask your teacher for a fresh one.",
      });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: "Bad Request", message: "No file uploaded" });
      return;
    }

    const nameResult = studentNameSchema.safeParse(req.body?.studentName);
    if (!nameResult.success) {
      cleanupTmp();
      res.status(400).json({
        error: "Bad Request",
        message: "Invalid studentName",
        issues: nameResult.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      });
      return;
    }
    const studentName = nameResult.data;

    // Verify the short-lived upload grant minted by resolveStudentUploadCode.
    // The grant binds this upload to the exact codeId the client just
    // resolved, so the URL is not the sole proof of intent.
    const grantInput =
      typeof req.body?.uploadGrant === "string" && req.body.uploadGrant.length > 0
        ? req.body.uploadGrant
        : (req.headers["x-upload-grant"] as string | undefined);
    const grantCheck = verifyUploadGrant(grantInput, resolved.row.id);
    if (!grantCheck.ok) {
      cleanupTmp();
      res.status(401).json({
        error: "Unauthorized",
        message:
          grantCheck.reason === "expired"
            ? "Your upload session expired. Refresh the page and try again."
            : "Invalid upload grant. Refresh the page and try again.",
      });
      return;
    }

    // Atomically reserve a slot under the cap before doing any storage
    // work. This single conditional UPDATE prevents two concurrent
    // uploads from both passing the cached `uploadsRemaining` check and
    // exceeding `maxUploads`. If the row doesn't update, the code is
    // no longer eligible (closed, expired, or cap reached).
    const [reserved] = await db
      .update(studentUploadCodesTable)
      .set({ uploadCount: sql`${studentUploadCodesTable.uploadCount} + 1` })
      .where(
        and(
          eq(studentUploadCodesTable.id, resolved.row.id),
          eq(studentUploadCodesTable.status, "active"),
          or(
            isNull(studentUploadCodesTable.expiresAt),
            gt(studentUploadCodesTable.expiresAt, new Date()),
          ),
          or(
            isNull(studentUploadCodesTable.maxUploads),
            sql`${studentUploadCodesTable.uploadCount} < ${studentUploadCodesTable.maxUploads}`,
          ),
        ),
      )
      .returning({ id: studentUploadCodesTable.id });

    if (!reserved) {
      cleanupTmp();
      res.status(409).json({
        error: "Conflict",
        message: "This code just hit its upload limit or was closed. Ask your teacher for a fresh one.",
      });
      return;
    }

    // Helper to release the reserved slot if anything downstream fails.
    const releaseSlot = async (): Promise<void> => {
      await db
        .update(studentUploadCodesTable)
        .set({ uploadCount: sql`GREATEST(${studentUploadCodesTable.uploadCount} - 1, 0)` })
        .where(eq(studentUploadCodesTable.id, resolved.row.id));
    };

    const projectId = resolved.row.projectId;
    const organizationId = resolved.row.organizationId;
    const fileType = detectFileType(req.file.mimetype);

    const timestamp = Date.now();
    const ext = path.extname(req.file.originalname);
    const base = path
      .basename(req.file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, "_");
    const storageKey = `offloadr/projects/${projectId}/${timestamp}_student_${base}${ext}`;

    try {
      await getStorageDriver().upload(
        storageKey,
        fs.createReadStream(req.file.path),
        req.file.mimetype,
      );
    } catch (err) {
      req.log.error(
        { err, storageKey, codeId: resolved.row.id },
        "Failed to upload student file to object storage",
      );
      cleanupTmp();
      await releaseSlot();
      res
        .status(500)
        .json({ error: "Internal Server Error", message: "Failed to store file" });
      return;
    } finally {
      cleanupTmp();
    }

    const [file] = await db
      .insert(mediaFilesTable)
      .values({
        // organizationId is implicit via projectId — both come from the
        // resolved code, never from the client.
        projectId,
        originalFileName: req.file.originalname,
        cleanFileName: null,
        fileType,
        mediaRole: null,
        fileSize: req.file.size,
        uploadStatus: "uploaded",
        storagePath: storageKey,
        publicUrl: null,
        notes: null,
        uploadedAt: new Date(),
        uploaderKind: "student",
        studentUploaderName: studentName,
        studentUploadCodeId: resolved.row.id,
      })
      .returning();

    if (!file) {
      await releaseSlot();
      res
        .status(500)
        .json({ error: "Internal Server Error", message: "Failed to record file" });
      return;
    }

    const [withUrl] = await db
      .update(mediaFilesTable)
      .set({ publicUrl: `${API_MOUNT_PATH}/files/${file.id}/download` })
      .where(eq(mediaFilesTable.id, file.id))
      .returning();

    // Flip draft projects into "uploading" so the teacher sees the new
    // file land in the queue the same way teacher uploads do.
    const [proj] = await db
      .select({ status: projectsTable.status })
      .from(projectsTable)
      .where(eq(projectsTable.id, projectId));
    if (proj?.status === "draft") {
      await db
        .update(projectsTable)
        .set({ status: "uploading", updatedAt: new Date() })
        .where(eq(projectsTable.id, projectId));
    }

    await logActivity(
      projectId,
      "student_file_uploaded",
      `Student "${studentName}" uploaded "${req.file.originalname}" (code ${resolved.row.code})`,
    );

    // Fire-and-forget upload notification. Best-effort; failure is logged
    // inside the notifier and never affects the upload response.
    void sendUploadNotification({
      projectId,
      projectName: resolved.projectName,
      uploaderName: studentName,
      uploaderKind: "student",
      files: [
        {
          originalFileName: file.originalFileName,
          fileSizeBytes: file.fileSize ?? req.file?.size ?? 0,
          fileId: file.id,
        },
      ],
      uploadedAt: file.uploadedAt ?? new Date(),
    });

    void organizationId; // documented above — tenant binding comes from the code
    res.status(201).json({
      ok: true,
      fileId: withUrl?.id ?? file.id,
      originalFileName: file.originalFileName,
    });
  },
);

export default router;
