import { spawn } from "node:child_process";
import path from "node:path";
import { logger } from "./logger";
import { setProgress, setStatus, setError, setDriveLink } from "./statusService";
import { deleteLocalFile } from "./uploadService";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const GDRIVE_REMOTE = "gdrive";

export interface GDriveConfig {
  /** Service account JSON string from GOOGLE_SERVICE_ACCOUNT_KEY */
  serviceAccountJson: string;
  /** Optional Shared Drive ID (for team drives) */
  sharedDriveId?: string;
  /** The destination root folder path on Drive (e.g. "Offloadr/Uploads") */
  rootPath: string;
}

export function getGDriveConfig(): GDriveConfig | null {
  const sa = (process.env["GOOGLE_SERVICE_ACCOUNT_KEY"] ?? "").trim();
  if (!sa) return null;

  const rootPath = (process.env["GDRIVE_UPLOAD_ROOT"] ?? "Offloadr/Uploads").trim();
  const sharedDriveId = (process.env["GDRIVE_SHARED_DRIVE_ID"] ?? "").trim() || undefined;

  return { serviceAccountJson: sa, sharedDriveId, rootPath };
}

export function isGDriveConfigured(): boolean {
  return getGDriveConfig() !== null;
}

// ---------------------------------------------------------------------------
// Build the restricted env that rclone child processes receive
// rclone supports config-less operation via RCLONE_CONFIG_<REMOTE>_* env vars.
// We pass ONLY these vars plus HOME and PATH — no DB secrets, session keys, etc.
// ---------------------------------------------------------------------------

function buildRcloneEnv(config: GDriveConfig): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    HOME: process.env["HOME"],
    PATH: process.env["PATH"],
    // Configure the "gdrive" remote entirely from env — no config file needed
    RCLONE_CONFIG_GDRIVE_TYPE: "drive",
    RCLONE_CONFIG_GDRIVE_SERVICE_ACCOUNT_CREDENTIALS: config.serviceAccountJson,
    RCLONE_CONFIG_GDRIVE_SCOPE: "drive",
  };
  if (config.sharedDriveId) {
    env["RCLONE_CONFIG_GDRIVE_TEAM_DRIVE"] = config.sharedDriveId;
  }
  return env;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build the full rclone destination string for a file */
function buildDestination(config: GDriveConfig, destFolder: string): string {
  const folder = destFolder.trim().replace(/^\/+|\/+$/g, "");
  const root = config.rootPath.replace(/^\/+|\/+$/g, "");
  const combined = folder ? `${root}/${folder}` : root;
  return `${GDRIVE_REMOTE}:${combined}`;
}

