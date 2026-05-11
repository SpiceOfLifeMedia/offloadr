import type { MediaFile } from "@workspace/db";

const STORAGE_KEY_PREFIX = "offloadr/";

export function isLegacyMissingFile(
  storagePath: string | null | undefined,
): boolean {
  if (!storagePath) return true;
  return !storagePath.startsWith(STORAGE_KEY_PREFIX);
}

export function hasUsableStoragePath(
  storagePath: string | null | undefined,
): storagePath is string {
  return !isLegacyMissingFile(storagePath);
}

export type SanitizedMediaFile = MediaFile & { isMissing: boolean };

export function sanitizeMediaFile(file: MediaFile): SanitizedMediaFile {
  if (isLegacyMissingFile(file.storagePath)) {
    return { ...file, publicUrl: null, isMissing: true };
  }
  return { ...file, isMissing: false };
}

export function sanitizeMediaFiles(files: MediaFile[]): SanitizedMediaFile[] {
  return files.map(sanitizeMediaFile);
}
