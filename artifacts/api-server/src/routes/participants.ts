import { Router, type IRouter } from "express";
import { db, participantsTable, projectsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, getUserId } from "../lib/auth";
import { logActivity } from "../lib/activity";

const router: IRouter = Router();

router.get("/projects/:id/participants", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req)!;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [project] = await db.select().from(projectsTable).where(and(eq(projectsTable.id, id), eq(projectsTable.userId, userId)));
  if (!project) {
    res.status(404).json({ error: "Not Found", message: "Project not found" });
    return;
  }

  const participants = await db.select().from(participantsTable).where(eq(participantsTable.projectId, id));
  res.json(participants);
});

router.post("/projects/:id/participants", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req)!;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [project] = await db.select().from(projectsTable).where(and(eq(projectsTable.id, id), eq(projectsTable.userId, userId)));
  if (!project) {
    res.status(404).json({ error: "Not Found", message: "Project not found" });
    return;
  }

  const { name, role, micLabel, notes } = req.body as Record<string, string>;
  if (!name) {
    res.status(400).json({ error: "Bad Request", message: "name is required" });
    return;
  }

  const [participant] = await db.insert(participantsTable).values({
    projectId: id,
    name,
    role: role ?? null,
    micLabel: micLabel ?? null,
    notes: notes ?? null,
  }).returning();

  await logActivity(id, "participant_added", `Participant "${name}" added`, userId);

  res.status(201).json(participant);
});

router.patch("/participants/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req)!;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [participant] = await db.select().from(participantsTable).where(eq(participantsTable.id, id));
  if (!participant) {
    res.status(404).json({ error: "Not Found", message: "Participant not found" });
    return;
  }

  const [project] = await db.select().from(projectsTable).where(and(eq(projectsTable.id, participant.projectId), eq(projectsTable.userId, userId)));
  if (!project) {
    res.status(403).json({ error: "Forbidden", message: "Access denied" });
    return;
  }

  const updates: Record<string, unknown> = {};
  for (const key of ["name", "role", "micLabel", "notes"]) {
    if (key in req.body) updates[key] = req.body[key];
  }
  updates["updatedAt"] = new Date();

  const [updated] = await db.update(participantsTable).set(updates as Parameters<typeof db.update>[0]).where(eq(participantsTable.id, id)).returning();
  res.json(updated);
});

router.delete("/participants/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req)!;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [participant] = await db.select().from(participantsTable).where(eq(participantsTable.id, id));
  if (!participant) {
    res.status(404).json({ error: "Not Found", message: "Participant not found" });
    return;
  }

  const [project] = await db.select().from(projectsTable).where(and(eq(projectsTable.id, participant.projectId), eq(projectsTable.userId, userId)));
  if (!project) {
    res.status(403).json({ error: "Forbidden", message: "Access denied" });
    return;
  }

  await db.delete(participantsTable).where(eq(participantsTable.id, id));
  await logActivity(participant.projectId, "participant_removed", `Participant "${participant.name}" removed`, userId);

  res.json({ message: "Participant deleted" });
});

export default router;
