import { Router, type IRouter } from "express";
import { z } from "zod";
import { db, projectsTable, mediaFilesTable, participantsTable, studentUploadCodesTable } from "@workspace/db";
import { eq, and, ilike, count, sum, desc } from "drizzle-orm";
import { requireAuth, requireOrganization, getUserId, getOrganizationId } from "../lib/auth";
import { canManageProjects, requireRole } from "../lib/permissions";
import { logActivity } from "../lib/activity";
import { parseBody } from "../lib/validate";
import { generateStudentUploadCode } from "../lib/studentCodeGenerator";

const router: IRouter = Router();

const projectStatusSchema = z.enum([
  "draft",
  "uploading",
  "ready_for_editor",
  "review_needed",
  "archived",
]);

// V1 workflow types. Keep in sync with the DB enum
// (lib/db/src/schema/projects.ts → projectWorkflowTypeEnum) and the
// frontend catalogue (artifacts/offloadr-app/src/lib/workflow-tags.ts).
// Extending the union is a non-breaking change as long as the DB enum
// is extended first.
const projectWorkflowTypeSchema = z.enum([
  "podcast_studio",
  "general_video",
]);

const optionalNullableString = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) => (v === undefined ? undefined : v));

const optionalNullableInt = z
  .union([z.number().int(), z.null()])
  .optional();

const createProjectSchema = z.object({
  projectName: z.string().trim().min(1, "projectName is required"),
  episodeTitle: optionalNullableString,
  clientName: optionalNullableString,
  recordingDate: optionalNullableString,
  description: optionalNullableString,
  editorNotes: optionalNullableString,
  expectedCameraCount: z
    .preprocess(
      (v) => (typeof v === "string" && /^-?\d+$/.test(v) ? Number(v) : v),
      z.union([z.number().int(), z.null()]).optional(),
    ),
  expectedAudioSetup: optionalNullableString,
  classGroup: optionalNullableString,
  lessonType: optionalNullableString,
  studentInstructions: optionalNullableString,
  uploadMethod: optionalNullableString,
  dueDate: optionalNullableString,
  projectWorkflowType: projectWorkflowTypeSchema.optional(),
});

const updateProjectSchema = z
  .object({
    projectName: z.string().trim().min(1).optional(),
    episodeTitle: optionalNullableString,
    clientName: optionalNullableString,
    recordingDate: optionalNullableString,
    status: projectStatusSchema.optional(),
    description: optionalNullableString,
    editorNotes: optionalNullableString,
    expectedCameraCount: optionalNullableInt,
    expectedAudioSetup: optionalNullableString,
    classGroup: optionalNullableString,
    lessonType: optionalNullableString,
    studentInstructions: optionalNullableString,
    uploadMethod: optionalNullableString,
    dueDate: optionalNullableString,
    projectWorkflowType: projectWorkflowTypeSchema.optional(),
  })
  .strict();

