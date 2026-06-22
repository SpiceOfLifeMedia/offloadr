import { FilesystemStorageDriver } from "./fs";
import { S3StorageDriver } from "./s3";
import { NotConfiguredError, type StorageDriver } from "./types";

export { NotFoundError, NotConfiguredError } from "./types";
export type { StorageDriver, StorageObject } from "./types";

let cached: StorageDriver | null = null;

export function getStorageDriver(): StorageDriver {
  if (cached) return cached;
  const raw = (process.env["STORAGE_DRIVER"] ?? "").trim().toLowerCase();

  // Auto-detect: when STORAGE_DRIVER is not explicitly set, fall back to
  // S3/R2 if all four credentials are present in the environment. This
  // means production (Railway) works without requiring STORAGE_DRIVER=s3
  // to be manually configured as a separate env var — only the credentials
  // themselves are needed. Local dev without credentials still gets the
  // filesystem driver.
  const hasS3Creds = !!(
    process.env["STORAGE_S3_ENDPOINT"] &&
    process.env["STORAGE_S3_BUCKET"] &&
    process.env["STORAGE_S3_ACCESS_KEY_ID"] &&
    process.env["STORAGE_S3_SECRET_ACCESS_KEY"]
  );

  const driver = raw || (hasS3Creds ? "s3" : "fs");

  switch (driver) {
    case "":
    case "fs":
    case "filesystem":
    case "local":
      cached = new FilesystemStorageDriver();
      return cached;
    case "s3":
    case "r2":
      cached = new S3StorageDriver();
      return cached;
    default:
      throw new NotConfiguredError(
        `Unknown STORAGE_DRIVER "${raw}". Supported values: "fs" (default), "s3".`,
      );
  }
}

// Test-only reset hook (not exported from package).
export function __resetStorageDriverForTests(): void {
  cached = null;
}
