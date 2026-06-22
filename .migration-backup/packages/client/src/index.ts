/**
 * @workspace/client — typed Offloadr student API client.
 *
 * No DOM dependencies. Works in both browser (cookie-based auth via
 * credentials: 'include') and React Native (token sent as Cookie header).
 *
 * Usage:
 *   const client = createOffloadrClient({
 *     baseUrl: "https://www.useoffloadr.com",
 *     getToken: () => secureStore.getToken(),  // mobile
 *   });
 *
 *   // Web: getToken returns null; browser sends session cookie automatically.
 *   const client = createOffloadrClient({ baseUrl: "", getToken: () => null });
 */

export const STUDENT_COOKIE_NAME = "student_session";

// ── Option types ──────────────────────────────────────────────────────────────

export interface OffloadrClientOptions {
  /**
   * Base URL prepended to every API path.
   * Pass "" (empty string) on web — relative paths work with Vite's BASE_URL.
   * Pass "https://www.useoffloadr.com" on mobile.
   */
  baseUrl: string;
  /**
   * Returns the raw session token string, or null when not logged in.
   * On web: return null — the browser sends the session cookie automatically.
   * On mobile: return the token from expo-secure-store.
   *
   * When a non-null token is returned it is sent as:
   *   Cookie: student_session=<token>
   * Browsers silently drop the Cookie header per spec (safe), React Native sends it.
   */
  getToken: () => string | null;
}

// ── Response shapes ───────────────────────────────────────────────────────────

export interface StudentLoginResponse {
  ok: true;
  sessionToken: string;
  studentId: number;
  displayName: string;
  organizationId: number;
  organizationName: string;
  organizationSlug: string;
}

export interface StudentProject {
  projectId: number;
  projectName: string;
  organizationName: string;
  classId?: number | null;
  className?: string | null;
}

export interface StudentDraftFile {
  id: number;
  originalFileName: string;
  fileSize: number;
  uploadedAt: string | null;
  submittedAt: string | null;
  submissionId: string | null;
}

export interface StudentProjectDetail {
  project: {
    projectId: number;
    projectName: string;
    organizationName: string;
  };
  locked: boolean;
  draftFiles: StudentDraftFile[];
  submittedFiles: StudentDraftFile[];
}

export interface UploadUrlResponse {
  uploadUrl: string | null;
  storageKey: string | null;
  expiresAt: string | null;
}

export interface ConfirmUploadResponse {
  ok: boolean;
  fileId: number;
  originalFileName: string;
  submittedAt: string | null;
}

// ── Internal fetch helper ─────────────────────────────────────────────────────

interface FetchResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  message?: string;
}

function buildHeaders(getToken: () => string | null, extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  const token = getToken();
  if (token) {
    // Sent as Cookie header. Browsers silently drop this (forbidden header),
    // so web auth still relies on credentials:'include'. React Native sends it.
    headers["Cookie"] = `${STUDENT_COOKIE_NAME}=${token}`;
  }
  return headers;
}

async function apiFetch<T>(
  baseUrl: string,
  getToken: () => string | null,
  path: string,
  options: RequestInit = {},
): Promise<FetchResult<T>> {
  const url = `${baseUrl}${path}`;
  const extraHeaders: Record<string, string> = buildHeaders(getToken);

  if (
    options.body !== undefined &&
    typeof options.body === "string" &&
    !extraHeaders["Content-Type"]
  ) {
    extraHeaders["Content-Type"] = "application/json";
  }

  const mergedHeaders = new Headers({ ...extraHeaders, ...(options.headers as Record<string, string> | undefined) });

  try {
    const res = await fetch(url, {
      ...options,
      headers: mergedHeaders,
      credentials: "include",
    });

    let data: T | null = null;
    let message: string | undefined;

    try {
      const text = await res.text();
      if (text.trim()) {
        const parsed = JSON.parse(text) as Record<string, unknown>;
        data = parsed as T;
        if (!res.ok) {
          message =
            (typeof parsed["message"] === "string" ? parsed["message"] : undefined) ??
            (typeof parsed["error"] === "string" ? parsed["error"] : undefined);
        }
      }
    } catch {
      message = `HTTP ${res.status}`;
    }

    return { ok: res.ok, status: res.status, data, message };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      data: null,
      message: err instanceof Error ? err.message : "Network error",
    };
  }
}

// ── Client factory ────────────────────────────────────────────────────────────

