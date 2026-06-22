/**
 * @workspace/upload — shared Offloadr presigned upload engine.
 *
 * Implements the three-step direct-to-R2 upload flow:
 *   1. POST /upload-url     → presigned PUT URL + storageKey
 *   2. XHR PUT → R2         → direct byte transfer (progress events)
 *   3. POST /confirm-upload → create draft DB record
 *
 * Falls back to legacy FormData POST when:
 *   - Server returns uploadUrl: null (FS storage driver — local dev)
 *   - upload-url endpoint is absent (404 / 501 / not-yet-deployed)
 *
 * No DOM-specific APIs beyond XHR (available in both browser and React Native).
 * Platform-specific pieces (file picker, camera capture, offline queue) stay
 * in the app layer.
 *
 * Usage:
 *   import { runUpload } from "@workspace/upload";
 *   const result = await runUpload(task, client, (pct) => setProgress(pct));
 */

import type { OffloadrClient } from "@workspace/client";

// ── Public types ──────────────────────────────────────────────────────────────

export type UploadStatus =
  | "idle"
  | "requesting-url"
  | "uploading"
  | "confirming"
  | "done"
  | "error";

export interface UploadTask {
  /** Target project to add the file to as a draft. */
  projectId: number;
  /**
   * File data.  Pass a `File` in browser or a `Blob` in React Native.
   * For large files in RN (>50 MB) the caller should create a `Blob` from
   * `expo-file-system` rather than loading the full buffer into JS memory.
   */
  file: File | Blob;
  /** Original file name shown to the teacher (e.g. "DJI_20240101.MP4"). */
  fileName: string;
  /**
   * MIME type of the file (e.g. "video/mp4").
   * Falls back to "application/octet-stream" when unknown.
   */
  contentType: string;
  /** File size in bytes.  Must match the actual file body length. */
  fileSize: number;
}

export type UploadResult =
  | { ok: true; fileId: number; originalFileName: string }
  | { ok: false; status: number; message: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns true when the HTTP status code indicates a transient failure that
 * is worth retrying (network error, server error). 4xx errors (bad request,
 * auth failure, not found, etc.) are permanent — retrying will not help.
 */
function isTransient(status: number): boolean {
  return status === 0 || status >= 500;
}

// ── XHR PUT helper ────────────────────────────────────────────────────────────

/**
 * Upload the file body via XHR directly to a presigned URL.
 * XHR is used rather than fetch() because it fires upload-progress events,
 * which fetch() does not yet support reliably across all environments.
 * XHR is available in both browser and React Native (polyfilled).
 */
function xhrPut(
  url: string,
  body: File | Blob,
  contentType: string,
  onProgress: (pct: number) => void,
): Promise<{ ok: boolean; status: number; message?: string }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.setRequestHeader("Content-Type", contentType);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        if (pct % 5 === 0 || pct === 100) onProgress(pct);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ ok: true, status: xhr.status });
      } else {
        resolve({
          ok: false,
          status: xhr.status,
          message:
            xhr.status === 403
              ? "Upload blocked — check storage CORS configuration."
              : `Storage upload failed (${xhr.status}). Please try again.`,
        });
      }
    };

    xhr.onerror = () =>
      resolve({ ok: false, status: 0, message: "Network error during upload." });

    xhr.send(body);
  });
}

// ── Legacy FormData fallback ──────────────────────────────────────────────────

/**
 * Legacy server-side upload (FormData POST through the API).
 * Used when:
 *   - The storage driver does not support presigned PUT URLs (local dev FS).
 *   - The upload-url endpoint is not yet deployed (404 / 501).
 *
 * IMPORTANT: This path goes through Vercel and is limited to ~4.5 MB on
 * production. It exists only for local development convenience.
 */
