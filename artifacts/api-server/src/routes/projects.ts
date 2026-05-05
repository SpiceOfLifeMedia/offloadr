import { Router, type IRouter } from "express";
import { db, projectsTable, mediaFilesTable, participantsTable } from "@workspace/db";
import { eq, and, ilike, count, sum } from "drizzle-orm";
import { requireAuth, getUserId } from "../lib/auth";
import { logActivity } from "../lib/activity";

const router: IRouter = Router();

router.get("/projects", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req)!;
  const { status, search } = req.query as Record<string, string>;

  let query = db.select().from(projectsTable).where(eq(projectsTable.userId, userId));

  const projects = await db.select().from(projectsTable).where(eq(projectsTable.userId, userId));

  let filtered = projects;

  if (status) {
    filtered = filtered.filter((p) => p.status === status);
  }

  if (search) {
    const lower = search.toLowerCase();
    filtered = filtered.filter(
      (p) =>
        p.projectName.toLowerCase().includes(lower) ||
        (p.clientName ?? "").toLowerCase().includes(lower) ||
        (p.episodeTitle ?? "").toLowerCase().includes(lower),
    );
  }

  const enriched = await Promise.all(
    filtered.map(async (p) => {
      const files = await db.select().from(mediaFilesTable).where(eq(mediaFilesTable.projectId, p.id));
      const totalSize = files.reduce((acc, f) => acc + Number(f.fileSize), 0);
      return { ...p, fileCount: files.length, totalSize };
    }),
  );

  res.json(enriched);
});

router.post("/projects", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req)!;
  const { projectName, episodeTitle, clientName, recordingDate, description, editorNotes, expectedCameraCount, expectedAudioSetup } = req.body as Record<string, string | number>;

  if (!projectName) {
    res.status(400).json({ error: "Bad Request", message: "projectName is required" });
    return;
  }

  const [project] = await db.insert(projectsTable).values({
    userId,
    projectName: String(projectName),
    episodeTitle: episodeTitle ? String(episodeTitle) : null,
    clientName: clientName ? String(clientName) : null,
    recordingDate: recordingDate ? String(recordingDate) : null,
    description: description ? String(description) : null,
    editorNotes: editorNotes ? String(editorNotes) : null,
    expectedCameraCount: expectedCameraCount ? Number(expectedCameraCount) : null,
    expectedAudioSetup: expectedAudioSetup ? String(expectedAudioSetup) : null,
    status: "draft",
  }).returning();

  await logActivity(project.id, "project_created", `Project "${project.projectName}" created`, userId);

  res.status(201).json({ ...project, fileCount: 0, totalSize: 0 });
});

router.get("/projects/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req)!;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [project] = await db.select().from(projectsTable).where(and(eq(projectsTable.id, id), eq(projectsTable.userId, userId)));

  if (!project) {
    res.status(404).json({ error: "Not Found", message: "Project not found" });
    return;
  }

  const files = await db.select().from(mediaFilesTable).where(eq(mediaFilesTable.projectId, id));
  const totalSize = files.reduce((acc, f) => acc + Number(f.fileSize), 0);

  res.json({ ...project, fileCount: files.length, totalSize });
});

router.patch("/projects/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req)!;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [existing] = await db.select().from(projectsTable).where(and(eq(projectsTable.id, id), eq(projectsTable.userId, userId)));
  if (!existing) {
    res.status(404).json({ error: "Not Found", message: "Project not found" });
    return;
  }

  const updates: Record<string, unknown> = {};
  const allowed = ["projectName", "episodeTitle", "clientName", "recordingDate", "status", "description", "editorNotes", "expectedCameraCount", "expectedAudioSetup"];
  for (const key of allowed) {
    if (key in req.body) updates[key] = req.body[key];
  }
  updates["updatedAt"] = new Date();

  const [updated] = await db.update(projectsTable).set(updates as Parameters<typeof db.update>[0]).where(eq(projectsTable.id, id)).returning();

  const files = await db.select().from(mediaFilesTable).where(eq(mediaFilesTable.projectId, id));
  const totalSize = files.reduce((acc, f) => acc + Number(f.fileSize), 0);

  await logActivity(id, "project_updated", `Project updated`, userId);

  res.json({ ...updated, fileCount: files.length, totalSize });
});

router.delete("/projects/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req)!;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [existing] = await db.select().from(projectsTable).where(and(eq(projectsTable.id, id), eq(projectsTable.userId, userId)));
  if (!existing) {
    res.status(404).json({ error: "Not Found", message: "Project not found" });
    return;
  }

  await db.delete(projectsTable).where(eq(projectsTable.id, id));

  res.json({ message: "Project deleted" });
});

