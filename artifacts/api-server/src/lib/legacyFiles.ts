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

/**
 * `MediaFile` already carries `uploaderKind` and `studentUploaderName`
 * from the schema, so we don't redeclare them here — we only add the
 * derived `isMissing` flag the API surfaces to clients.
 */
export type SanitizedMediaFile = MediaFile & {
  isMissing: boolean;
};

export function sanitizeMediaFile(file: MediaFile): SanitizedMediaFile {
  // Explicitly forward the student-attribution columns so the shape
  // is obvious to readers and any future change to `MediaFile` that
  // drops them surfaces as a type error here rather than silently
  // disappearing from API responses.
  const base: SanitizedMediaFile = {
    ...file,
    uploaderKind: file.uploaderKind,
    studentUploaderName: file.studentUploaderName,
    isMissing: false,
  };
  if (isLegacyMissingFile(file.storagePath)) {
    return { ...base, publicUrl: null, isMissing: true };
  }
  return base;
}

export function sanitizeMediaFiles(files: MediaFile[]): SanitizedMediaFile[] {
  return files.map(sanitizeMediaFile);
}
