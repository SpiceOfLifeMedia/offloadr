/**
 * DEV-ONLY reset endpoints — never registered in production.
 *
 * Purpose: let pilot testers reset a student's submission/upload state
 * for a project so they can re-run the full upload + offload flow
 * without manually editing the database every cycle.
 *
 * Gating: this router is mounted from routes/index.ts ONLY when
 * NODE_ENV !== "production". In production the routes do not exist —
 * not 403, not 404-with-body — they're simply never registered, so any
 * request returns Express's default 404 with no signal.
 *
 * Endpoints:
 *   POST /dev/reset-student-project
 *     body: { organizationSlug, username, projectId }
 *     - DELETE student_project_submissions row(s) for (student, project)
 *     - DELETE every media_files row uploaded by that student for that
 *       project (drafts + already-submitted, including any orphaned
 *       previous-submission rows)
 *     - UPDATE projects SET status='draft', submission_status='draft'
 *       on that project so it reopens for uploads
 *     - Returns counts.
 *
 *     NOTE: this does NOT delete the underlying R2 objects. For DEV
 *     test files (a handful of KBs) the orphans are acceptable; we'd
 *     rather not give a dev tool the ability to nuke production-style
 *     storage. If you need bucket cleanup, do it from the storage UI.
 */

import { Router, type Request, type Response, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  studentAccountsTable,
  studentProjectSubmissionsTable,
  mediaFilesTable,
  projectsTable,
  organizationsTable,
} from "@workspace/db";
import { sendUploadNotification } from "../lib/uploadNotifier";

const router: IRouter = Router();

// POST /dev/test-upload-notification
// DEV-only smoke test for the Resend wiring. Sends a fake upload
// notification email using whatever RESEND_API_KEY /
// UPLOAD_NOTIFICATION_FROM / UPLOAD_NOTIFICATION_EMAIL are currently
// configured. Returns the same logger lines the real flow emits, so
// you can diagnose without performing a real upload.
//
// Optional JSON body (all fields optional):
//   { to?: string, from?: string, projectName?: string, uploaderName?: string }
// When `to` or `from` is provided the env values are temporarily
// overridden via process.env (DEV only, never restored — restart the
// workflow to clear).
router.post(
  "/dev/test-upload-notification",
  async (req: Request, res: Response): Promise<void> => {
    const body = (req.body ?? {}) as {
      to?: unknown;
      from?: unknown;
      projectName?: unknown;
      uploaderName?: unknown;
    };
    const projectName =
      typeof body.projectName === "string"
        ? body.projectName
        : "DEV Test Project";
    const uploaderName =
      typeof body.uploaderName === "string"
        ? body.uploaderName
        : "dev.tester";
    const overrideTo =
      typeof body.to === "string" && body.to.includes("@") ? body.to : null;
    const overrideFrom =
      typeof body.from === "string" && body.from.includes("@") ? body.from : null;

    // Snapshot + temporarily override env vars only for the duration of
    // this single send, then restore. This avoids leaking the override
    // into subsequent unrelated requests, which would happen if we just
    // wrote to process.env (the notifier reads env each call).
    const prevTo = process.env["UPLOAD_NOTIFICATION_EMAIL"];
    const prevFrom = process.env["UPLOAD_NOTIFICATION_FROM"];
    if (overrideTo !== null) process.env["UPLOAD_NOTIFICATION_EMAIL"] = overrideTo;
    if (overrideFrom !== null) process.env["UPLOAD_NOTIFICATION_FROM"] = overrideFrom;

    req.log.info(
      {
        event: "dev.test_upload_notification",
        to: process.env["UPLOAD_NOTIFICATION_EMAIL"] ?? "info@edumediasystems.com.au (default)",
        from: process.env["UPLOAD_NOTIFICATION_FROM"] ?? "(env default)",
        hasKey: Boolean(process.env["RESEND_API_KEY"]),
        overrideTo: overrideTo !== null,
        overrideFrom: overrideFrom !== null,
      },
      "[dev] sending test upload notification",
    );

    const resolvedTo =
      process.env["UPLOAD_NOTIFICATION_EMAIL"] ?? "info@edumediasystems.com.au";
    // For display only — actual `from` is computed inside the notifier
    // from defaultFrom()/subjectPrefix() based on detectOffloadrEnv().
    // Keep these labels in sync with uploadNotifier.ts DEFAULT_FROM_*.
    const envLabel = (process.env["OFFLOADR_ENV"] ?? "").toLowerCase();
    const isProd = envLabel === "production";
    const isPilot =
      envLabel === "pilot" ||
      (envLabel === "" && process.env["NODE_ENV"] === "production");
    const resolvedFrom =
      process.env["UPLOAD_NOTIFICATION_FROM"] ??
      (isProd
        ? "Offloadr <notifications@edumediasystems.com.au>"
        : isPilot
          ? "Offloadr (PILOT) <notifications@edumediasystems.com.au>"
          : "Offloadr (DEV) <notifications@edumediasystems.com.au>");

    try {
      await sendUploadNotification({
        projectId: 0,
        projectName,
        uploaderName,
        uploaderKind: "student",
        files: [
          {
            originalFileName: "dev-test-clip.mp4",
            fileSizeBytes: 1024 * 1024 * 12,
            fileId: 0,
          },
        ],
        uploadedAt: new Date(),
      });
    } finally {
      // Restore prior env to avoid cross-request contamination.
      if (overrideTo !== null) {
        if (prevTo === undefined) delete process.env["UPLOAD_NOTIFICATION_EMAIL"];
        else process.env["UPLOAD_NOTIFICATION_EMAIL"] = prevTo;
      }
      if (overrideFrom !== null) {
        if (prevFrom === undefined) delete process.env["UPLOAD_NOTIFICATION_FROM"];
        else process.env["UPLOAD_NOTIFICATION_FROM"] = prevFrom;
      }
    }

    res.json({
      ok: true,
      note: "Notification dispatched. Inspect API logs for [uploadNotifier] lines to see the Resend response.",
      to: resolvedTo,
      from: resolvedFrom,
      hasResendKey: Boolean(process.env["RESEND_API_KEY"]),
    });
  },
);

