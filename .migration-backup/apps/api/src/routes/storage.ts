import { Router, type IRouter } from "express";
import { db, mediaFilesTable, projectsTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { requireAuth, requireOrganization, getOrganizationId } from "../lib/auth";
import { getTotalStorageBytes } from "../lib/storage";
import { getStorageDriver } from "../lib/storage/index";

const router: IRouter = Router();

router.get("/storage/status", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  const organizationId = getOrganizationId(req)!;

  const projects = await db.select().from(projectsTable).where(eq(projectsTable.organizationId, organizationId));
  const projectIds = projects.map((p) => p.id);

  let totalFiles = 0;
  let totalBytes = 0;

  for (const pid of projectIds) {
    const files = await db.select().from(mediaFilesTable).where(eq(mediaFilesTable.projectId, pid));
    totalFiles += files.length;
    totalBytes += files.reduce((acc, f) => acc + Number(f.fileSize), 0);
  }

  const driver = getStorageDriver();
  let status: "ok" | "misconfigured" = "ok";
  try {
    driver.assertConfigured();
  } catch {
    status = "misconfigured";
  }

  res.json({
    provider: driver.name,
    status,
    totalBytes,
    totalFiles,
    maxBytes: null,
  });
});

export default router;
