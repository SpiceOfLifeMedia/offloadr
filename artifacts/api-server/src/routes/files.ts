import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import os from "os";
import fs from "fs";
import { z } from "zod";
import { db, mediaFilesTable, projectsTable, editorSharesTable, organizationMembershipsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireOrganization, getUserId, getOrganizationId } from "../lib/auth";
import { canManageProjects, requireRole } from "../lib/permissions";
import { logActivity } from "../lib/activity";
import { detectFileType } from "../lib/storage";
import { parseBody } from "../lib/validate";
import { hasUsableStoragePath, sanitizeMediaFiles } from "../lib/legacyFiles";
import { getStorageDriver, NotFoundError } from "../lib/storage/index";
import { sendUploadNotification } from "../lib/uploadNotifier";
import { usersTable } from "@workspace/db";

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

router.get("/projects/:id/files", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  const organizationId = getOrganizationId(req)!;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [project] = await db.select().from(projectsTable).where(and(eq(projectsTable.id, id), eq(projectsTable.organizationId, organizationId)));
  if (!project) {
    res.status(404).json({ error: "Not Found", message: "Project not found" });
    return;
  }

  const files = await db.select().from(mediaFilesTable).where(eq(mediaFilesTable.projectId, id));
  res.json(sanitizeMediaFiles(files));
});

