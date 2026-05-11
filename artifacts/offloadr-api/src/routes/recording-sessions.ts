import { Router, type IRouter } from "express";
import { db, projectsTable, recordingSessionsTable, mediaFilesTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, getUserId } from "../lib/auth";
import { logActivity } from "../lib/activity";

const router: IRouter = Router();

type Status = "idle" | "ready" | "recording" | "stopping" | "uploading" | "complete" | "error";

// Strict linear state machine per spec: idle → ready → recording → stopping → uploading → complete → error
// `error` is reachable from any non-terminal state. complete and error are terminal.
const ALLOWED: Record<Status, Status[]> = {
  idle: ["ready", "error"],
  ready: ["recording", "error"],
  recording: ["stopping", "error"],
  stopping: ["uploading", "error"],
  uploading: ["complete", "error"],
  complete: [],
  error: [],
};

async function loadProjectForUser(projectId: number, userId: number) {
  const [project] = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, userId)));
  return project ?? null;
}

router.get("/projects/:id/recording-sessions", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req)!;
  const projectId = parseInt(String(req.params.id), 10);
  const project = await loadProjectForUser(projectId, userId);
  if (!project) {
    res.status(404).json({ error: "Not Found", message: "Project not found" });
    return;
  }
  const sessions = await db
    .select()
    .from(recordingSessionsTable)
    .where(eq(recordingSessionsTable.projectId, projectId))
    .orderBy(desc(recordingSessionsTable.createdAt));
  res.json(sessions);
});

router.post("/projects/:id/recording-sessions", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req)!;
  const projectId = parseInt(String(req.params.id), 10);
  const project = await loadProjectForUser(projectId, userId);
  if (!project) {
    res.status(404).json({ error: "Not Found", message: "Project not found" });
    return;
  }

  const { label } = (req.body ?? {}) as { label?: string };

  const [session] = await db
    .insert(recordingSessionsTable)
    .values({
      projectId,
      userId,
      status: "idle",
      source: "simulated",
      label: label ? String(label).slice(0, 255) : null,
    })
    .returning();

  await logActivity(projectId, "recording_session_created", `Recording session created`, userId);

  res.status(201).json(session);
});

router.patch("/recording-sessions/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req)!;
  const sessionId = parseInt(String(req.params.id), 10);

  const [existing] = await db
    .select()
    .from(recordingSessionsTable)
    .where(and(eq(recordingSessionsTable.id, sessionId), eq(recordingSessionsTable.userId, userId)));

  if (!existing) {
    res.status(404).json({ error: "Not Found", message: "Recording session not found" });
    return;
  }

  const { status, fileRefs, errorMessage } = (req.body ?? {}) as {
    status?: Status;
    fileRefs?: Array<{ id: string; label?: string; mediaFileId?: number }>;
    errorMessage?: string;
  };

  if (!status) {
    res.status(400).json({ error: "Bad Request", message: "status is required" });
    return;
  }

  const allowed = ALLOWED[existing.status as Status] ?? [];
  if (!allowed.includes(status)) {
    res
      .status(409)
      .json({ error: "Conflict", message: `Invalid transition: ${existing.status} -> ${status}` });
    return;
  }

  const updates: Record<string, unknown> = { status, updatedAt: new Date() };

  if (status === "recording" && !existing.startedAt) {
    updates.startedAt = new Date();
  }
  if (status === "stopping" || status === "uploading" || status === "complete") {
    if (!existing.stoppedAt) {
      const stoppedAt = new Date();
      updates.stoppedAt = stoppedAt;
      if (existing.startedAt) {
        updates.durationMs = stoppedAt.getTime() - new Date(existing.startedAt).getTime();
      }
    }
  }
  if (Array.isArray(fileRefs)) {
    const lite = fileRefs
      .slice(0, 64)
      .map((f) => ({
        id: String(f.id).slice(0, 128),
        label: f.label ? String(f.label).slice(0, 255) : undefined,
        mediaFileId: typeof f.mediaFileId === "number" ? f.mediaFileId : undefined,
      }));
    updates.fileRefs = lite;
  }
  if (status === "error" && errorMessage) {
    updates.errorMessage = String(errorMessage).slice(0, 1000);
  }

  const [updated] = await db
    .update(recordingSessionsTable)
    .set(updates)
    .where(eq(recordingSessionsTable.id, sessionId))
    .returning();

  if (status === "complete") {
    await logActivity(
      existing.projectId,
      "recording_session_complete",
      `Recording session completed`,
      userId,
    );
    // Spec "done" criteria: project advances toward ready for editor.
    // Only auto-advance from early states; do not regress projects already delivered/archived.
    const [proj] = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.id, existing.projectId));
    if (proj && (proj.status === "draft" || proj.status === "uploading" || proj.status === "review_needed")) {
      await db
        .update(projectsTable)
        .set({ status: "ready_for_editor", updatedAt: new Date() })
        .where(eq(projectsTable.id, existing.projectId));
      await logActivity(
        existing.projectId,
        "project_ready_for_editor",
        `Project advanced to ready for editor after recording session`,
        userId,
      );
    }
  } else if (status === "error") {
    await logActivity(
      existing.projectId,
      "recording_session_error",
      `Recording session errored`,
      userId,
    );
  }

  res.json(updated);
});

export default router;