router.get("/projects", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  const organizationId = getOrganizationId(req)!;
  const { status, search } = req.query as Record<string, string>;

  const projects = await db.select().from(projectsTable).where(eq(projectsTable.organizationId, organizationId));

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

router.post("/projects", requireAuth, requireOrganization, requireRole(canManageProjects), async (req, res): Promise<void> => {
  const userId = getUserId(req)!;
  const organizationId = getOrganizationId(req)!;
  const body = parseBody(req, res, createProjectSchema);
  if (!body) return;
  const {
    projectName,
    episodeTitle,
    clientName,
    recordingDate,
    description,
    editorNotes,
    expectedCameraCount,
    expectedAudioSetup,
    classGroup,
    lessonType,
    studentInstructions,
    uploadMethod,
    dueDate,
    projectWorkflowType,
  } = body;

  const [project] = await db.insert(projectsTable).values({
    userId,
    organizationId,
    projectName,
    episodeTitle: episodeTitle ?? null,
    clientName: clientName ?? null,
    recordingDate: recordingDate ?? null,
    description: description ?? null,
    editorNotes: editorNotes ?? null,
    expectedCameraCount: (expectedCameraCount as number | null | undefined) ?? null,
    expectedAudioSetup: expectedAudioSetup ?? null,
    classGroup: classGroup ?? null,
    lessonType: lessonType ?? null,
    studentInstructions: studentInstructions ?? null,
    uploadMethod: uploadMethod ?? null,
    dueDate: dueDate ?? null,
    // Column has a DB default of 'general_video' — only override when
    // the teacher explicitly picked something during create.
    ...(projectWorkflowType ? { projectWorkflowType } : {}),
    status: "draft",
  }).returning();

  await logActivity(project.id, "project_created", `Project "${project.projectName}" created`, userId);

  // If the teacher chose "students upload with a code", auto-create one
  // upload code in the same request so the success screen can show a
  // ready-to-share link without a second click. Idempotent by design:
  // if an active code already exists (shouldn't on a brand-new project,
  // but cheap to check), reuse it instead of generating a duplicate.
  let uploadCode: string | null = null;
  if (uploadMethod === "student_codes") {
    try {
      const [existing] = await db
        .select({ code: studentUploadCodesTable.code })
        .from(studentUploadCodesTable)
        .where(
          and(
            eq(studentUploadCodesTable.projectId, project.id),
            eq(studentUploadCodesTable.status, "active"),
          ),
        )
        .orderBy(desc(studentUploadCodesTable.createdAt))
        .limit(1);

      if (existing) {
        uploadCode = existing.code;
      } else {
        let candidate: string | null = null;
        for (let attempt = 0; attempt < 8; attempt++) {
          const c = generateStudentUploadCode();
          const [collision] = await db
            .select({ id: studentUploadCodesTable.id })
            .from(studentUploadCodesTable)
            .where(eq(studentUploadCodesTable.code, c))
            .limit(1);
          if (!collision) {
            candidate = c;
            break;
          }
        }
        if (!candidate) {
          throw new Error("Failed to allocate a unique student upload code after 8 attempts");
        }

        await db.insert(studentUploadCodesTable).values({
          projectId: project.id,
          organizationId,
          code: candidate,
          status: "active",
          maxUploads: null,
          expiresAt: null,
          createdByUserId: userId,
        });
        uploadCode = candidate;

        await logActivity(
          project.id,
          "student_upload_code_created",
          `Student upload code ${candidate} created automatically with project`,
          userId,
        );
      }
    } catch (err) {
      // Don't fail the whole project create — the teacher can still
      // generate a code manually from the project page. Log loudly
      // so we notice if this ever starts failing.
      req.log.error(
        { err, projectId: project.id },
        "Auto-create of student upload code failed; project created without code",
      );
    }
  }

  res.status(201).json({ ...project, fileCount: 0, totalSize: 0, uploadCode });
});

router.get("/projects/:id", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  const organizationId = getOrganizationId(req)!;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [project] = await db.select().from(projectsTable).where(and(eq(projectsTable.id, id), eq(projectsTable.organizationId, organizationId)));

  if (!project) {
    res.status(404).json({ error: "Not Found", message: "Project not found" });
    return;
  }

  const files = await db.select().from(mediaFilesTable).where(eq(mediaFilesTable.projectId, id));
  const totalSize = files.reduce((acc, f) => acc + Number(f.fileSize), 0);

  res.json({ ...project, fileCount: files.length, totalSize });
});

router.patch("/projects/:id", requireAuth, requireOrganization, requireRole(canManageProjects), async (req, res): Promise<void> => {
  const userId = getUserId(req)!;
  const organizationId = getOrganizationId(req)!;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [existing] = await db.select().from(projectsTable).where(and(eq(projectsTable.id, id), eq(projectsTable.organizationId, organizationId)));
  if (!existing) {
    res.status(404).json({ error: "Not Found", message: "Project not found" });
    return;
  }

  const body = parseBody(req, res, updateProjectSchema);
  if (!body) return;

  const updates: Partial<typeof projectsTable.$inferInsert> = { updatedAt: new Date() };
  if (body.projectName !== undefined) updates.projectName = body.projectName;
  if ("episodeTitle" in body) updates.episodeTitle = body.episodeTitle ?? null;
  if ("clientName" in body) updates.clientName = body.clientName ?? null;
  if ("recordingDate" in body) updates.recordingDate = body.recordingDate ?? null;
  if (body.status !== undefined) updates.status = body.status;
  if ("description" in body) updates.description = body.description ?? null;
  if ("editorNotes" in body) updates.editorNotes = body.editorNotes ?? null;
  if ("expectedCameraCount" in body) updates.expectedCameraCount = body.expectedCameraCount ?? null;
  if ("expectedAudioSetup" in body) updates.expectedAudioSetup = body.expectedAudioSetup ?? null;
  if ("classGroup" in body) updates.classGroup = body.classGroup ?? null;
  if ("lessonType" in body) updates.lessonType = body.lessonType ?? null;
  if ("studentInstructions" in body) updates.studentInstructions = body.studentInstructions ?? null;
  if ("uploadMethod" in body) updates.uploadMethod = body.uploadMethod ?? null;
  if ("dueDate" in body) updates.dueDate = body.dueDate ?? null;
  // projectWorkflowType is non-nullable in the DB; only set when the
  // client explicitly sent a value. Zod already restricts it to the
  // enum, so any defined value is safe to write directly.
  if (body.projectWorkflowType !== undefined) {
    updates.projectWorkflowType = body.projectWorkflowType;
  }

  const [updated] = await db.update(projectsTable).set(updates).where(eq(projectsTable.id, id)).returning();

  const files = await db.select().from(mediaFilesTable).where(eq(mediaFilesTable.projectId, id));
  const totalSize = files.reduce((acc, f) => acc + Number(f.fileSize), 0);

  await logActivity(id, "project_updated", `Project updated`, userId);

  res.json({ ...updated, fileCount: files.length, totalSize });
});

