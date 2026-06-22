import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { logger } from "./logger";

// ---------------------------------------------------------------------------
// Config helpers — read from env, never written to frontend responses
// ---------------------------------------------------------------------------

export interface RcloneRemoteConfig {
  remoteName: string;
  remotePath: string;
}

/**
 * Read remote config from env vars only.
 * Returns null if either variable is missing/blank.
 * The rclone config file (with credentials) is never touched here.
 */
export function getRcloneRemoteConfig(): RcloneRemoteConfig | null {
  const name = (process.env["RCLONE_REMOTE_NAME"] ?? "").trim();
  const dest = (process.env["RCLONE_REMOTE_PATH"] ?? "").trim();
  if (!name || !dest) return null;
  return { remoteName: name, remotePath: dest };
}

// ---------------------------------------------------------------------------
// rclone binary check
// ---------------------------------------------------------------------------

export interface RcloneInstallInfo {
  ok: boolean;
  version?: string;
  error?: string;
}

export function checkRcloneInstalled(): Promise<RcloneInstallInfo> {
  return new Promise((resolve) => {
    const proc = spawn("rclone", ["version"], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    proc.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
    proc.on("close", () => {
      const versionLine = stdout.split("\n")[0]?.trim();
      if (versionLine?.startsWith("rclone")) {
        resolve({ ok: true, version: versionLine });
      } else {
        resolve({ ok: false, error: "rclone not found or returned unexpected output" });
      }
    });
    proc.on("error", (err) => {
      resolve({ ok: false, error: err.message });
    });
  });
}

// ---------------------------------------------------------------------------
// Local storage root resolution
// ---------------------------------------------------------------------------

function resolveStorageRoot(): string {
  const explicit = (process.env["STORAGE_FS_ROOT"] ?? "").trim();
  if (explicit) return path.resolve(explicit);
  // Walk up from this module file until we find a package.json
  let dir = path.resolve(import.meta.dirname);
  while (true) {
    if (existsSync(path.join(dir, "package.json"))) break;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.join(dir, ".storage");
}

// ---------------------------------------------------------------------------
// Job tracking (in-process, memory-only — survives the process lifetime)
// ---------------------------------------------------------------------------

export interface RcloneProgress {
  bytes: number;
  totalBytes: number;
  transfers: number;
  errors: number;
  speed: number;
  elapsedTime: number;
  eta: number | null;
  transferring: { name: string; percentage: number; speed: number; eta: number }[];
}

export type RcloneJobStatus = "running" | "done" | "failed" | "cancelled";

export interface RcloneJob {
  id: string;
  startedAt: string;
  finishedAt?: string;
  status: RcloneJobStatus;
  /** Resolved local path that was copied (never user-supplied verbatim). */
  localPath: string;
  /** Remote name only — not a credential. */
  remoteName: string;
  /** Destination path on the remote — not a credential. */
  remotePath: string;
  progress?: RcloneProgress;
  error?: string;
  exitCode?: number;
}

const jobs = new Map<string, RcloneJob>();
const runningProcesses = new Map<string, ReturnType<typeof spawn>>();

export function getJob(jobId: string): RcloneJob | undefined {
  return jobs.get(jobId);
}

export function listJobs(): RcloneJob[] {
  return Array.from(jobs.values()).sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  );
}

// ---------------------------------------------------------------------------
// rclone copy runner
// ---------------------------------------------------------------------------

export interface StartRcloneCopyOptions {
  /**
   * Sub-path within the local storage root to copy.
   * Defaults to the root (copy the full storage folder).
   */
  subPath?: string;
  /**
   * Extra rclone flags. A hard-coded denylist inside this function strips
   * any credential/config flags regardless of what is passed here.
   */
  extraFlags?: string[];
}

const BANNED_FLAGS = new Set([
  "--config",
  "--password-command",
  "--crypt-password",
  "--crypt-password2",
  "--ftp-pass",
  "--sftp-pass",
]);

/**
 * Start an rclone copy from local storage → configured remote.
 * Returns the job ID immediately; poll via getJob() for status and progress.
 *
 * Security:
 * - localPath is always resolved under the storage root (no path traversal)
 * - remoteName / remotePath come exclusively from env vars, never request bodies
 * - Child process inherits only HOME, PATH and RCLONE_CONFIG from env
 */
export function startRcloneCopy(options: StartRcloneCopyOptions = {}): string {
  const config = getRcloneRemoteConfig();
  if (!config) {
    throw new Error(
      "rclone remote not configured. Set RCLONE_REMOTE_NAME and RCLONE_REMOTE_PATH env vars.",
    );
  }

  const storageRoot = resolveStorageRoot();
  let localPath = storageRoot;

  if (options.subPath) {
    const candidate = path.resolve(storageRoot, options.subPath);
    if (candidate !== storageRoot && !candidate.startsWith(storageRoot + path.sep)) {
      throw new Error("subPath escapes the storage root");
    }
    localPath = candidate;
  }

  const destination = `${config.remoteName}:${config.remotePath}`;

  const jobId = randomUUID();
  const job: RcloneJob = {
    id: jobId,
    startedAt: new Date().toISOString(),
    status: "running",
    localPath,
    remoteName: config.remoteName,
    remotePath: config.remotePath,
  };
  jobs.set(jobId, job);

  // Strip banned flags; caller allowlist is enforced at the route layer
  const safeExtra = (options.extraFlags ?? []).filter(
    (f) => !BANNED_FLAGS.has(f.split("=")[0] ?? ""),
  );

  const args = [
    "copy",
    localPath,
    destination,
    "--use-json-log",
    "--log-level=INFO",
    "--stats=2s",
    "--stats-log-level=INFO",
    ...safeExtra,
  ];

  logger.info({ jobId, localPath, destination }, "rclone copy starting");

  // Only pass a minimal, non-sensitive env to the child process
  const childEnv: NodeJS.ProcessEnv = {
    HOME: process.env["HOME"],
    PATH: process.env["PATH"],
  };
  if (process.env["RCLONE_CONFIG"]) childEnv["RCLONE_CONFIG"] = process.env["RCLONE_CONFIG"];
  if (process.env["XDG_CONFIG_HOME"]) childEnv["XDG_CONFIG_HOME"] = process.env["XDG_CONFIG_HOME"];

  const proc = spawn("rclone", args, { stdio: ["ignore", "pipe", "pipe"], env: childEnv });

  runningProcesses.set(jobId, proc);
  proc.on("close", () => runningProcesses.delete(jobId));

  // rclone emits JSON log lines on both stdout and stderr when --use-json-log is set.
  // Stats arrive on stderr by default; keep both to be safe.
  const parseJsonLine = (line: string): void => {
    if (!line.trim()) return;
    try {
      const obj = JSON.parse(line) as {
        stats?: {
          bytes?: number;
          totalBytes?: number;
          transfers?: number;
          errors?: number;
          speed?: number;
          elapsedTime?: number;
          eta?: number | null;
          transferring?: { name: string; percentage: number; speed: number; eta: number }[];
        };
      };
      if (obj.stats) {
        const s = obj.stats;
        job.progress = {
          bytes: s.bytes ?? 0,
          totalBytes: s.totalBytes ?? 0,
          transfers: s.transfers ?? 0,
          errors: s.errors ?? 0,
          speed: s.speed ?? 0,
          elapsedTime: s.elapsedTime ?? 0,
          eta: s.eta ?? null,
          transferring: s.transferring ?? [],
        };
      }
    } catch {
      // Non-JSON lines are silently ignored
    }
  };

  const drainBuffer = (buf: { value: string }, chunk: Buffer): void => {
    buf.value += chunk.toString();
    const lines = buf.value.split("\n");
    buf.value = lines.pop() ?? "";
    for (const line of lines) parseJsonLine(line);
  };

  const stdoutBuf = { value: "" };
  const stderrBuf = { value: "" };
  proc.stdout.on("data", (c: Buffer) => drainBuffer(stdoutBuf, c));
  proc.stderr.on("data", (c: Buffer) => drainBuffer(stderrBuf, c));

  proc.on("close", (code, signal) => {
    // Flush any partial lines
    for (const buf of [stdoutBuf.value, stderrBuf.value]) parseJsonLine(buf);

    job.finishedAt = new Date().toISOString();
    job.exitCode = code ?? undefined;

    if (signal === "SIGTERM" || signal === "SIGKILL") {
      job.status = "cancelled";
      logger.info({ jobId, signal }, "rclone copy cancelled");
    } else if (code === 0) {
      job.status = "done";
      logger.info({ jobId }, "rclone copy finished successfully");
    } else {
      job.status = "failed";
      job.error = `rclone exited with code ${code}`;
      logger.error({ jobId, code }, "rclone copy failed");
    }
  });

  proc.on("error", (err) => {
    job.status = "failed";
    job.error = err.message;
    job.finishedAt = new Date().toISOString();
    logger.error({ jobId, err }, "rclone process error");
  });

  return jobId;
}

/**
 * Send SIGTERM to a running rclone job.
 * Returns true if the process was found and signalled.
 */
export function cancelRcloneJob(jobId: string): boolean {
  const proc = runningProcesses.get(jobId);
  if (!proc) return false;
  proc.kill("SIGTERM");
  return true;
}
