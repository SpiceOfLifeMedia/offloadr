import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { NotFoundError, type StorageDriver, type StorageObject } from "./types";

const META_SUFFIX = ".meta.json";

function findPackageRoot(startDir: string): string {
  let dir = path.resolve(startDir);
  while (true) {
    if (fs.existsSync(path.join(dir, "package.json"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(`Unable to locate package root from ${startDir}`);
    }
    dir = parent;
  }
}

export class FilesystemStorageDriver implements StorageDriver {
  readonly name = "fs";
  private readonly root: string;

  constructor(root?: string) {
    // Default root is resolved relative to the API package directory by walking
    // up from this module file until a package.json is found. This stays stable
    // whether the code is executed from source (src/lib/storage/fs.ts) or the
    // bundled build (dist/index.mjs) — both live inside artifacts/offloadr-api.
    const explicit = root ?? process.env["STORAGE_FS_ROOT"];
    this.root = path.resolve(explicit ?? path.join(findPackageRoot(import.meta.dirname), ".storage"));
  }

  assertConfigured(): void {
    // Filesystem driver has no required configuration.
  }

  private resolveKey(key: string): string {
    const target = path.resolve(this.root, key);
    if (target !== this.root && !target.startsWith(this.root + path.sep)) {
      throw new Error(`Storage key escapes root: ${key}`);
    }
    return target;
  }

  async upload(key: string, body: Readable, contentType: string): Promise<void> {
    const target = this.resolveKey(key);
    await fsp.mkdir(path.dirname(target), { recursive: true });
    const tmp = `${target}.tmp.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}`;
    try {
      await pipeline(body, fs.createWriteStream(tmp));
      await fsp.rename(tmp, target);
      await fsp.writeFile(`${target}${META_SUFFIX}`, JSON.stringify({ contentType }), "utf8");
    } catch (err) {
      await fsp.unlink(tmp).catch(() => undefined);
      throw err;
    }
  }

  async getObject(key: string): Promise<StorageObject> {
    const target = this.resolveKey(key);
    let stat: fs.Stats;
    try {
      stat = await fsp.stat(target);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        throw new NotFoundError(key);
      }
      throw err;
    }

    let contentType = "application/octet-stream";
    try {
      const raw = await fsp.readFile(`${target}${META_SUFFIX}`, "utf8");
      const parsed = JSON.parse(raw) as { contentType?: unknown };
      if (typeof parsed.contentType === "string" && parsed.contentType.length > 0) {
        contentType = parsed.contentType;
      }
    } catch {
      // No sidecar — fall back to default.
    }

    return {
      stream: fs.createReadStream(target),
      contentType,
      size: stat.size,
    };
  }

  async delete(key: string): Promise<void> {
    const target = this.resolveKey(key);
    await fsp.unlink(target).catch((err) => {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    });
    await fsp.unlink(`${target}${META_SUFFIX}`).catch(() => undefined);
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fsp.access(this.resolveKey(key), fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  // Local filesystem can't be reached by an external render service.
  // Return null so the caller fails cleanly rather than handing
  // Shotstack a `file:///...` or relative path it'll choke on.
  async getSignedDownloadUrl(_key: string, _ttlSeconds: number): Promise<string | null> {
    return null;
  }

  // Direct browser-to-storage upload is not available with the local
  // filesystem driver. Callers must fall back to server-side upload.
  async getSignedUploadUrl(
    _key: string,
    _contentType: string,
    _ttlSeconds: number,
  ): Promise<string | null> {
    return null;
  }
}