router.delete("/projects/:id", requireAuth, requireOrganization, requireRole(canManageProjects), async (req, res): Promise<void> => {
  const organizationId = getOrganizationId(req)!;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [existing] = await db.select().from(projectsTable).where(and(eq(projectsTable.id, id), eq(projectsTable.organizationId, organizationId)));
  if (!existing) {
    res.status(404).json({ error: "Not Found", message: "Project not found" });
    return;
  }

  await db.delete(projectsTable).where(eq(projectsTable.id, id));

  res.json({ message: "Project deleted" });
});

router.post("/projects/:id/mark-ready", requireAuth, requireOrganization, requireRole(canManageProjects), async (req, res): Promise<void> => {
  const userId = getUserId(req)!;
  const organizationId = getOrganizationId(req)!;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [existing] = await db.select().from(projectsTable).where(and(eq(projectsTable.id, id), eq(projectsTable.organizationId, organizationId)));
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

router.post("/projects/:id/mark-review", requireAuth, requireOrganization, requireRole(canManageProjects), async (req, res): Promise<void> => {
  const userId = getUserId(req)!;
  const organizationId = getOrganizationId(req)!;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [existing] = await db.select().from(projectsTable).where(and(eq(projectsTable.id, id), eq(projectsTable.organizationId, organizationId)));
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

router.post("/projects/:id/archive", requireAuth, requireOrganization, requireRole(canManageProjects), async (req, res): Promise<void> => {
  const userId = getUserId(req)!;
  const organizationId = getOrganizationId(req)!;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [existing] = await db.select().from(projectsTable).where(and(eq(projectsTable.id, id), eq(projectsTable.organizationId, organizationId)));
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

router.get("/projects/:id/missing-files", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  const organizationId = getOrganizationId(req)!;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [project] = await db.select().from(projectsTable).where(and(eq(projectsTable.id, id), eq(projectsTable.organizationId, organizationId)));
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

router.get("/dashboard/stats", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  const organizationId = getOrganizationId(req)!;
  const projects = await db.select().from(projectsTable).where(eq(projectsTable.organizationId, organizationId));

  const projectIds = projects.map((p) => p.id);
  const projectsByStatus: Record<string, number> = {};

  for (const p of projects) {
    projectsByStatus[p.status] = (projectsByStatus[p.status] ?? 0) + 1;
  }

  let totalFiles = 0;
  let totalStorageBytes = 0;
  let activeUploads = 0;
  const filesByProject: Record<number, typeof mediaFilesTable.$inferSelect[]> = {};

  if (projectIds.length > 0) {
    const allFiles = await db.select().from(mediaFilesTable);
    const myFiles = allFiles.filter((f) => projectIds.includes(f.projectId));
    totalFiles = myFiles.length;
    totalStorageBytes = myFiles.reduce((acc, f) => acc + Number(f.fileSize), 0);
    activeUploads = myFiles.filter((f) => f.uploadStatus === "uploading").length;
    for (const f of myFiles) {
      if (!filesByProject[f.projectId]) filesByProject[f.projectId] = [];
      filesByProject[f.projectId]!.push(f);
    }
  }

  const sortedProjects = [...projects].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const recentProjects = sortedProjects.slice(0, 5).map((p) => {
    const files = filesByProject[p.id] ?? [];
    const totalSize = files.reduce((acc, f) => acc + Number(f.fileSize), 0);
    return { ...p, fileCount: files.length, totalSize };
  });

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
