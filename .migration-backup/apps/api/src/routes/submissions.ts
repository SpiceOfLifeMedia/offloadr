import { Router, type IRouter } from "express";
import { db, projectsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { requireAuth, requireOrganization, getUserId, getOrganizationId } from "../lib/auth";
import { canManageProjects, requireRole } from "../lib/permissions";
import { logActivity } from "../lib/activity";

const router: IRouter = Router();

type SubmissionStatus = "draft" | "needs_review" | "approved" | "rejected" | "exported";

// Allowed transitions for the submission state machine. Reject any other move.
const transitions: Record<SubmissionStatus, SubmissionStatus[]> = {
  draft: ["needs_review"],
  needs_review: ["approved", "rejected", "draft"],
  approved: ["exported", "needs_review"],
  rejected: ["draft", "needs_review"],
  exported: [],
};

async function loadProject(req: Parameters<typeof router.post>[1] extends never ? never : import("express").Request) {
  const organizationId = getOrganizationId(req)!;
  const raw = Array.isArray(req.params["id"]) ? req.params["id"][0] : req.params["id"];
  const id = parseInt(raw ?? "", 10);
  if (!Number.isFinite(id)) return { id: NaN, project: undefined as undefined };
  const [project] = await db.select().from(projectsTable).where(and(eq(projectsTable.id, id), eq(projectsTable.organizationId, organizationId)));
  return { id, project };
}

async function transition(req: import("express").Request, res: import("express").Response, next: SubmissionStatus, label: string): Promise<void> {
  const userId = getUserId(req)!;
  const { id, project } = await loadProject(req);
  if (!project) {
    res.status(404).json({ error: "Not Found", message: "Project not found" });
    return;
  }
  const current = project.submissionStatus as SubmissionStatus;
  if (!transitions[current].includes(next)) {
    req.log?.warn?.({ projectId: id, current, next }, "Rejected submission transition");
    res.status(409).json({ error: "Conflict", message: `Cannot transition from ${current} to ${next}` });
    return;
  }
  const [updated] = await db
    .update(projectsTable)
    .set({ submissionStatus: next, updatedAt: new Date() })
    .where(eq(projectsTable.id, id))
    .returning();
  await logActivity(id, "submission_status_changed", `${label} (${current} → ${next})`, userId);
  res.json(updated);
}

// Students/teachers submit their work for teacher review.
router.post("/projects/:id/submit", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  await transition(req, res, "needs_review", "Submitted for review");
});

// Teachers approve a submitted project. Approval is required before final render.
router.post("/projects/:id/approve", requireAuth, requireOrganization, requireRole(canManageProjects), async (req, res): Promise<void> => {
  await transition(req, res, "approved", "Project approved");
});

// Teachers reject and send back to the student.
router.post("/projects/:id/reject", requireAuth, requireOrganization, requireRole(canManageProjects), async (req, res): Promise<void> => {
  await transition(req, res, "rejected", "Project rejected");
});

// Reopen a rejected/needs_review project back to draft.
router.post("/projects/:id/reopen", requireAuth, requireOrganization, requireRole(canManageProjects), async (req, res): Promise<void> => {
  await transition(req, res, "draft", "Project reopened");
});

export default router;
