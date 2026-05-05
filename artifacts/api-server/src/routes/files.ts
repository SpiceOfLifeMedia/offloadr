import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db, mediaFilesTable, projectsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, getUserId } from "../lib/auth";
import { logActivity } from "../lib/activity";
import { detectFileType, ensureUploadDir } from "../lib/storage";

ensureUploadDir();

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "./uploads";

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, "_");
    cb(null, `${timestamp}_${base}${ext}`);
  },
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 * 1024 } });

const router: IRouter = Router();

router.get("/projects/:id/files", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req)!;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [project] = await db.select().from(projectsTable).where(and(eq(projectsTable.id, id), eq(projectsTable.userId, userId)));
  if (!project) {
    res.status(404).json({ error: "Not Found", message: "Project not found" });
    return;
  }

  const files = await db.select().from(mediaFilesTable).where(eq(mediaFilesTable.projectId, id));
  res.json(files);
});

router.post("/projects/:id/files/upload", requireAuth, upload.single("file"), async (req, res): Promise<void> => {
  const userId = getUserId(req)!;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [project] = await db.select().from(projectsTable).where(and(eq(projectsTable.id, id), eq(projectsTable.userId, userId)));
  if (!project) {
    res.status(404).json({ error: "Not Found", message: "Project not found" });
    return;
  }

  if (!req.file) {
    res.status(400).json({ error: "Bad Request", message: "No file uploaded" });
    return;
  }

  const fileType = detectFileType(req.file.mimetype);
  const mediaRole = (req.body as Record<string, string>)["mediaRole"] ?? null;
  const notes = (req.body as Record<string, string>)["notes"] ?? null;

  const [file] = await db.insert(mediaFilesTable).values({
    projectId: id,
    originalFileName: req.file.originalname,
    cleanFileName: null,
    fileType,
    mediaRole: mediaRole ?? null,
    fileSize: req.file.size,
    uploadStatus: "uploaded",
    storagePath: req.file.filename,
    publicUrl: `/api/files/download/${req.file.filename}`,
    notes: notes ?? null,
    uploadedAt: new Date(),
  }).returning();

  await logActivity(id, "file_uploaded", `File "${req.file.originalname}" uploaded`, userId);

  if (project.status === "draft") {
    await db.update(projectsTable).set({ status: "uploading", updatedAt: new Date() }).where(eq(projectsTable.id, id));
  }

  res.status(201).json(file);
});

router.patch("/files/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req)!;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [file] = await db.select().from(mediaFilesTable).where(eq(mediaFilesTable.id, id));
  if (!file) {
    res.status(404).json({ error: "Not Found", message: "File not found" });
    return;
  }

  const [project] = await db.select().from(projectsTable).where(and(eq(projectsTable.id, file.projectId), eq(projectsTable.userId, userId)));
  if (!project) {
    res.status(403).json({ error: "Forbidden", message: "Access denied" });
    return;
  }

  const updates: Record<string, unknown> = {};
  for (const key of ["mediaRole", "notes", "cleanFileName"]) {
    if (key in req.body) updates[key] = req.body[key];
  }
  updates["updatedAt"] = new Date();

  const [updated] = await db.update(mediaFilesTable).set(updates as Parameters<typeof db.update>[0]).where(eq(mediaFilesTable.id, id)).returning();
  res.json(updated);
});

router.delete("/files/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req)!;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [file] = await db.select().from(mediaFilesTable).where(eq(mediaFilesTable.id, id));
  if (!file) {
    res.status(404).json({ error: "Not Found", message: "File not found" });
    return;
  }

  const [project] = await db.select().from(projectsTable).where(and(eq(projectsTable.id, file.projectId), eq(projectsTable.userId, userId)));
  if (!project) {
    res.status(403).json({ error: "Forbidden", message: "Access denied" });
    return;
  }

  if (file.storagePath) {
    const fullPath = path.join(UPLOAD_DIR, file.storagePath);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  }

  await db.delete(mediaFilesTable).where(eq(mediaFilesTable.id, id));
  await logActivity(file.projectId, "file_deleted", `File "${file.originalFileName}" deleted`, userId);

  res.json({ message: "File deleted" });
});

router.post("/files/:id/retry", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req)!;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [file] = await db.select().from(mediaFilesTable).where(eq(mediaFilesTable.id, id));
  if (!file) {
    res.status(404).json({ error: "Not Found", message: "File not found" });
    return;
  }

  const [project] = await db.select().from(projectsTable).where(and(eq(projectsTable.id, file.projectId), eq(projectsTable.userId, userId)));
  if (!project) {
    res.status(403).json({ error: "Forbidden", message: "Access denied" });
    return;
  }

  const [updated] = await db.update(mediaFilesTable).set({ uploadStatus: "pending", updatedAt: new Date() }).where(eq(mediaFilesTable.id, id)).returning();
  res.json(updated);
});

export default router;
