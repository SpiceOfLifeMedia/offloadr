import { Router, type IRouter } from "express";
import { v4 as uuidv4 } from "uuid";
import { db, editorSharesTable, projectsTable, mediaFilesTable, participantsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, getUserId } from "../lib/auth";
import { logActivity } from "../lib/activity";

const router: IRouter = Router();

router.post("/projects/:id/share", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req)!;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [project] = await db.select().from(projectsTable).where(and(eq(projectsTable.id, id), eq(projectsTable.userId, userId)));
  if (!project) {
    res.status(404).json({ error: "Not Found", message: "Project not found" });
    return;
  }

  const { expiresAt } = req.body as Record<string, string>;

  const shareToken = uuidv4().replace(/-/g, "");

  const [share] = await db.insert(editorSharesTable).values({
    projectId: id,
    shareToken,
    isActive: true,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
  }).returning();

  await logActivity(id, "share_created", "Editor share link created", userId);

  res.status(201).json(share);
});

router.get("/share/:token", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
  const token = raw;

  const [share] = await db.select().from(editorSharesTable).where(eq(editorSharesTable.shareToken, token));

  if (!share || !share.isActive) {
    res.status(404).json({ error: "Not Found", message: "Share link not found or disabled" });
    return;
  }

  if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
    res.status(404).json({ error: "Not Found", message: "Share link has expired" });
    return;
  }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, share.projectId));
  if (!project) {
    res.status(404).json({ error: "Not Found", message: "Project not found" });
    return;
  }

  const files = await db.select().from(mediaFilesTable).where(eq(mediaFilesTable.projectId, project.id));
  const totalSize = files.reduce((acc, f) => acc + Number(f.fileSize), 0);

  const participants = await db.select().from(participantsTable).where(eq(participantsTable.projectId, project.id));

  res.json({
    project: { ...project, fileCount: files.length, totalSize },
    files,
    participants,
    share,
  });
});

router.patch("/share/:token/disable", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req)!;
  const raw = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
  const token = raw;

  const [share] = await db.select().from(editorSharesTable).where(eq(editorSharesTable.shareToken, token));
  if (!share) {
    res.status(404).json({ error: "Not Found", message: "Share not found" });
    return;
  }

  const [project] = await db.select().from(projectsTable).where(and(eq(projectsTable.id, share.projectId), eq(projectsTable.userId, userId)));
  if (!project) {
    res.status(403).json({ error: "Forbidden", message: "Access denied" });
    return;
  }

  await db.update(editorSharesTable).set({ isActive: false }).where(eq(editorSharesTable.shareToken, token));
  await logActivity(share.projectId, "share_disabled", "Editor share link disabled", userId);

  res.json({ message: "Share link disabled" });
});

export default router;
