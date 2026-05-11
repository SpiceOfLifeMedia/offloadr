import { Router, type IRouter } from "express";
import { db, mediaFilesTable, projectsTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { requireAuth, getUserId } from "../lib/auth";
import { getTotalStorageBytes } from "../lib/storage";

const router: IRouter = Router();

router.get("/storage/status", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req)!;

  const projects = await db.select().from(projectsTable).where(eq(projectsTable.userId, userId));
  const projectIds = projects.map((p) => p.id);

  let totalFiles = 0;
  let totalBytes = 0;

  for (const pid of projectIds) {
    const files = await db.select().from(mediaFilesTable).where(eq(mediaFilesTable.projectId, pid));
    totalFiles += files.length;
    totalBytes += files.reduce((acc, f) => acc + Number(f.fileSize), 0);
  }

  res.json({
    provider: "local",
    status: "ok",
    totalBytes,
    totalFiles,
    maxBytes: null,
  });
});

export default router;