function legacyFormDataUpload(
  baseUrl: string,
  projectId: number,
  file: File | Blob,
  fileName: string,
  getToken: (() => string | null) | null | undefined,
  onProgress: (pct: number) => void,
): Promise<UploadResult> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${baseUrl}/api/student/me/projects/${projectId}/upload`, true);
    xhr.withCredentials = true;

    const token = getToken?.();
    if (token) {
      xhr.setRequestHeader("Cookie", `student_session=${token}`);
    }

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        let fileId: number | undefined;
        let originalFileName: string | undefined;
        try {
          const body = JSON.parse(xhr.responseText) as { fileId?: number; originalFileName?: string };
          fileId = typeof body.fileId === "number" ? body.fileId : undefined;
          originalFileName = typeof body.originalFileName === "string" ? body.originalFileName : undefined;
        } catch { /* no-op */ }

        if (typeof fileId !== "number") {
          resolve({ ok: false, status: xhr.status, message: "Server did not return a fileId after upload." });
        } else {
          resolve({ ok: true, fileId, originalFileName: originalFileName ?? fileName });
        }
      } else {
        let message: string | undefined;
        try {
          const body = JSON.parse(xhr.responseText) as { message?: string; error?: string };
          message = body?.message ?? body?.error;
        } catch { /* no-op */ }
        resolve({ ok: false, status: xhr.status, message: message ?? `Upload failed (${xhr.status})` });
      }
    };

    xhr.onerror = () =>
      resolve({ ok: false, status: 0, message: "Network error" });

    const fd = new FormData();
    fd.append("file", file instanceof File ? file : new File([file], fileName));
    xhr.send(fd);
  });
}

// ── Main export ───────────────────────────────────────────────────────────────

export interface RunUploadOptions {
  /**
   * Base URL for the legacy FormData fallback path.
   * Pass "" (empty string) on web.  Pass "https://www.useoffloadr.com" on mobile.
   * Only used when the presigned URL flow is unavailable.
   */
  baseUrl?: string;
  /**
   * Returns the raw session token for manual Cookie header injection (React Native).
   * Pass null on web — the browser handles session cookies automatically.
   * Only used in the legacy fallback path.
   */
  getToken?: (() => string | null) | null;
  /**
   * Maximum number of retry attempts for transient (5xx / network) errors on
   * the API steps (upload-url and confirm-upload). 4xx responses are never
   * retried — they indicate permanent failures (auth, validation, not-found).
   * Does NOT retry the R2 PUT — a partial upload may have already landed.
   * Defaults to 3.
   */
  maxRetries?: number;
}

/**
 * Run a complete presigned upload:
 *   1. Request a signed PUT URL from the API.
 *   2. PUT the file directly to R2 (no Vercel, no API server in the hot path).
 *   3. Confirm the upload with the API to create the draft DB record.
 *
 * Falls back to legacy FormData POST if:
 *   - The server returns uploadUrl: null (FS storage driver).
 *   - The upload-url endpoint is missing (404) or reports unsupported (501).
 *   - All retry attempts for the upload-url step are exhausted on 5xx errors.
 */
export async function runUpload(
  task: UploadTask,
  client: OffloadrClient,
  onProgress: (pct: number) => void,
  options: RunUploadOptions = {},
): Promise<UploadResult> {
  const { baseUrl = "", getToken = null, maxRetries = 3 } = options;
  const { projectId, file, fileName, contentType, fileSize } = task;
  const fileMime = contentType || "application/octet-stream";

  // ── Step 1: Request presigned URL ─────────────────────────────────────────
  let uploadUrl: string | null = null;
  let storageKey: string | null = null;

  let attempt = 0;
  while (attempt <= maxRetries) {
    const res = await client.student.projects.getUploadUrl(projectId, {
      originalFileName: fileName,
      contentType: fileMime,
      fileSize,
    });

    if (res.ok && res.data) {
      uploadUrl = res.data.uploadUrl ?? null;
      storageKey = res.data.storageKey ?? null;
      break;
    }

    const status = res.status ?? 0;

    // 404 / 501: endpoint not deployed or not supported — fall back immediately.
    if (status === 404 || status === 501) {
      return legacyFormDataUpload(baseUrl, projectId, file, fileName, getToken, onProgress);
    }

    // 4xx (except the above): permanent client error — do not retry.
    if (!isTransient(status)) {
      return {
        ok: false,
        status,
        message: res.message ?? `Failed to prepare upload (${status}).`,
      };
    }

    // 5xx / network: transient — retry with exponential backoff.
    attempt++;
    if (attempt > maxRetries) {
      // All retries exhausted on transient errors — fall back to legacy.
      return legacyFormDataUpload(baseUrl, projectId, file, fileName, getToken, onProgress);
    }
    await new Promise((r) => setTimeout(r, 500 * 2 ** (attempt - 1)));
  }

  // ── Fallback: legacy FormData POST ────────────────────────────────────────
  // Reached when uploadUrl is null (FS storage driver).
  if (!uploadUrl || !storageKey) {
    return legacyFormDataUpload(baseUrl, projectId, file, fileName, getToken, onProgress);
  }

  // ── Step 2: PUT directly to R2 ────────────────────────────────────────────
  const putResult = await xhrPut(uploadUrl, file, fileMime, onProgress);
  if (!putResult.ok) {
    return { ok: false, status: putResult.status, message: putResult.message ?? "Upload failed." };
  }

  // ── Step 3: Confirm upload (create draft DB record) ───────────────────────
  attempt = 0;
  while (attempt <= maxRetries) {
    const confirmRes = await client.student.projects.confirmUpload(projectId, {
      storageKey,
      originalFileName: fileName,
      contentType: fileMime,
      fileSize,
    });

    if (confirmRes.ok && confirmRes.data) {
      return {
        ok: true,
        fileId: confirmRes.data.fileId,
        originalFileName: confirmRes.data.originalFileName,
      };
    }

    const status = confirmRes.status ?? 0;

    // 4xx: permanent — do not retry.
    if (!isTransient(status)) {
      return {
        ok: false,
        status,
        message:
          confirmRes.message ??
          "File uploaded but draft creation failed. Refresh the page to check.",
      };
    }

    // 5xx / network: transient — retry.
    attempt++;
    if (attempt > maxRetries) {
      return {
        ok: false,
        status,
        message:
          "File reached storage but the draft record could not be created after multiple retries. Refresh the page to check.",
      };
    }
    await new Promise((r) => setTimeout(r, 500 * 2 ** (attempt - 1)));
  }

  return { ok: false, status: 0, message: "Unexpected error confirming upload." };
}
