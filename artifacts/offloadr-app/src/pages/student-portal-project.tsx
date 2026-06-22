import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useRoute } from "wouter";
import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Upload,
  X,
  ArrowLeft,
  Lock,
  Send,
  Sparkles,
  Trash2,
  FileVideo,
  FileAudio,
  FileImage,
  File as FileIcon,
  CalendarClock,
} from "lucide-react";
import StudentPortalShell from "@/components/student-portal/shell";
import { createOffloadrClient } from "@workspace/client";
import { runUpload } from "@workspace/upload";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type UploadStatus = "queued" | "uploading" | "done" | "error";

interface UploadItem {
  id: string;
  file: File;
  status: UploadStatus;
  errorMessage?: string;
  progress: number;
  serverFileId?: number;
}

interface DraftFile {
  id: number;
  originalFileName: string;
  fileSize: number;
  uploadedAt: string | null;
  submittedAt: string | null;
  submissionId: string | null;
}

interface ProjectDetail {
  project: {
    projectId: number;
    projectName: string;
    organizationName: string;
  };
  locked: boolean;
  draftFiles: DraftFile[];
  submittedFiles: DraftFile[];
}

function formatBytes(bytes: number) {
  if (!+bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function iconForFile(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["mp4", "mov", "webm", "mkv", "avi", "m4v"].includes(ext))
    return FileVideo;
  if (["mp3", "wav", "m4a", "aac", "flac", "ogg"].includes(ext))
    return FileAudio;
  if (["jpg", "jpeg", "png", "gif", "webp", "heic"].includes(ext))
    return FileImage;
  return FileIcon;
}

function kindForFile(file: File): "image" | "video" | "audio" | "other" {
  const mt = file.type.toLowerCase();
  if (mt.startsWith("image/")) return "image";
  if (mt.startsWith("video/")) return "video";
  if (mt.startsWith("audio/")) return "audio";
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (["jpg", "jpeg", "png", "gif", "webp", "heic"].includes(ext)) return "image";
  if (["mp4", "mov", "webm", "mkv", "avi", "m4v"].includes(ext)) return "video";
  if (["mp3", "wav", "m4a", "aac", "flac", "ogg"].includes(ext)) return "audio";
  return "other";
}

/**
 * Renders a 40x40 thumbnail tile for an upload item.
 * - image/video: object-URL preview (revoked on unmount)
 * - audio/other: tinted icon tile
 * Browsers won't decode a full video frame as a poster without seeking,
 * so video falls back to the FileVideo icon tile rather than risking a
 * blank frame on Safari/iOS.
 */
function UploadThumb({ file }: { file: File }) {
  const kind = kindForFile(file);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (kind !== "image") return;
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file, kind]);

  if (kind === "image" && url) {
    return (
      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border border-white/10 bg-black/40">
        <img
          src={url}
          alt={`Preview of ${file.name}`}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>
    );
  }

  const Icon =
    kind === "video"
      ? FileVideo
      : kind === "audio"
        ? FileAudio
        : iconForFile(file.name);
  const tint =
    kind === "video"
      ? "border-[rgb(var(--brand-indigo))]/30 bg-[rgb(var(--brand-indigo))]/10 text-indigo-300"
      : kind === "audio"
        ? "border-[rgb(var(--brand-violet))]/30 bg-[rgb(var(--brand-violet))]/10 text-violet-300"
        : "border-white/10 bg-white/[0.04] text-zinc-400";
  return (
    <div
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md border ${tint}`}
    >
      <Icon className="h-4 w-4" />
    </div>
  );
}

/**
 * Upload a single file to the student draft using presigned R2 URLs.
 *
 * Three-step flow — file bytes NEVER transit Vercel or the Railway API:
 *
 *   Step 1  POST /upload-url   (tiny JSON — safe through Vercel proxy)
 *           Server validates access, generates a storage key, returns
 *           { uploadUrl, storageKey }.
 *
 *   Step 2  XHR PUT directly to R2   (bypasses Vercel entirely)
 *           Browser sends file bytes straight to R2. Progress events
 *           track this step. No Vercel body-size limit, no Railway
 *           timeout on file transit. Ceiling: ~5 GB single PUT.
 *
 *   Step 3  POST /confirm-upload  (tiny JSON — safe through Vercel proxy)
 *           Server calls HeadObject to verify the file landed, inserts
 *           the media_files draft record, returns { fileId }.
 *
 * Fallback: if /upload-url returns { uploadUrl: null } (local dev with
 * filesystem driver) the function falls back to the legacy FormData POST
 * so development works without R2 configured.
 */
async function uploadFilePresigned(
  projectId: number,
  file: File,
  onProgress: (pct: number) => void,
): Promise<{ ok: boolean; status: number; fileId?: number; message?: string }> {
  const fileMime = file.type || "application/octet-stream";
  console.log(`[upload] started: ${file.name} (${file.size} bytes, ${fileMime})`);

  // ── Step 1: request a presigned PUT URL ─────────────────────────────
  let urlRes: Response;
  try {
    urlRes = await fetch(
      `${API_BASE}/api/student/me/projects/${projectId}/upload-url`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalFileName: file.name,
          contentType: fileMime,
          fileSize: file.size,
        }),
      },
    );
  } catch {
    console.log(`[upload] url_fetch_error: network failure on /upload-url`);
    return { ok: false, status: 0, message: "Network error requesting upload URL." };
  }

  if (!urlRes.ok) {
    let message: string | undefined;
    try {
      const body = (await urlRes.json()) as { message?: string; error?: string };
      message = body?.message ?? body?.error;
    } catch { /* ignore */ }
    console.log(`[upload] url_error: ${message ?? urlRes.status}`);
    return { ok: false, status: urlRes.status, message: message ?? "Failed to prepare upload." };
  }

  const { uploadUrl, storageKey } = (await urlRes.json()) as {
    uploadUrl: string | null;
    storageKey: string | null;
  };

  // ── Fallback: local dev without R2 ──────────────────────────────────
  // When the API returns uploadUrl: null (filesystem storage driver in
  // local dev), fall back to the legacy FormData POST through the API.
  if (!uploadUrl || !storageKey) {
    console.log(`[upload] fallback: presigned URL unavailable — using legacy multipart POST`);
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_BASE}/api/student/me/projects/${projectId}/upload`);
      xhr.withCredentials = true;
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          let fileId: number | undefined;
          try { fileId = (JSON.parse(xhr.responseText) as { fileId?: number })?.fileId; } catch { /* ignore */ }
          resolve({ ok: true, status: xhr.status, fileId });
        } else {
          let message: string | undefined;
          try {
            const body = JSON.parse(xhr.responseText) as { message?: string; error?: string };
            message = body?.message ?? body?.error;
          } catch { /* ignore */ }
          resolve({ ok: false, status: xhr.status, message });
        }
      };
      xhr.onerror = () => resolve({ ok: false, status: 0, message: "Network error" });
      const fd = new FormData();
      fd.append("file", file);
      xhr.send(fd);
    });
  }

  console.log(`[upload] url_ready: key=${storageKey}`);

  // ── Step 2: PUT directly to R2 ──────────────────────────────────────
  // XHR goes straight to R2 — completely bypasses Vercel and Railway.
  // Progress events here track real byte transfer to storage.
  // R2 CORS must allow:  PUT from https://www.useoffloadr.com
  const putResult = await new Promise<{ ok: boolean; status: number; message?: string }>(
    (resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", uploadUrl, true);
      xhr.setRequestHeader("Content-Type", fileMime);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          if (pct % 10 === 0 || pct === 100) {
            console.log(`[upload] progress: ${file.name} ${pct}%`);
          }
          onProgress(pct);
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          console.log(`[upload] r2_complete: ${file.name}`);
          resolve({ ok: true, status: xhr.status });
        } else {
          console.log(`[upload] r2_error: ${file.name} status=${xhr.status} — check R2 CORS`);
          resolve({
            ok: false,
            status: xhr.status,
            message:
              xhr.status === 0 || xhr.status === 403
                ? "Upload blocked. The storage bucket may need CORS configured for this domain."
                : `Storage upload failed (${xhr.status}). Please try again.`,
          });
        }
      };
      xhr.onerror = () => {
        console.log(`[upload] r2_network_error: ${file.name} — check R2 CORS`);
        resolve({
          ok: false,
          status: 0,
          message: "Upload blocked by network. The storage bucket may need CORS configured for this domain.",
        });
      };
      xhr.send(file);
    },
  );

  if (!putResult.ok) return putResult;

  // ── Step 3: confirm upload — create draft DB record ─────────────────
  console.log(`[upload] confirming: ${file.name}`);
  let confirmRes: Response;
  try {
    confirmRes = await fetch(
      `${API_BASE}/api/student/me/projects/${projectId}/confirm-upload`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storageKey,
          originalFileName: file.name,
          contentType: fileMime,
          fileSize: file.size,
        }),
      },
    );
  } catch {
    return {
      ok: false,
      status: 0,
      message: "File uploaded but draft creation failed (network error). Refresh the page.",
    };
  }

  if (!confirmRes.ok) {
    let message: string | undefined;
    try {
      const body = (await confirmRes.json()) as { message?: string; error?: string };
      message = body?.message ?? body?.error;
    } catch { /* ignore */ }
    console.log(`[upload] confirm_error: ${message ?? confirmRes.status}`);
    return {
      ok: false,
      status: confirmRes.status,
      message: message ?? "File uploaded but draft record failed. Refresh and check your draft.",
    };
  }

  const confirmBody = (await confirmRes.json()) as {
    ok: boolean;
    fileId: number;
    originalFileName: string;
  };
  console.log(`[upload] draft_created: fileId=${confirmBody.fileId}, file=${file.name}`);
  return { ok: true, status: 201, fileId: confirmBody.fileId };
}

