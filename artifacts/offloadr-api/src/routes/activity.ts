import { Router, type IRouter } from "express";
import { db, activityLogsTable, projectsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, getUserId } from "../lib/auth";

const router: IRouter = Router();

router.get("/projects/:id/activity", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req)!;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [project] = await db.select().from(projectsTable).where(and(eq(projectsTable.id, id), eq(projectsTable.userId, userId)));
  if (!project) {
    res.status(404).json({ error: "Not Found", message: "Project not found" });
    return;
  }

  const logs = await db
    .select()
    .from(activityLogsTable)
    .where(eq(activityLogsTable.projectId, id))
    .orderBy(desc(activityLogsTable.createdAt))
    .limit(50);

  res.json(logs);
});

export default router;
