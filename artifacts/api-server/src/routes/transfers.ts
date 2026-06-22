import { Router, type IRouter } from "express";
import multer from "multer";
import path from "node:path";
import { requireAuth, requireOrganization } from "../lib/auth";
import { getUploadsDir, verifyLocalFile } from "../lib/uploadService";
import {
  createTransfer,
  getTransfer,
  listTransfers,
  setStatus,
  toPublicTransfer,
} from "../lib/statusService";
import { enqueue, getQueueStats } from "../lib/transferQueue";
import { isGDriveConfigured } from "../lib/rcloneService";
import { checkRcloneInstalled } from "../lib/rclone";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Multer — save directly into the persistent uploads dir (not os.tmpdir)
function getUpload() {
  return multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, getUploadsDir()),
      filename: (_req, file, cb) => {
        const ts = Date.now();
        const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
        cb(null, `${ts}-${safe}`);
      },
    }),
    limits: {
      fileSize: 4 * 1024 * 1024 * 1024, // 4 GB
    },
  });
}

// ---------------------------------------------------------------------------
// GET /transfers/config
// Returns rclone + GDrive config status (no secrets)
// ---------------------------------------------------------------------------
router.get("/transfers/config", requireAuth, async (_req, res): Promise<void> => {
  const [install, configured] = await Promise.all([
    checkRcloneInstalled(),
    Promise.resolve(isGDriveConfigured()),
  ]);

  const rootPath = (process.env["GDRIVE_UPLOAD_ROOT"] ?? "Offloadr/Uploads").trim();
  const hasSharedDrive = !!(process.env["GDRIVE_SHARED_DRIVE_ID"] ?? "").trim();

  res.json({
    rclone: {
      installed: install.ok,
      version: install.version ?? null,
    },
    googleDrive: {
      configured,
      uploadRoot: rootPath,
      sharedDriveConfigured: hasSharedDrive,
    },
    queue: getQueueStats(),
  });
});

// ---------------------------------------------------------------------------
// POST /transfers
// Accepts a multipart upload (field "file") + "destination" text field.
// Saves locally, verifies, enqueues for rclone copy to GDrive.
// ---------------------------------------------------------------------------
router.post(
  "/transfers",
  requireAuth,
  requireOrganization,
  (req, res, next) => {
    // Mount multer per-request so getUploadsDir() is called after dirs are ready
    getUpload().single("file")(req, res, next);
  },
  async (req, res): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded. Send a multipart request with field 'file'." });
      return;
    }

    if (!isGDriveConfigured()) {
      res.status(503).json({
        error: "Google Drive is not configured",
        message: "Set GOOGLE_SERVICE_ACCOUNT_KEY to enable transfers.",
      });
      return;
    }

    const destination = ((req.body as Record<string, unknown>)["destination"] as string ?? "").trim();
    const cleanupRaw = (req.body as Record<string, unknown>)["cleanupAfterUpload"];
    const cleanupAfterUpload = cleanupRaw === "true" || cleanupRaw === true;

    const { path: filePath, originalname, size } = req.file;

    // Verify the file landed correctly
    const verify = await verifyLocalFile(filePath, size);
    if (!verify.ok) {
      logger.error({ filePath, verify }, "Uploaded file failed local verification");
      res.status(500).json({
        error: "File upload verification failed",
        message: verify.error,
      });
      return;
    }

    // Create the transfer record
    const transfer = createTransfer({
      filename: originalname,
      size,
      localPath: path.resolve(filePath),
      destination: destination || "",
      cleanupAfterUpload,
    });

    // Enqueue for rclone processing
    enqueue(transfer.id);

    logger.info(
      { transferId: transfer.id, filename: originalname, size, destination },
      "Transfer created and enqueued",
    );

    res.status(202).json({ transfer: toPublicTransfer(transfer) });
  },
);

// ---------------------------------------------------------------------------
// GET /transfers
// List all transfers (most recent first). Never returns localPath.
// ---------------------------------------------------------------------------
router.get("/transfers", requireAuth, (_req, res): void => {
  const transfers = listTransfers().map(toPublicTransfer);
  res.json({ transfers, queue: getQueueStats() });
});

// ---------------------------------------------------------------------------
// GET /transfers/:id
// Get a single transfer's status and progress.
// ---------------------------------------------------------------------------
router.get("/transfers/:id", requireAuth, (req, res): void => {
  const id = Array.isArray(req.params["id"]) ? req.params["id"][0]! : req.params["id"]!;
  const transfer = getTransfer(id);
  if (!transfer) {
    res.status(404).json({ error: "Transfer not found" });
    return;
  }
  res.json({ transfer: toPublicTransfer(transfer) });
});

// ---------------------------------------------------------------------------
// DELETE /transfers/:id
// Cancel a queued transfer. Cannot cancel one already uploading.
// ---------------------------------------------------------------------------
router.delete("/transfers/:id", requireAuth, requireOrganization, (req, res): void => {
  const id = Array.isArray(req.params["id"]) ? req.params["id"][0]! : req.params["id"]!;
  const transfer = getTransfer(id);
  if (!transfer) {
    res.status(404).json({ error: "Transfer not found" });
    return;
  }
  if (transfer.status !== "queued") {
    res.json({
      cancelled: false,
      reason: `Transfer is ${transfer.status} — only queued transfers can be cancelled here.`,
    });
    return;
  }
  setStatus(transfer.id, "cancelled");
  res.json({ cancelled: true });
});

export default router;
