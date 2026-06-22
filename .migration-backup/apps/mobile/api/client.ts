import { useAuthStore } from "@/store/auth";

export const API_BASE = "https://www.useoffloadr.com";

export async function loginAndGetSession(params: {
  organizationSlug: string;
  username: string;
  password: string;
}): Promise<
  | { ok: true; sessionToken: string; studentId: number; displayName: string; orgId: number; orgSlug: string; orgName: string }
  | { ok: false; message: string }
> {
  try {
    const res = await fetch(`${API_BASE}/api/student/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    const data = await res.json() as Record<string, unknown>;
    if (!res.ok || !(data as { ok?: boolean }).ok) {
      return { ok: false, message: (data as { message?: string }).message ?? "Login failed." };
    }
    const { sessionToken, studentId, displayName, organizationId, organizationSlug, organizationName } = data as {
      sessionToken?: string;
      studentId?: number;
      displayName?: string;
      organizationId?: number;
      organizationSlug?: string;
      organizationName?: string;
    };
    if (!sessionToken) return { ok: false, message: "No session token returned." };
    return {
      ok: true,
      sessionToken,
      studentId: studentId ?? 0,
      displayName: displayName ?? "",
      orgId: organizationId ?? 0,
      orgSlug: organizationSlug ?? params.organizationSlug,
      orgName: organizationName ?? params.organizationSlug,
    };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Network error." };
  }
}

function getToken(): string | null {
  return useAuthStore.getState().user?.sessionToken ?? null;
}

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<{ ok: boolean; data?: T; message?: string; status: number }> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts?.headers,
    },
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try { message = ((await res.json()) as { message?: string }).message ?? message; } catch {}
    return { ok: false, message, status: res.status };
  }
  const data = await res.json() as T;
  return { ok: true, data, status: res.status };
}

export interface StudentProject {
  projectId: number;
  projectName: string;
  organizationName: string;
}

export interface StudentFile {
  id: number;
  originalFileName: string;
  fileSize: number;
  uploadedAt?: string;
  submittedAt?: string;
}

export interface StudentProjectDetail {
  projectId: number;
  projectName: string;
  locked: boolean;
  draftFiles: StudentFile[];
  submittedFiles: StudentFile[];
}

export const offloadrApi = {
  student: {
    projects: {
      list: () => apiFetch<{ ok: boolean; projects?: StudentProject[] }>("/api/student/projects"),
      get: (id: number) => apiFetch<{ ok: boolean; detail?: StudentProjectDetail }>(`/api/student/projects/${id}`),
    },
    files: {
      requestUpload: (params: { projectId: number; fileName: string; contentType: string; fileSize: number }) =>
        apiFetch<{ ok: boolean; uploadUrl?: string; storageKey?: string; fileId?: number }>("/api/student/files/request-upload", {
          method: "POST",
          body: JSON.stringify(params),
        }),
      confirmUpload: (params: { fileId: number; storageKey: string }) =>
        apiFetch<{ ok: boolean }>("/api/student/files/confirm-upload", {
          method: "POST",
          body: JSON.stringify(params),
        }),
    },
    auth: {
      logout: () => apiFetch("/api/student/auth/logout", { method: "POST" }),
    },
  },
};