router.post(
  "/dev/reset-student-project",
  async (req: Request, res: Response): Promise<void> => {
    const { organizationSlug, username, projectId } = (req.body ?? {}) as {
      organizationSlug?: unknown;
      username?: unknown;
      projectId?: unknown;
    };

    if (
      typeof organizationSlug !== "string" ||
      typeof username !== "string" ||
      typeof projectId !== "number" ||
      !Number.isInteger(projectId) ||
      projectId <= 0
    ) {
      res.status(400).json({
        error: "Bad Request",
        message:
          "Expected JSON body: { organizationSlug: string, username: string, projectId: number }",
      });
      return;
    }

    // Resolve org → student → confirm project is in same org.
    const [org] = await db
      .select({ id: organizationsTable.id })
      .from(organizationsTable)
      .where(eq(organizationsTable.slug, organizationSlug.toLowerCase()))
      .limit(1);
    if (!org) {
      res.status(404).json({ error: "Not Found", message: "Unknown organizationSlug" });
      return;
    }

    const [student] = await db
      .select({ id: studentAccountsTable.id })
      .from(studentAccountsTable)
      .where(
        and(
          eq(studentAccountsTable.organizationId, org.id),
          eq(studentAccountsTable.username, username.toLowerCase()),
        ),
      )
      .limit(1);
    if (!student) {
      res.status(404).json({
        error: "Not Found",
        message: `Unknown student "${username}" in org "${organizationSlug}"`,
      });
      return;
    }

    const [project] = await db
      .select({ id: projectsTable.id, organizationId: projectsTable.organizationId })
      .from(projectsTable)
      .where(eq(projectsTable.id, projectId))
      .limit(1);
    if (!project || project.organizationId !== org.id) {
      res.status(404).json({
        error: "Not Found",
        message: `Project ${projectId} does not belong to org "${organizationSlug}"`,
      });
      return;
    }

    let deletedSubmissions = 0;
    let deletedMedia = 0;

    await db.transaction(async (tx) => {
      const subs = await tx
        .delete(studentProjectSubmissionsTable)
        .where(
          and(
            eq(studentProjectSubmissionsTable.studentAccountId, student.id),
            eq(studentProjectSubmissionsTable.projectId, projectId),
          ),
        )
        .returning({ id: studentProjectSubmissionsTable.submissionId });
      deletedSubmissions = subs.length;

      const media = await tx
        .delete(mediaFilesTable)
        .where(
          and(
            eq(mediaFilesTable.uploaderStudentAccountId, student.id),
            eq(mediaFilesTable.projectId, projectId),
          ),
        )
        .returning({ id: mediaFilesTable.id });
      deletedMedia = media.length;

      await tx
        .update(projectsTable)
        .set({
          status: "draft",
          submissionStatus: "draft",
          updatedAt: new Date(),
        })
        .where(eq(projectsTable.id, projectId));
    });

    req.log.info(
      {
        event: "dev.reset_student_project",
        organizationSlug,
        username,
        projectId,
        deletedSubmissions,
        deletedMedia,
      },
      "[dev] reset student project state",
    );

    res.json({
      ok: true,
      organizationSlug,
      username,
      projectId,
      deletedSubmissions,
      deletedMedia,
      projectStatus: "draft",
      submissionStatus: "draft",
      note: "R2 objects for the deleted media_files rows are NOT removed — DEV orphans are acceptable.",
    });
  },
);

export default router;