function parseRcloneJsonLine(line: string): {
  bytes?: number;
  totalBytes?: number;
  speed?: number;
  eta?: number | null;
  transfers?: number;
} | null {
  if (!line.trim()) return null;
  try {
    const obj = JSON.parse(line) as {
      stats?: {
        bytes?: number;
        totalBytes?: number;
        speed?: number;
        eta?: number | null;
        transfers?: number;
      };
    };
    return obj.stats ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Run a rclone command, streaming JSON-log progress to the transfer record
// ---------------------------------------------------------------------------

function runRclone(
  args: string[],
  env: NodeJS.ProcessEnv,
  onStats?: (stats: NonNullable<ReturnType<typeof parseRcloneJsonLine>>) => void,
): Promise<{ exitCode: number; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn("rclone", args, { stdio: ["ignore", "pipe", "pipe"], env });

    const stdoutBuf = { v: "" };
    const stderrBuf = { v: "" };
    const stderrLines: string[] = [];

    const drainLines = (buf: { v: string }, chunk: Buffer): void => {
      buf.v += chunk.toString();
      const lines = buf.v.split("\n");
      buf.v = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const stats = parseRcloneJsonLine(line);
        if (stats && onStats) onStats(stats);
        stderrLines.push(line);
      }
    };

    proc.stdout.on("data", (c: Buffer) => drainLines(stdoutBuf, c));
    proc.stderr.on("data", (c: Buffer) => drainLines(stderrBuf, c));

    proc.on("close", (code) => {
      // Flush partial lines
      for (const buf of [stdoutBuf.v, stderrBuf.v]) {
        const stats = parseRcloneJsonLine(buf);
        if (stats && onStats) onStats(stats);
        if (buf.trim()) stderrLines.push(buf);
      }
      resolve({ exitCode: code ?? 1, stderr: stderrLines.slice(-20).join("\n") });
    });

    proc.on("error", (err) => {
      resolve({ exitCode: 1, stderr: err.message });
    });
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Copy a local file to Google Drive using rclone.
 * Updates the transfer status record throughout.
 *
 * @param transferId  - used for progress updates
 * @param localFile   - absolute path to the local file
 * @param destFolder  - folder name under the configured root (e.g. "Class A/Audio")
 * @param fileSize    - original file size for percentage calculation
 */
export async function copyToGDrive(
  transferId: string,
  localFile: string,
  destFolder: string,
  fileSize: number,
): Promise<{ ok: boolean; error?: string }> {
  const config = getGDriveConfig();
  if (!config) {
    return { ok: false, error: "Google Drive is not configured. Set GOOGLE_SERVICE_ACCOUNT_KEY." };
  }

  const destination = buildDestination(config, destFolder);
  const env = buildRcloneEnv(config);

  logger.info({ transferId, localFile, destination }, "rclone GDrive copy starting");
  setStatus(transferId, "uploading");

  const args = [
    "copy",
    localFile,
    destination,
    "--use-json-log",
    "--log-level=INFO",
    "--stats=1s",
    "--stats-log-level=INFO",
  ];

  const { exitCode, stderr } = await runRclone(args, env, (stats) => {
    const bytes = stats.bytes ?? 0;
    const totalBytes = stats.totalBytes ?? fileSize;
    const speed = stats.speed ?? 0;
    const eta = stats.eta ?? null;
    const percentage = totalBytes > 0 ? Math.min(100, Math.round((bytes / totalBytes) * 100)) : 0;
    setProgress(transferId, { bytes, totalBytes, speed, eta, percentage });
  });

  if (exitCode !== 0) {
    const msg = `rclone copy failed (exit ${exitCode}): ${stderr.slice(-300)}`;
    logger.error({ transferId, exitCode, stderr }, "rclone GDrive copy failed");
    return { ok: false, error: msg };
  }

  logger.info({ transferId, destination }, "rclone GDrive copy complete");
  return { ok: true };
}

/**
 * Verify the uploaded file exists on Google Drive using rclone check.
 * Runs after a successful copy to confirm integrity.
 */
export async function verifyGDriveUpload(
  transferId: string,
  localFile: string,
  destFolder: string,
): Promise<{ ok: boolean; error?: string }> {
  const config = getGDriveConfig();
  if (!config) return { ok: false, error: "Google Drive not configured" };

  const destination = buildDestination(config, destFolder);
  const env = buildRcloneEnv(config);

  logger.info({ transferId, localFile, destination }, "rclone GDrive verify starting");
  setStatus(transferId, "verifying");

  const args = [
    "check",
    localFile,
    destination,
    "--use-json-log",
    "--log-level=INFO",
  ];

  const { exitCode, stderr } = await runRclone(args, env);

  if (exitCode !== 0) {
    const msg = `rclone check failed (exit ${exitCode}): ${stderr.slice(-200)}`;
    logger.warn({ transferId, exitCode }, "rclone GDrive verify failed");
    return { ok: false, error: msg };
  }

  logger.info({ transferId }, "rclone GDrive verify passed");
  return { ok: true };
}

/**
 * Get a Google Drive web link for the uploaded file using rclone lsjson.
 * Returns null if the link cannot be retrieved (non-fatal).
 */
export async function getGDriveLink(
  transferId: string,
  localFile: string,
  destFolder: string,
): Promise<string | null> {
  const config = getGDriveConfig();
  if (!config) return null;

  const filename = path.basename(localFile);
  const destination = buildDestination(config, destFolder);
  const env = buildRcloneEnv(config);

  const args = ["link", `${destination}/${filename}`, "--use-json-log", "--log-level=ERROR"];

  const result = await runRclone(args, env);
  // rclone link outputs the URL as the first line of stdout (not JSON)
  // When using --use-json-log, the link goes to stdout as plain text
  const link = result.stderr.split("\n").find((l) => l.startsWith("http"))?.trim() ?? null;

  if (link) setDriveLink(transferId, link);
  return link;
}

/**
 * Full transfer pipeline: copy → verify → (optional) cleanup → drive link.
 * Call this from the transfer queue worker.
 */
export async function runTransferPipeline(opts: {
  transferId: string;
  localFile: string;
  destFolder: string;
  fileSize: number;
  cleanupAfterUpload: boolean;
}): Promise<void> {
  const { transferId, localFile, destFolder, fileSize, cleanupAfterUpload } = opts;

  // 1. Copy
  const copyResult = await copyToGDrive(transferId, localFile, destFolder, fileSize);
  if (!copyResult.ok) {
    setError(transferId, copyResult.error!);
    setStatus(transferId, "failed");
    return;
  }

  // 2. Verify
  const verifyResult = await verifyGDriveUpload(transferId, localFile, destFolder);
  if (!verifyResult.ok) {
    // Copy succeeded but verify failed — mark as failed, keep local file
    setError(transferId, `Upload succeeded but verification failed: ${verifyResult.error}`);
    setStatus(transferId, "failed");
    return;
  }

  // 3. Get drive link (best-effort)
  await getGDriveLink(transferId, localFile, destFolder).catch(() => null);

  // 4. Cleanup local file if requested
  if (cleanupAfterUpload) {
    await deleteLocalFile(localFile);
  }

  setStatus(transferId, "done");
}