export default function StudentPortalProject() {
  const [location, navigate] = useLocation();
  // Match canonical + legacy alias so old /student-portal/projects/:id URLs
  // (cached LMS links, QR codes) still work instead of "Invalid project".
  const [matchedNew, paramsNew] = useRoute<{ projectId: string }>(
    "/student-projects/:projectId",
  );
  const [matchedOld, paramsOld] = useRoute<{ projectId: string }>(
    "/student-portal/projects/:projectId",
  );
  const matched = matchedNew || matchedOld;
  const rawId = matchedNew
    ? paramsNew?.projectId
    : matchedOld
      ? paramsOld?.projectId
      : undefined;
  const projectId = matched ? Number(rawId) : NaN;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [offloading, setOffloading] = useState(false);
  const [offloadError, setOffloadError] = useState<string | null>(null);
  const [offloadResult, setOffloadResult] = useState<{
    submissionId: string;
    fileCount: number;
    submittedAt: string | null;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!Number.isInteger(projectId) || projectId <= 0) {
      setLoadError("Invalid project.");
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(
        `${API_BASE}/api/student/me/projects/${projectId}`,
        { credentials: "include" },
      );
      if (res.status === 401) {
        navigate("/student-login");
        return;
      }
      if (res.status === 404) {
        setLoadError("Project not found or you don't have access.");
        return;
      }
      if (!res.ok) {
        setLoadError(`Couldn't load project (HTTP ${res.status}).`);
        return;
      }
      const body = (await res.json()) as ProjectDetail;
      setDetail(body);
      setLoadError(null);
    } catch (err) {
      setLoadError(
        err instanceof Error
          ? `Network error: ${err.message}`
          : "Network error.",
      );
    } finally {
      setLoading(false);
    }
  }, [projectId, navigate]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onPickFiles = (picked: FileList | null) => {
    if (!picked || picked.length === 0) return;
    const next: UploadItem[] = Array.from(picked).map((f) => ({
      id: `${f.name}-${f.size}-${f.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
      file: f,
      status: "queued",
      progress: 0,
    }));
    setItems((prev) => [...prev, ...next]);
  };

  const removeQueuedItem = (id: string) => {
    setItems((prev) =>
      prev.filter((i) => i.id !== id || i.status === "uploading"),
    );
  };

  const startUploads = async () => {
    if (!detail || detail.locked) return;
    const queued = items.filter(
      (i) => i.status === "queued" || i.status === "error",
    );
    if (queued.length === 0) return;
    setUploading(true);

    for (const item of queued) {
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? {
                ...i,
                status: "uploading",
                progress: 0,
                errorMessage: undefined,
              }
            : i,
        ),
      );
      const result = await runUpload(
        {
          projectId: detail.project.projectId,
          file: item.file,
          fileName: item.file.name,
          contentType: item.file.type || "application/octet-stream",
          fileSize: item.file.size,
        },
        webClient,
        (pct) => {
          setItems((prev) =>
            prev.map((i) => (i.id === item.id ? { ...i, progress: pct } : i)),
          );
        },
        { baseUrl: API_BASE },
      );
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? result.ok
              ? {
                  ...i,
                  status: "done",
                  progress: 100,
                  serverFileId: result.fileId,
                }
              : {
                  ...i,
                  status: "error",
                  errorMessage:
                    result.message ?? `Upload failed (HTTP ${result.status})`,
                }
            : i,
        ),
      );
    }

    setUploading(false);
    void refresh();
  };

  const deleteDraft = async (fileId: number) => {
    if (!detail) return;
    if (
      !window.confirm(
        "Remove this file from your draft? You can re-upload it before offloading.",
      )
    )
      return;
    try {
      const res = await fetch(
        `${API_BASE}/api/student/me/projects/${detail.project.projectId}/files/${fileId}`,
        { method: "DELETE", credentials: "include" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}) as { message?: string });
        alert(body?.message ?? `Couldn't delete (HTTP ${res.status}).`);
        return;
      }
      void refresh();
    } catch {
      alert("Network error.");
    }
  };

  const offload = async () => {
    if (!detail) return;
    if (
      !window.confirm(
        `Deliver ${detail.draftFiles.length} file${
          detail.draftFiles.length === 1 ? "" : "s"
        } to your teacher? This delivery will be marked complete — your teacher can reopen the project if additional media is needed.`,
      )
    )
      return;
    setOffloading(true);
    setOffloadError(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/student/me/projects/${detail.project.projectId}/offload`,
        { method: "POST", credentials: "include" },
      );
      const body = await res.json().catch(() => ({}) as {
        ok?: boolean;
        submissionId?: string;
        fileCount?: number;
        submittedAt?: string;
        message?: string;
      });
      if (!res.ok || !body?.ok) {
        setOffloadError(body?.message ?? `Offload failed (HTTP ${res.status}).`);
        return;
      }
      setOffloadResult({
        submissionId: body.submissionId ?? "",
        fileCount: body.fileCount ?? detail.draftFiles.length,
        submittedAt: body.submittedAt ?? null,
      });
      void refresh();
    } catch (err) {
      setOffloadError(
        err instanceof Error
          ? `Network error: ${err.message}`
          : "Network error.",
      );
    } finally {
      setOffloading(false);
    }
  };

  const [preparingDraft, setPreparingDraft] = useState(false);
  const [prepareError, setPrepareError] = useState<string | null>(null);

  const prepareFirstCut = async () => {
    if (!detail) return;
    setPreparingDraft(true);
    setPrepareError(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/student/me/projects/${detail.project.projectId}/prepare-draft`,
        { method: "POST", credentials: "include" },
      );
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        timelineId?: number;
        message?: string;
      };
      if (!res.ok || !body?.ok || !body.timelineId) {
        setPrepareError(
          body?.message ?? `Could not prepare first cut (HTTP ${res.status}).`,
        );
        return;
      }
      // Navigate to draft review on whatever URL family we're under
      // (/s/:school/projects/:id  |  /student-projects/:id  |
      // /student-portal/projects/:id). All three are registered.
      const here = location.replace(/\/$/, "");
      navigate(`${here}/draft-review?timelineId=${body.timelineId}`);
    } catch (err) {
      setPrepareError(
        err instanceof Error ? `Network error: ${err.message}` : "Network error.",
      );
    } finally {
      setPreparingDraft(false);
    }
  };

  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current += 1;
    if (dragCounterRef.current === 1) setIsDragging(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) setIsDragging(false);
  };
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragging(false);
    onPickFiles(e.dataTransfer.files);
  };

  if (loading) {
    return (
      <StudentPortalShell>
        <div className="flex items-center justify-center py-20 text-sm text-zinc-400">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading project…
        </div>
      </StudentPortalShell>
    );
  }

  if (loadError || !detail) {
    return (
      <StudentPortalShell>
        <div className="mx-auto max-w-md space-y-4">
          <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {loadError ?? "Project unavailable."}
          </div>
          <button
            onClick={() => navigate("/student-projects")}
            className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-200 transition hover:bg-white/[0.06]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to My Media Projects
          </button>
        </div>
      </StudentPortalShell>
    );
  }

  const draftBytes = detail.draftFiles.reduce(
    (acc, f) => acc + (f.fileSize ?? 0),
    0,
  );
  const allDoneOrEmpty =
    items.length === 0 || items.every((i) => i.status === "done");

  return (
    <StudentPortalShell>
      <div className="mx-auto max-w-3xl space-y-7">
        <button
          onClick={() => navigate("/student-projects")}
          className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-zinc-500 transition hover:text-zinc-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> My Media Projects
        </button>

        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-[1.75rem]">
            {detail.project.projectName}
          </h1>
          <p className="text-xs uppercase tracking-wider text-zinc-500">
            {detail.project.organizationName}
          </p>
        </div>

        {detail.locked && (
          <div className="portal-glass flex items-start gap-3 rounded-xl border-amber-300/20 px-4 py-3 text-sm text-amber-100">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-300/30 bg-amber-400/10 text-amber-200">
              <Lock className="h-4 w-4" />
            </div>
            <div>
              <div className="font-semibold text-amber-100">
                Delivered to your teacher
              </div>
              <div className="mt-0.5 text-xs text-amber-200/80">
                This delivery has been completed. Your teacher can reopen the
                project if additional media is needed.
              </div>
            </div>
          </div>
        )}

        {offloadResult && (
          <div className="portal-glass relative overflow-hidden rounded-2xl px-5 py-5 sm:px-6 sm:py-6">
            {/* Soft glow behind the tick — pure CSS, no animation lib. */}
            <div className="pointer-events-none absolute -left-12 -top-12 h-48 w-48 rounded-full bg-emerald-400/15 blur-3xl" />
            <div className="relative flex items-start gap-4">
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/30 bg-emerald-400/10 text-emerald-200">
                <div className="absolute inset-0 rounded-2xl bg-emerald-400/10 animate-pulse" />
                <CheckCircle2 className="relative h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-base font-semibold text-emerald-50">
                  Files safely handed to your teacher
                </div>
                <div className="mt-1 text-sm leading-relaxed text-emerald-100/80">
                  {offloadResult.fileCount} file
                  {offloadResult.fileCount === 1 ? "" : "s"} delivered. Your
                  teacher has been notified by email.
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px]">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/[0.06] px-2 py-0.5 text-emerald-200/90">
                    <CheckCircle2 className="h-3 w-3" />
                    Confirmation email sent
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-emerald-200/60">
                    <CalendarClock className="h-3 w-3" />
                    {new Date(offloadResult.submittedAt ?? Date.now()).toLocaleString(
                      "en-AU",
                      {
                        timeZone: "Australia/Adelaide",
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                        hour12: true,
                      },
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {!detail.locked && (
          <section className="portal-glass rounded-xl p-5 sm:p-6">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-white">
                Add files to draft
              </h2>
              <p className="mt-1 text-xs text-zinc-400">
                Files saved here are{" "}
                <span className="font-medium text-zinc-200">not</span> sent yet
                — check them below, then press{" "}
                <span className="font-medium text-zinc-200">
                  Offload to Teacher
                </span>{" "}
                when you're ready to deliver.
              </p>
            </div>

            <div
              onDragEnter={onDragEnter}
              onDragLeave={onDragLeave}
              onDragOver={onDragOver}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-4 py-10 text-center transition ${
                isDragging
                  ? "portal-drop-glow border-[rgb(var(--brand-blue))]/70 bg-[rgb(var(--brand-blue))]/[0.10]"
                  : "border-white/10 bg-black/20 hover:border-white/20 hover:bg-black/30"
              }`}
            >
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-[rgb(var(--brand-blue))]/30 bg-[rgb(var(--brand-blue))]/10 text-[rgb(125,191,255)]">
                <Upload className="h-5 w-5" />
              </div>
              <div className="text-sm font-medium text-zinc-100">
                Drop files here, or click to choose
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                Video · audio · image · document. Up to 10 GB per file.
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => onPickFiles(e.target.files)}
              />
            </div>

            {items.length > 0 && (
              <ul className="mt-4 space-y-1.5">
                {items.map((i) => (
                  <li
                    key={i.id}
                    className={`flex items-center gap-3 rounded-md border bg-black/20 px-3 py-2 text-sm transition-colors ${
                      i.status === "done"
                        ? "border-emerald-400/20"
                        : i.status === "error"
                          ? "border-red-400/25"
                          : "border-white/5"
                    }`}
                  >
                    <UploadThumb file={i.file} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-zinc-200">
                        {i.file.name}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-zinc-500">
                        <span>{formatBytes(i.file.size)}</span>
                        {i.status === "uploading" && (
                          <>
                            <span>·</span>
                            <span className="text-[rgb(125,191,255)]">
                              {i.progress}%
                            </span>
                          </>
                        )}
                        {i.status === "error" && i.errorMessage && (
                          <>
                            <span>·</span>
                            <span className="text-red-300">
                              {i.errorMessage}
                            </span>
                          </>
                        )}
                        {i.status === "done" && (
                          <>
                            <span>·</span>
                            <span className="text-emerald-300">
                              added to draft
                            </span>
                          </>
                        )}
                      </div>
                      {i.status === "uploading" && (
                        <div className="relative mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                          <div
                            className="portal-progress-shimmer relative h-full overflow-hidden rounded-full bg-gradient-to-r from-[rgb(var(--brand-blue))] via-[rgb(var(--brand-indigo))] to-[rgb(var(--brand-violet))] transition-[width] duration-150"
                            style={{ width: `${Math.max(2, i.progress)}%` }}
                          />
                        </div>
                      )}
                    </div>
                    {i.status === "done" && (
                      <CheckCircle2
                        key={`done-${i.id}`}
                        className="portal-tick-pop h-4 w-4 shrink-0 text-emerald-400"
                      />
                    )}
                    {i.status === "error" && (
                      <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
                    )}
                    {i.status === "uploading" && (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-zinc-400" />
                    )}
                    {i.status !== "uploading" && i.status !== "done" && (
                      <button
                        type="button"
                        onClick={() => removeQueuedItem(i.id)}
                        className="rounded p-1 text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200"
                        aria-label="Remove"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <button
              onClick={startUploads}
              disabled={
                uploading ||
                items.filter(
                  (i) => i.status === "queued" || i.status === "error",
                ).length === 0
              }
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-zinc-100 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading…
                </>
              ) : (
                "Upload to draft"
              )}
            </button>
          </section>
        )}

        <section className="portal-glass rounded-xl p-5 sm:p-6">
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-white">
                Draft
                <span className="ml-2 text-xs font-normal text-zinc-500">
                  {detail.draftFiles.length} file
                  {detail.draftFiles.length === 1 ? "" : "s"}
                  {detail.draftFiles.length > 0 &&
                    ` · ${formatBytes(draftBytes)}`}
                </span>
              </h2>
              <p className="mt-1 text-xs text-zinc-400">
                {detail.draftFiles.length === 0
                  ? "Nothing here yet. Add files above to get started."
                  : "Check your files before delivering to your teacher."}
              </p>
            </div>
          </div>

          {detail.draftFiles.length > 0 && (
            <ul className="space-y-1.5">
              {detail.draftFiles.map((f) => {
                const Icon = iconForFile(f.originalFileName);
                return (
                  <li
                    key={f.id}
                    className="flex items-center gap-3 rounded-md border border-white/5 bg-black/20 px-3 py-2 text-sm"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-zinc-500" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-zinc-100">
                        {f.originalFileName}
                      </div>
                      <div className="text-[11px] text-zinc-500">
                        {formatBytes(f.fileSize ?? 0)} · draft
                      </div>
                    </div>
                    {!detail.locked && (
                      <button
                        type="button"
                        onClick={() => deleteDraft(f.id)}
                        className="rounded p-1 text-zinc-500 transition hover:bg-red-500/10 hover:text-red-300"
                        aria-label="Remove draft file"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {(offloadError || prepareError) && (
            <div className="mt-4 rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              {offloadError ?? prepareError}
            </div>
          )}

          {!detail.locked && (
            <>
              {detail.draftFiles.length > 0 && allDoneOrEmpty && (
                <div className="portal-ready-chip mt-5 flex items-center justify-center gap-2 rounded-md border border-emerald-400/25 bg-emerald-500/[0.08] px-3 py-2 text-xs text-emerald-200">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span className="font-medium">Safe to Offload</span>
                  <span className="text-emerald-300/70">
                    · {detail.draftFiles.length} file
                    {detail.draftFiles.length === 1 ? "" : "s"} ready
                  </span>
                </div>
              )}

              {/* Stage 2.1.5c — Choice panel replaces the single Offload
                  CTA once at least one draft file is uploaded and all
                  in-flight uploads have settled. */}
              {detail.draftFiles.length > 0 && allDoneOrEmpty && (
                <div className="mt-4">
                  <p className="mb-3 text-center text-[11px] uppercase tracking-wider text-zinc-500">
                    What would you like to do next?
                  </p>
                  <button
                    onClick={prepareFirstCut}
                    disabled={preparingDraft || offloading}
                    className="group relative w-full overflow-hidden rounded-xl px-5 py-4 text-left shadow-lg shadow-violet-900/30 transition disabled:cursor-not-allowed disabled:opacity-60"
                    style={{
                      background:
                        "linear-gradient(135deg, #2563eb 0%, #7c3aed 55%, #a855f7 100%)",
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/25">
                        {preparingDraft ? (
                          <Loader2 className="h-5 w-5 animate-spin text-white" />
                        ) : (
                          <Sparkles className="h-5 w-5 text-white" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-white">
                          {preparingDraft
                            ? "Preparing your first cut…"
                            : "Prepare First Cut"}
                        </div>
                        <div className="text-[11px] text-white/80">
                          Arrange the order, remove clips, edit the title
                          card — then send to your teacher.
                        </div>
                      </div>
                    </div>
                    <div
                      className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100"
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(255,255,255,0.08), transparent 60%)",
                      }}
                    />
                  </button>

                  <button
                    onClick={offload}
                    disabled={offloading || preparingDraft}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2.5 text-xs font-medium text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {offloading ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Sending raw files…
                      </>
                    ) : (
                      <>
                        <Send className="h-3.5 w-3.5" />
                        Send raw files to teacher
                      </>
                    )}
                  </button>
                </div>
              )}

              {detail.draftFiles.length > 0 && !allDoneOrEmpty && (
                <p className="mt-3 text-center text-[11px] text-zinc-500">
                  Wait for all uploads to finish before offloading.
                </p>
              )}
              {detail.draftFiles.length === 0 && (
                <p className="mt-3 text-center text-[11px] text-zinc-500">
                  Add at least one file to get started.
                </p>
              )}
            </>
          )}
        </section>

        {detail.submittedFiles.length > 0 && (
          <section className="portal-glass rounded-xl p-5 sm:p-6">
            <h2 className="mb-1 text-sm font-semibold text-zinc-200">
              Previously delivered ({detail.submittedFiles.length})
            </h2>
            <p className="mb-4 text-xs text-zinc-500">
              Sent to your teacher in earlier deliveries.
            </p>
            <ul className="space-y-1">
              {detail.submittedFiles.map((f) => {
                const Icon = iconForFile(f.originalFileName);
                return (
                  <li
                    key={f.id}
                    className="flex items-center gap-3 rounded-md px-3 py-1.5 text-xs text-zinc-400"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400/80" />
                    <Icon className="h-3.5 w-3.5 shrink-0 text-zinc-600" />
                    <div className="min-w-0 flex-1 truncate text-zinc-300">
                      {f.originalFileName}
                    </div>
                    <div className="shrink-0 text-zinc-500">
                      {formatBytes(f.fileSize ?? 0)}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </StudentPortalShell>
  );
}