export function createOffloadrClient(options: OffloadrClientOptions) {
  const { baseUrl, getToken } = options;

  function fetch_<T>(path: string, init?: RequestInit): Promise<FetchResult<T>> {
    return apiFetch<T>(baseUrl, getToken, path, init);
  }

  return {
    student: {
      auth: {
        async login(params: {
          organizationSlug: string;
          username: string;
          password: string;
        }): Promise<{ ok: true; data: StudentLoginResponse } | { ok: false; status: number; message: string }> {
          const res = await fetch_<StudentLoginResponse>("/api/student/auth/login", {
            method: "POST",
            body: JSON.stringify(params),
          });
          if (!res.ok || !res.data) {
            return { ok: false, status: res.status, message: res.message ?? `Login failed (${res.status})` };
          }
          return { ok: true, data: res.data };
        },

        async logout(): Promise<void> {
          await fetch_("/api/student/auth/logout", { method: "POST" });
        },

        async changePassword(params: {
          currentPassword: string;
          newPassword: string;
        }): Promise<{ ok: boolean; message?: string }> {
          const res = await fetch_<{ ok?: boolean; message?: string }>(
            "/api/student/auth/change-password",
            { method: "POST", body: JSON.stringify(params) },
          );
          return { ok: res.ok, message: res.message };
        },
      },

      projects: {
        async list(): Promise<{ ok: boolean; projects?: StudentProject[]; message?: string }> {
          const res = await fetch_<{ projects?: StudentProject[] } | StudentProject[]>(
            "/api/student/me/projects",
          );
          if (!res.ok) return { ok: false, message: res.message };
          const data = res.data;
          const projects = Array.isArray(data)
            ? (data as StudentProject[])
            : ((data as { projects?: StudentProject[] } | null)?.projects ?? []);
          return { ok: true, projects };
        },

        async get(
          projectId: number,
        ): Promise<{ ok: boolean; detail?: StudentProjectDetail; status?: number; message?: string }> {
          const res = await fetch_<StudentProjectDetail>(
            `/api/student/me/projects/${projectId}`,
          );
          if (!res.ok) return { ok: false, status: res.status, message: res.message };
          return { ok: true, detail: res.data ?? undefined };
        },

        async getUploadUrl(
          projectId: number,
          params: { originalFileName: string; contentType: string; fileSize: number },
        ): Promise<{ ok: boolean; status?: number; data?: UploadUrlResponse; message?: string }> {
          const res = await fetch_<UploadUrlResponse>(
            `/api/student/me/projects/${projectId}/upload-url`,
            { method: "POST", body: JSON.stringify(params) },
          );
          if (!res.ok) return { ok: false, status: res.status, message: res.message };
          return { ok: true, data: res.data ?? undefined };
        },

        async confirmUpload(
          projectId: number,
          params: {
            storageKey: string;
            originalFileName: string;
            contentType: string;
            fileSize: number;
          },
        ): Promise<{ ok: boolean; status?: number; data?: ConfirmUploadResponse; message?: string }> {
          const res = await fetch_<ConfirmUploadResponse>(
            `/api/student/me/projects/${projectId}/confirm-upload`,
            { method: "POST", body: JSON.stringify(params) },
          );
          if (!res.ok) return { ok: false, status: res.status, message: res.message };
          return { ok: true, data: res.data ?? undefined };
        },

        async delete(projectId: number, fileId: number): Promise<{ ok: boolean; message?: string }> {
          const res = await fetch_<unknown>(
            `/api/student/me/projects/${projectId}/files/${fileId}`,
            { method: "DELETE" },
          );
          return { ok: res.ok, message: res.message };
        },

        async offload(projectId: number): Promise<{
          ok: boolean;
          submissionId?: string;
          fileCount?: number;
          submittedAt?: string | null;
          message?: string;
        }> {
          const res = await fetch_<{
            ok?: boolean;
            submissionId?: string;
            fileCount?: number;
            submittedAt?: string | null;
            message?: string;
          }>(`/api/student/me/projects/${projectId}/offload`, { method: "POST" });
          if (!res.ok || !res.data?.ok) {
            return { ok: false, message: res.message ?? res.data?.message };
          }
          return {
            ok: true,
            submissionId: res.data.submissionId,
            fileCount: res.data.fileCount,
            submittedAt: res.data.submittedAt,
          };
        },
      },
    },
  };
}

export type OffloadrClient = ReturnType<typeof createOffloadrClient>;
