import { Router, type IRouter } from "express";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import archiver from "archiver";
import { db, editorSharesTable, projectsTable, mediaFilesTable, participantsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireOrganization, getUserId, getOrganizationId } from "../lib/auth";
import { canManageProjects, requireRole } from "../lib/permissions";
import { logActivity } from "../lib/activity";
import { parseBody } from "../lib/validate";
import { sanitizeMediaFiles, hasUsableStoragePath } from "../lib/legacyFiles";
import { getStorageDriver } from "../lib/storage/index";

const router: IRouter = Router();

const createShareSchema = z.object({
  expiresAt: z
    .union([
      z
        .string()
        .datetime({ offset: true, message: "expiresAt must be an ISO 8601 datetime" }),
      z.null(),
    ])
    .optional(),
});

router.post("/projects/:id/share", requireAuth, requireOrganization, requireRole(canManageProjects), async (req, res): Promise<void> => {
  const userId = getUserId(req)!;
  const organizationId = getOrganizationId(req)!;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [project] = await db.select().from(projectsTable).where(and(eq(projectsTable.id, id), eq(projectsTable.organizationId, organizationId)));
  if (!project) {
    res.status(404).json({ error: "Not Found", message: "Project not found" });
    return;
  }

  const body = parseBody(req, res, createShareSchema);
  if (!body) return;
  const { expiresAt } = body;

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

  const rawFiles = await db.select().from(mediaFilesTable).where(eq(mediaFilesTable.projectId, project.id));
  const files = sanitizeMediaFiles(rawFiles);
  const totalSize = files.reduce((acc, f) => acc + Number(f.fileSize), 0);

  const participants = await db.select().from(participantsTable).where(eq(participantsTable.projectId, project.id));

  res.json({
    project: { ...project, fileCount: files.length, totalSize },
    files,
    participants,
    share,
  });
});

// Stream a ZIP of all available files in the project, organised by folder.
// Public — gated by share token only. Missing/legacy files are skipped.
router.get("/share/:token/download-all", async (req, res): Promise<void> => {
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

  const rawFiles = await db.select().from(mediaFilesTable).where(eq(mediaFilesTable.projectId, project.id));
  const files = sanitizeMediaFiles(rawFiles).filter((f) => !f.isMissing && hasUsableStoragePath(f.storagePath));

  if (files.length === 0) {
    res.status(404).json({ error: "Not Found", message: "No downloadable files in this project" });
    return;
  }

  const folderFor = (type: string): string => {
    switch (type) {
      case "audio": return "01_AUDIO";
      case "video": return "02_VIDEO";
      case "project_file": return "03_PROJECT_FILES";
      case "export": return "04_EXPORTS";
      case "document": return "05_NOTES";
      default: return "06_OTHER";
    }
  };

  const safe = (s: string): string => s.replace(/[/\\?%*:|"<>]/g, "_");
  const zipName = `${safe(project.projectName || `project-${project.id}`)}.zip`;

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${zipName}"`);

  const archive = archiver("zip", { zlib: { level: 0 } });
  archive.on("error", (err) => {
    req.log.error({ err, projectId: project.id }, "ZIP stream error");
    if (!res.headersSent) {
      res.status(500).end();
    } else {
      res.destroy(err);
    }
  });
  archive.pipe(res);

  const driver = getStorageDriver();
  for (const file of files) {
    try {
      const obj = await driver.getObject(file.storagePath as string);
      const folder = folderFor(file.fileType);
      const name = safe(file.originalFileName);
      archive.append(obj.stream, { name: `${folder}/${name}` });
    } catch (err) {
      req.log.warn({ err, fileId: file.id }, "Skipping file in ZIP — fetch failed");
    }
  }

  await archive.finalize();
});

router.patch("/share/:token/disable", requireAuth, requireOrganization, requireRole(canManageProjects), async (req, res): Promise<void> => {
  const userId = getUserId(req)!;
  const organizationId = getOrganizationId(req)!;
  const raw = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
  const token = raw;

  const [share] = await db.select().from(editorSharesTable).where(eq(editorSharesTable.shareToken, token));
  if (!share) {
    res.status(404).json({ error: "Not Found", message: "Share not found" });
    return;
  }

  const [project] = await db.select().from(projectsTable).where(and(eq(projectsTable.id, share.projectId), eq(projectsTable.organizationId, organizationId)));
  if (!project) {
    res.status(403).json({ error: "Forbidden", message: "Access denied" });
    return;
  }

  await db.update(editorSharesTable).set({ isActive: false }).where(eq(editorSharesTable.shareToken, token));
  await logActivity(share.projectId, "share_disabled", "Editor share link disabled", userId);

  res.json({ message: "Share link disabled" });
});

export default router;
