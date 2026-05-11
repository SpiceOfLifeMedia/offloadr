import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import os from "os";
import fs from "fs";
import { pipeline } from "stream/promises";
import { z } from "zod";
import { db, mediaFilesTable, projectsTable, editorSharesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, getUserId } from "../lib/auth";
import { logActivity } from "../lib/activity";
import { detectFileType } from "../lib/storage";
import { parseBody } from "../lib/validate";
import { hasUsableStoragePath, sanitizeMediaFiles } from "../lib/legacyFiles";
import {
  createStorageWriteStream,
  deleteFromStorage,
  getStorageFile,
  streamStorageFile,
  ObjectNotFoundError,
} from "../lib/objectStorage";

const optionalNullableString = z
  .union([z.string(), z.null()])
  .optional();

const uploadMetadataSchema = z.object({
  mediaRole: optionalNullableString,
  notes: optionalNullableString,
});

const updateFileSchema = z
  .object({
    mediaRole: optionalNullableString,
    notes: optionalNullableString,
    cleanFileName: optionalNullableString,
  })
  .strict();

const TMP_UPLOAD_DIR = path.join(os.tmpdir(), "offloadr-uploads");
fs.mkdirSync(TMP_UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, TMP_UPLOAD_DIR),
    filename: (_req, _file, cb) => cb(null, `${Date.now()}_${Math.random().toString(36).slice(2)}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 * 1024 },
});

const API_MOUNT_PATH = process.env["API_MOUNT_PATH"] ?? "/api";

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
  res.json(sanitizeMediaFiles(files));
});

router.post("/projects/:id/files/upload", requireAuth, upload.single("file"), async (req, res): Promise<void> => {
  const userId = getUserId(req)!;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const cleanupTmp = (): void => {
    if (req.file?.path) {
      fs.promises.unlink(req.file.path).catch(() => undefined);
    }
  };

  const [project] = await db.select().from(projectsTable).where(and(eq(projectsTable.id, id), eq(projectsTable.userId, userId)));
  if (!project) {
    cleanupTmp();
    res.status(404).json({ error: "Not Found", message: "Project not found" });
    return;
  }

  if (!req.file) {
    res.status(400).json({ error: "Bad Request", message: "No file uploaded" });
    return;
  }

  const fileType = detectFileType(req.file.mimetype);
  const metadata = uploadMetadataSchema.safeParse(req.body);
  if (!metadata.success) {
    cleanupTmp();
    res.status(400).json({
      error: "Bad Request",
      message: "Invalid upload metadata",
      issues: metadata.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
    return;
  }
  const mediaRole = metadata.data.mediaRole ?? null;
  const notes = metadata.data.notes ?? null;

  const timestamp = Date.now();
  const ext = path.extname(req.file.originalname);
  const base = path.basename(req.file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, "_");
  const storageKey = `offloadr/projects/${id}/${timestamp}_${base}${ext}`;

  try {
    await pipeline(
      fs.createReadStream(req.file.path),
      createStorageWriteStream(storageKey, req.file.mimetype),
    );
  } catch (err) {
    req.log.error({ err, storageKey }, "Failed to upload file to object storage");
    cleanupTmp();
    res.status(500).json({ error: "Internal Server Error", message: "Failed to store file" });
    return;
  } finally {
    cleanupTmp();
  }

  const [file] = await db.insert(mediaFilesTable).values({
    projectId: id,
    originalFileName: req.file.originalname,
    cleanFileName: null,
    fileType,
    mediaRole: mediaRole ?? null,
    fileSize: req.file.size,
    uploadStatus: "uploaded",
    storagePath: storageKey,
    publicUrl: null,
    notes: notes ?? null,
    uploadedAt: new Date(),
  }).returning();

  if (!file) {
    res.status(500).json({ error: "Internal Server Error", message: "Failed to record file" });
    return;
  }

  const [withUrl] = await db
    .update(mediaFilesTable)
    .set({ publicUrl: `${API_MOUNT_PATH}/files/${file.id}/download` })
    .where(eq(mediaFilesTable.id, file.id))
    .returning();

  await logActivity(id, "file_uploaded", `File "${req.file.originalname}" uploaded`, userId);

  if (project.status === "draft") {
    await db.update(projectsTable).set({ status: "uploading", updatedAt: new Date() }).where(eq(projectsTable.id, id));
  }

  res.status(201).json(withUrl);
});

async function isAuthorizedForProject(
  projectId: number,
  userId: number | null,
  shareToken: string | null,
): Promise<boolean> {
  if (userId !== null) {
    const [owned] = await db
      .select({ id: projectsTable.id })
      .from(projectsTable)
      .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, userId)));
    if (owned) return true;
  }

  if (shareToken && /^[A-Za-z0-9]+$/.test(shareToken) && shareToken.length <= 128) {
    const [share] = await db
      .select()
      .from(editorSharesTable)
      .where(and(eq(editorSharesTable.shareToken, shareToken), eq(editorSharesTable.projectId, projectId)));
    if (share && share.isActive) {
      if (!share.expiresAt || new Date(share.expiresAt) > new Date()) {
        return true;
      }
    }
  }

  return false;
}

// Backward-compat: pre-object-storage rows have publicUrl values like
// `/api/files/download/<localFilename>` whose bytes were lost when the API
// was redeployed. Return 410 Gone with a clear message instead of a generic
// 404 so any UI hitting an old link can surface a useful error.
router.get("/files/download/:filename", (_req, res): void => {
  res.status(410).json({
    error: "Gone",
    message:
      "This file was uploaded before Offloadr moved to durable storage and is no longer available. Please re-upload it.",
  });
});

router.get("/files/:id/download", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Bad Request", message: "Invalid file id" });
    return;
  }

  const [file] = await db.select().from(mediaFilesTable).where(eq(mediaFilesTable.id, id));
  if (!file) {
    res.status(404).json({ error: "Not Found", message: "File not found" });
    return;
  }

  const userId = getUserId(req);
  const shareTokenRaw = req.query["share"];
  const shareToken = typeof shareTokenRaw === "string" ? shareTokenRaw : null;

  const authorized = await isAuthorizedForProject(file.projectId, userId, shareToken);
  if (!authorized) {
    res.status(404).json({ error: "Not Found", message: "File not found" });
    return;
  }

  if (!hasUsableStoragePath(file.storagePath)) {
    res.status(410).json({
      error: "Gone",
      message:
        "This file was uploaded before Offloadr moved to durable storage and is no longer available. Please re-upload it.",
    });
    return;
  }

  try {
    const gcsFile = await getStorageFile(file.storagePath);
    const [metadata] = await gcsFile.getMetadata();
    const contentType = (metadata.contentType as string) || "application/octet-stream";
    res.setHeader("Content-Type", contentType);
    if (metadata.size) {
      res.setHeader("Content-Length", String(metadata.size));
    }
    const dispositionName = file.originalFileName.replace(/"/g, "");
    res.setHeader("Content-Disposition", `attachment; filename="${dispositionName}"`);

    const stream = streamStorageFile(gcsFile);
    stream.on("error", (err) => {
      req.log.error({ err, fileId: id }, "Error streaming file from object storage");
      if (!res.headersSent) {
        res.status(500).end();
      } else {
        res.destroy(err);
      }
    });
    stream.pipe(res);
  } catch (err) {
    if (err instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Not Found", message: "File missing from storage" });
      return;
    }
    req.log.error({ err, fileId: id }, "Failed to fetch file from object storage");
    res.status(500).json({ error: "Internal Server Error", message: "Failed to fetch file" });
  }
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

  const body = parseBody(req, res, updateFileSchema);
  if (!body) return;
  const updates: Partial<typeof mediaFilesTable.$inferInsert> = { updatedAt: new Date() };
  if ("mediaRole" in body) updates.mediaRole = body.mediaRole ?? null;
  if ("notes" in body) updates.notes = body.notes ?? null;
  if ("cleanFileName" in body) updates.cleanFileName = body.cleanFileName ?? null;

  const [updated] = await db.update(mediaFilesTable).set(updates).where(eq(mediaFilesTable.id, id)).returning();
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
    try {
      await deleteFromStorage(file.storagePath);
    } catch (err) {
      req.log.warn({ err, fileId: id }, "Failed to delete object from storage; continuing");
    }
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
