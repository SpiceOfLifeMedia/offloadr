import { Router, type IRouter } from "express";
import { requireAuth, requireOrganization } from "../lib/auth";
import {
  checkRcloneInstalled,
  getRcloneRemoteConfig,
  startRcloneCopy,
  getJob,
  listJobs,
  cancelRcloneJob,
} from "../lib/rclone";

const router: IRouter = Router();

/**
 * GET /rclone/status
 *
 * Returns rclone installation info and whether the remote is configured.
 * Never returns the rclone config file contents or any credentials.
 */
router.get("/rclone/status", requireAuth, async (_req, res): Promise<void> => {
  const [install, config] = await Promise.all([
    checkRcloneInstalled(),
    Promise.resolve(getRcloneRemoteConfig()),
  ]);

  res.json({
    installed: install.ok,
    version: install.version ?? null,
    installError: install.error ?? null,
    configured: config !== null,
    // Only expose the remote name and path — never credentials or config file
    remoteName: config?.remoteName ?? null,
    remotePath: config?.remotePath ?? null,
  });
});

/**
 * POST /rclone/jobs
 *
 * Start a new rclone copy from the local storage folder to the configured remote.
 * Body (optional JSON):
 *   { subPath?: string, extraFlags?: string[] }
 *
 * Returns: { jobId: string }
 */
router.post("/rclone/jobs", requireAuth, requireOrganization, (req, res): void => {
  const body = (req.body ?? {}) as { subPath?: unknown; extraFlags?: unknown };

  const subPath =
    typeof body.subPath === "string" && body.subPath.trim() ? body.subPath.trim() : undefined;

  // Only accept an allowlist of known-safe extra flags from the request body.
  // Raw --config / credential flags are stripped inside startRcloneCopy anyway,
  // but being strict here gives defence-in-depth.
  const ALLOWED_EXTRA_FLAGS = new Set([
    "--dry-run",
    "--verbose",
    "--checksum",
    "--ignore-existing",
    "--delete-empty-src-dirs",
    "--transfers",
    "--checkers",
    "--bwlimit",
  ]);
  const extraFlags: string[] = [];
  if (Array.isArray(body.extraFlags)) {
    for (const f of body.extraFlags) {
      if (typeof f === "string" && ALLOWED_EXTRA_FLAGS.has(f.split("=")[0]!)) {
        extraFlags.push(f);
      }
    }
  }

  let jobId: string;
  try {
    jobId = startRcloneCopy({ subPath, extraFlags: extraFlags.length ? extraFlags : undefined });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: "Failed to start rclone job", message });
    return;
  }

  res.status(202).json({ jobId });
});

/**
 * GET /rclone/jobs
 *
 * List all rclone jobs (most recent first).
 */
router.get("/rclone/jobs", requireAuth, (_req, res): void => {
  res.json({ jobs: listJobs() });
});

/**
 * GET /rclone/jobs/:jobId
 *
 * Get the status and progress of a specific rclone job.
 */
router.get("/rclone/jobs/:jobId", requireAuth, (req, res): void => {
  const job = getJob(req.params["jobId"]!);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json({ job });
});

/**
 * DELETE /rclone/jobs/:jobId
 *
 * Cancel a running rclone job. No-ops if already finished.
 */
router.delete("/rclone/jobs/:jobId", requireAuth, requireOrganization, (req, res): void => {
  const job = getJob(req.params["jobId"]!);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  if (job.status !== "running") {
    res.json({ cancelled: false, reason: `Job is already ${job.status}` });
    return;
  }
  const cancelled = cancelRcloneJob(req.params["jobId"]!);
  res.json({ cancelled });
});

export default router;
