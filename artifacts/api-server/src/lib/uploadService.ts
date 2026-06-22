import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { logger } from "./logger";

// ---------------------------------------------------------------------------
// Uploads directory — persists between requests, cleared after verified upload
// ---------------------------------------------------------------------------

function findPackageRoot(startDir: string): string {
  let dir = path.resolve(startDir);
  while (true) {
    if (fs.existsSync(path.join(dir, "package.json"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error(`Cannot find package root from ${startDir}`);
    dir = parent;
  }
}

let _uploadsDir: string | null = null;

export function getUploadsDir(): string {
  if (_uploadsDir) return _uploadsDir;
  const explicit = (process.env["UPLOADS_DIR"] ?? "").trim();
  _uploadsDir = explicit || path.join(findPackageRoot(import.meta.dirname), "uploads");
  fs.mkdirSync(_uploadsDir, { recursive: true });
  return _uploadsDir;
}

// ---------------------------------------------------------------------------
// Verify a locally saved file
// ---------------------------------------------------------------------------

export interface VerifyResult {
  ok: boolean;
  actualSize: number;
  expectedSize: number;
  error?: string;
}

export async function verifyLocalFile(
  filePath: string,
  expectedSize: number,
): Promise<VerifyResult> {
  try {
    const stat = await fsp.stat(filePath);
    const ok = stat.size === expectedSize;
    return {
      ok,
      actualSize: stat.size,
      expectedSize,
      error: ok ? undefined : `Size mismatch: expected ${expectedSize}, got ${stat.size}`,
    };
  } catch (err) {
    return {
      ok: false,
      actualSize: 0,
      expectedSize,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---------------------------------------------------------------------------
// Delete a local file (safe — never throws, logs on failure)
// ---------------------------------------------------------------------------

export async function deleteLocalFile(filePath: string): Promise<void> {
  try {
    await fsp.unlink(filePath);
    logger.info({ filePath }, "Deleted local upload file after transfer");
  } catch (err) {
    logger.warn({ filePath, err }, "Failed to delete local upload file — manual cleanup may be needed");
  }
}