router.post("/projects/:id/mark-ready", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req)!;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [existing] = await db.select().from(projectsTable).where(and(eq(projectsTable.id, id), eq(projectsTable.userId, userId)));
  if (!existing) {
    res.status(404).json({ error: "Not Found", message: "Project not found" });
    return;
  }

  const [updated] = await db.update(projectsTable).set({ status: "ready_for_editor", updatedAt: new Date() }).where(eq(projectsTable.id, id)).returning();
  await logActivity(id, "status_changed", "Project marked ready for editor", userId);

  const files = await db.select().from(mediaFilesTable).where(eq(mediaFilesTable.projectId, id));
  const totalSize = files.reduce((acc, f) => acc + Number(f.fileSize), 0);
  res.json({ ...updated, fileCount: files.length, totalSize });
});

router.post("/projects/:id/mark-review", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req)!;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [existing] = await db.select().from(projectsTable).where(and(eq(projectsTable.id, id), eq(projectsTable.userId, userId)));
  if (!existing) {
    res.status(404).json({ error: "Not Found", message: "Project not found" });
    return;
  }

  const [updated] = await db.update(projectsTable).set({ status: "review_needed", updatedAt: new Date() }).where(eq(projectsTable.id, id)).returning();
  await logActivity(id, "status_changed", "Project marked as needing review", userId);

  const files = await db.select().from(mediaFilesTable).where(eq(mediaFilesTable.projectId, id));
  const totalSize = files.reduce((acc, f) => acc + Number(f.fileSize), 0);
  res.json({ ...updated, fileCount: files.length, totalSize });
});

router.post("/projects/:id/archive", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req)!;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [existing] = await db.select().from(projectsTable).where(and(eq(projectsTable.id, id), eq(projectsTable.userId, userId)));
  if (!existing) {
    res.status(404).json({ error: "Not Found", message: "Project not found" });
    return;
  }

  const [updated] = await db.update(projectsTable).set({ status: "archived", updatedAt: new Date() }).where(eq(projectsTable.id, id)).returning();
  await logActivity(id, "status_changed", "Project archived", userId);

  const files = await db.select().from(mediaFilesTable).where(eq(mediaFilesTable.projectId, id));
  const totalSize = files.reduce((acc, f) => acc + Number(f.fileSize), 0);
  res.json({ ...updated, fileCount: files.length, totalSize });
});

router.get("/projects/:id/missing-files", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req)!;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [project] = await db.select().from(projectsTable).where(and(eq(projectsTable.id, id), eq(projectsTable.userId, userId)));
  if (!project) {
    res.status(404).json({ error: "Not Found", message: "Project not found" });
    return;
  }

  const files = await db.select().from(mediaFilesTable).where(eq(mediaFilesTable.projectId, id));
  const roles = files.map((f) => f.mediaRole ?? "").filter(Boolean);

  const checklist = [
    { label: "Host audio", present: roles.some((r) => r.toLowerCase().includes("host")), required: true },
    { label: "Guest audio", present: roles.some((r) => r.toLowerCase().includes("guest")), required: false },
    { label: "Screen recording / slides", present: roles.some((r) => r.toLowerCase().includes("screen") || r.toLowerCase().includes("slide")), required: false },
    { label: "Camera footage", present: files.some((f) => f.fileType === "video"), required: false },
    { label: "Project file (Premiere/FCPX)", present: files.some((f) => f.fileType === "project_file"), required: false },
  ];

  const allPresent = checklist.filter((c) => c.required).every((c) => c.present);

  res.json({ items: checklist, allPresent });
});

router.get("/dashboard/stats", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req)!;
  const projects = await db.select().from(projectsTable).where(eq(projectsTable.userId, userId));
  const allFiles = await db
    .select()
    .from(mediaFilesTable)
    .where(
      eq(
        mediaFilesTable.projectId,
        db
          .select({ id: projectsTable.id })
          .from(projectsTable)
          .where(eq(projectsTable.userId, userId))
          .limit(1)
          .$dynamic(),
      ),
    );

  const projectIds = projects.map((p) => p.id);

  let totalFiles = 0;
  let totalStorageBytes = 0;
  const projectsByStatus: Record<string, number> = {};
  let activeUploads = 0;

  for (const p of projects) {
    projectsByStatus[p.status] = (projectsByStatus[p.status] ?? 0) + 1;
  }

  if (projectIds.length > 0) {
    const files = await db.select().from(mediaFilesTable);
    const myFiles = files.filter((f) => projectIds.includes(f.projectId));
    totalFiles = myFiles.length;
    totalStorageBytes = myFiles.reduce((acc, f) => acc + Number(f.fileSize), 0);
    activeUploads = myFiles.filter((f) => f.uploadStatus === "uploading").length;
  }

  const recentProjects = await Promise.all(
    projects
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)
      .map(async (p) => {
        const files = await db.select().from(mediaFilesTable).where(eq(mediaFilesTable.projectId, p.id));
        const totalSize = files.reduce((acc, f) => acc + Number(f.fileSize), 0);
        return { ...p, fileCount: files.length, totalSize };
      }),
  );

  res.json({
    totalProjects: projects.length,
    totalFiles,
    totalStorageBytes,
    projectsByStatus,
    recentProjects,
    activeUploads,
    readyForEditor: projectsByStatus["ready_for_editor"] ?? 0,
    reviewNeeded: projectsByStatus["review_needed"] ?? 0,
  });
});

export default router;