router.post("/projects/:id/files/upload", requireAuth, requireOrganization, requireRole(canManageProjects), upload.single("file"), async (req, res): Promise<void> => {
  const userId = getUserId(req)!;
  const organizationId = getOrganizationId(req)!;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const requestStartedAt = Date.now();

  const cleanupTmp = (): void => {
    if (req.file?.path) {
      fs.promises.unlink(req.file.path).catch(() => undefined);
    }
  };

  req.log.info(
    {
      projectId: id,
      userId,
      organizationId,
      fileName: req.file?.originalname,
      fileSizeBytes: req.file?.size,
      mimeType: req.file?.mimetype,
      spooledTo: req.file?.path,
    },
    "[upload] multer parse complete",
  );

  const [project] = await db.select().from(projectsTable).where(and(eq(projectsTable.id, id), eq(projectsTable.organizationId, organizationId)));
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

  const r2StartedAt = Date.now();
  req.log.info(
    { projectId: id, storageKey, fileSizeBytes: req.file.size },
    "[upload] r2 put start",
  );
  try {
    await getStorageDriver().upload(
      storageKey,
      fs.createReadStream(req.file.path),
      req.file.mimetype,
    );
    req.log.info(
      {
        projectId: id,
        storageKey,
        fileSizeBytes: req.file.size,
        r2DurationMs: Date.now() - r2StartedAt,
        totalDurationMs: Date.now() - requestStartedAt,
      },
      "[upload] r2 put done",
    );
  } catch (err) {
    // Pull AWS SDK / Node error metadata that pino's default err serializer
    // drops, so we can actually diagnose TLS / SigV4 / DNS failures.
    const e = err as { name?: string; code?: string; $fault?: string; $metadata?: { httpStatusCode?: number }; cause?: { code?: string; message?: string } } | null;
    const errName = e?.name ?? null;
    const errCode = e?.code ?? e?.cause?.code ?? null;
    const errFault = e?.$fault ?? null;
    const httpStatusCode = e?.$metadata?.httpStatusCode ?? null;
    const causeMessage = e?.cause?.message ?? null;
    const driver = getStorageDriver();
    const driverInfo = (driver as unknown as { describe?: () => unknown }).describe?.() ?? null;
    req.log.error(
      {
        err, errName, errCode, errFault, httpStatusCode, causeMessage, driverInfo,
        storageKey, fileSizeBytes: req.file.size,
        r2DurationMs: Date.now() - r2StartedAt,
        totalDurationMs: Date.now() - requestStartedAt,
      },
      "[upload] r2 put FAILED",
    );
    cleanupTmp();
    const message = err instanceof Error ? err.message : "Failed to store file";
    // Embed the diagnostics inline in the user-visible message because the
    // current frontend only renders `.message`. Verbose, but it's the
    // fastest way to actually see what the SDK is reaching for from a
    // screenshot. Strip later once the upload path is stable.
    const d = driverInfo as null | {
      endpointHost?: string | null; bucket?: string; region?: string; forcePathStyle?: boolean;
      accessKeyIdLength?: number; secretAccessKeyLength?: number;
      accessKeyIdLooksHex?: boolean; secretAccessKeyLooksHex?: boolean;
    };
    const diagLine = `[diag host=${d?.endpointHost ?? "?"} bucket=${d?.bucket ?? "?"} region=${d?.region ?? "?"} pathStyle=${d?.forcePathStyle ?? "?"} keyLen=${d?.accessKeyIdLength ?? "?"} keyHex=${d?.accessKeyIdLooksHex ?? "?"} secretLen=${d?.secretAccessKeyLength ?? "?"} secretHex=${d?.secretAccessKeyLooksHex ?? "?"} errName=${errName ?? "?"} errCode=${errCode ?? "?"} httpStatus=${httpStatusCode ?? "?"} fault=${errFault ?? "?"}${causeMessage ? ` cause="${causeMessage.slice(0, 120)}"` : ""}]`;
    res.status(500).json({
      error: "Internal Server Error",
      message: `Object storage upload failed: ${message} ${diagLine}`,
      diagnostics: { errName, errCode, errFault, httpStatusCode, causeMessage, driver: driverInfo },
    });
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

  // Fire-and-forget upload notification. Best-effort: any failure is
  // logged inside the notifier and never affects the upload response.
  void (async (): Promise<void> => {
    try {
      const [uploader] = await db
        .select({ name: usersTable.name, email: usersTable.email })
        .from(usersTable)
        .where(eq(usersTable.id, userId));
      const uploaderName =
        uploader?.name?.trim() || uploader?.email || `User #${userId}`;
      await sendUploadNotification({
        projectId: id,
        projectName: project.projectName,
        uploaderName,
        uploaderKind: "teacher",
        files: [
          {
            originalFileName: file.originalFileName,
            fileSizeBytes: file.fileSize ?? req.file?.size ?? 0,
            fileId: file.id,
          },
        ],
        uploadedAt: file.uploadedAt ?? new Date(),
      });
    } catch (err) {
      req.log.error({ err, projectId: id, fileId: file.id }, "[upload] notifier wrapper failed");
    }
  })();

  res.status(201).json(withUrl);
});

async function isAuthorizedForProject(
  projectId: number,
  userId: number | null,
  organizationId: number | null,
  shareToken: string | null,
): Promise<boolean> {
  // Session-based path: caller claims membership in `organizationId` via
  // their session. Don't take the session at its word — re-verify the
  // membership row exists right now. This closes the "user removed from
  // org but session cookie still valid" window.
  if (organizationId !== null && userId !== null) {
    const [membership] = await db
      .select({ id: organizationMembershipsTable.id })
      .from(organizationMembershipsTable)
      .where(
        and(
          eq(organizationMembershipsTable.userId, userId),
          eq(organizationMembershipsTable.organizationId, organizationId),
        ),
      );
    if (membership) {
      const [owned] = await db
        .select({ id: projectsTable.id })
        .from(projectsTable)
        .where(and(eq(projectsTable.id, projectId), eq(projectsTable.organizationId, organizationId)));
      if (owned) return true;
    }
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
  const organizationId = getOrganizationId(req);
  const shareTokenRaw = req.query["share"];
  const shareToken = typeof shareTokenRaw === "string" ? shareTokenRaw : null;

  const authorized = await isAuthorizedForProject(file.projectId, userId, organizationId, shareToken);
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
    const obj = await getStorageDriver().getObject(file.storagePath);
    res.setHeader("Content-Type", obj.contentType);
    if (typeof obj.size === "number") {
      res.setHeader("Content-Length", String(obj.size));
    }
    const dispositionName = file.originalFileName.replace(/"/g, "");
    res.setHeader("Content-Disposition", `attachment; filename="${dispositionName}"`);

    obj.stream.on("error", (err) => {
      req.log.error({ err, fileId: id }, "Error streaming file from object storage");
      if (!res.headersSent) {
        res.status(500).end();
      } else {
        res.destroy(err);
      }
    });
    obj.stream.pipe(res);
  } catch (err) {
    if (err instanceof NotFoundError) {
      res.status(404).json({ error: "Not Found", message: "File missing from storage" });
      return;
    }
    req.log.error({ err, fileId: id }, "Failed to fetch file from object storage");
    res.status(500).json({ error: "Internal Server Error", message: "Failed to fetch file" });
  }
});

router.patch("/files/:id", requireAuth, requireOrganization, requireRole(canManageProjects), async (req, res): Promise<void> => {
  const organizationId = getOrganizationId(req)!;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [file] = await db.select().from(mediaFilesTable).where(eq(mediaFilesTable.id, id));
  if (!file) {
    res.status(404).json({ error: "Not Found", message: "File not found" });
    return;
  }

  const [project] = await db.select().from(projectsTable).where(and(eq(projectsTable.id, file.projectId), eq(projectsTable.organizationId, organizationId)));
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

router.delete("/files/:id", requireAuth, requireOrganization, requireRole(canManageProjects), async (req, res): Promise<void> => {
  const userId = getUserId(req)!;
  const organizationId = getOrganizationId(req)!;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [file] = await db.select().from(mediaFilesTable).where(eq(mediaFilesTable.id, id));
  if (!file) {
    res.status(404).json({ error: "Not Found", message: "File not found" });
    return;
  }

  const [project] = await db.select().from(projectsTable).where(and(eq(projectsTable.id, file.projectId), eq(projectsTable.organizationId, organizationId)));
  if (!project) {
    res.status(403).json({ error: "Forbidden", message: "Access denied" });
    return;
  }

  if (file.storagePath) {
    try {
      await getStorageDriver().delete(file.storagePath);
    } catch (err) {
      req.log.warn({ err, fileId: id }, "Failed to delete object from storage; continuing");
    }
  }

  await db.delete(mediaFilesTable).where(eq(mediaFilesTable.id, id));
  await logActivity(file.projectId, "file_deleted", `File "${file.originalFileName}" deleted`, userId);

  res.json({ message: "File deleted" });
});

router.post("/files/:id/retry", requireAuth, requireOrganization, requireRole(canManageProjects), async (req, res): Promise<void> => {
  const organizationId = getOrganizationId(req)!;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [file] = await db.select().from(mediaFilesTable).where(eq(mediaFilesTable.id, id));
  if (!file) {
    res.status(404).json({ error: "Not Found", message: "File not found" });
    return;
  }

  const [project] = await db.select().from(projectsTable).where(and(eq(projectsTable.id, file.projectId), eq(projectsTable.organizationId, organizationId)));
  if (!project) {
    res.status(403).json({ error: "Forbidden", message: "Access denied" });
    return;
  }

  const [updated] = await db.update(mediaFilesTable).set({ uploadStatus: "pending", updatedAt: new Date() }).where(eq(mediaFilesTable.id, id)).returning();
  res.json(updated);
});

export default router;
