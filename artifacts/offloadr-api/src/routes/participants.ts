import { Router, type IRouter } from "express";
import { z } from "zod";
import { db, participantsTable, projectsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, getUserId } from "../lib/auth";
import { logActivity } from "../lib/activity";
import { parseBody } from "../lib/validate";

const router: IRouter = Router();

const optionalNullableString = z
  .union([z.string(), z.null()])
  .optional();

const createParticipantSchema = z.object({
  name: z.string().trim().min(1, "name is required"),
  role: optionalNullableString,
  micLabel: optionalNullableString,
  notes: optionalNullableString,
});

const updateParticipantSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    role: optionalNullableString,
    micLabel: optionalNullableString,
    notes: optionalNullableString,
  })
  .strict();

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

  const body = parseBody(req, res, createParticipantSchema);
  if (!body) return;
  const { name, role, micLabel, notes } = body;

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

  const body = parseBody(req, res, updateParticipantSchema);
  if (!body) return;

  const updates: Partial<typeof participantsTable.$inferInsert> = { updatedAt: new Date() };
  if (body.name !== undefined) updates.name = body.name;
  if ("role" in body) updates.role = body.role ?? null;
  if ("micLabel" in body) updates.micLabel = body.micLabel ?? null;
  if ("notes" in body) updates.notes = body.notes ?? null;

  const [updated] = await db.update(participantsTable).set(updates).where(eq(participantsTable.id, id)).returning();
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
