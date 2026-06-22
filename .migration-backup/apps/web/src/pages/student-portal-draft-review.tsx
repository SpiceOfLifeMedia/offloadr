import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import {
  Loader2,
  ArrowLeft,
  GripVertical,
  X,
  Send,
  Sparkles,
  FileVideo,
  FileAudio,
  FileImage,
  File as FileIcon,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import StudentPortalShell from "@/components/student-portal/shell";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface TimelineClip {
  fileId: number;
  fileName: string;
  fileSize: number;
  fileType: string | null;
}

interface Timeline {
  id: number;
  projectId: number;
  projectName: string;
  organizationName: string;
  teacherName: string | null;
  smartDraftGenerated: boolean;
  titleCardText: string;
  clips: TimelineClip[];
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

// Try every route family this page can be mounted under.
type RouteParams = { school?: string; projectId?: string };
function useDraftRouteParams(): {
  projectId: number | null;
  backHref: string;
} {
  const [schoolMatch, schoolParams] = useRoute<RouteParams>(
    "/s/:school/projects/:projectId/draft-review",
  );
  const [legacyMatch, legacyParams] = useRoute<RouteParams>(
    "/student-projects/:projectId/draft-review",
  );
  const [portalMatch, portalParams] = useRoute<RouteParams>(
    "/student-portal/projects/:projectId/draft-review",
  );

  if (schoolMatch && schoolParams?.projectId) {
    return {
      projectId: Number(schoolParams.projectId),
      backHref: `/s/${schoolParams.school}/projects/${schoolParams.projectId}`,
    };
  }
  if (legacyMatch && legacyParams?.projectId) {
    return {
      projectId: Number(legacyParams.projectId),
      backHref: `/student-projects/${legacyParams.projectId}`,
    };
  }
  if (portalMatch && portalParams?.projectId) {
    return {
      projectId: Number(portalParams.projectId),
      backHref: `/student-portal/projects/${portalParams.projectId}`,
    };
  }
  return { projectId: null, backHref: "/student-projects" };
}

export default function StudentPortalDraftReview() {
  const [, navigate] = useLocation();
  const { projectId, backHref } = useDraftRouteParams();

  // Pull ?timelineId=N. Memoised because URLSearchParams reparses on
  // every render otherwise.
  const timelineIdFromQuery = useMemo(() => {
    if (typeof window === "undefined") return null;
    const p = new URLSearchParams(window.location.search);
    const v = Number(p.get("timelineId"));
    return Number.isInteger(v) && v > 0 ? v : null;
  }, []);

  const [timelineId, setTimelineId] = useState<number | null>(
    timelineIdFromQuery,
  );
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [offloading, setOffloading] = useState(false);
  const [offloadError, setOffloadError] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  // If no ?timelineId was passed (e.g. user bookmarked the page), call
  // prepare-draft to create or reuse one for this project.
  const ensureTimeline = useCallback(async () => {
    if (!projectId) {
      setLoadError("Project not found.");
      setLoading(false);
      return;
    }
    if (timelineId) return;
    try {
      const res = await fetch(
        `${API_BASE}/api/student/me/projects/${projectId}/prepare-draft`,
        { method: "POST", credentials: "include" },
      );
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        timelineId?: number;
        message?: string;
      };
      if (!res.ok || !body?.ok || !body.timelineId) {
        setLoadError(
          body?.message ?? `Couldn't load your first cut (HTTP ${res.status}).`,
        );
        setLoading(false);
        return;
      }
      setTimelineId(body.timelineId);
    } catch {
      setLoadError("Network error.");
      setLoading(false);
    }
  }, [projectId, timelineId]);

  const loadTimeline = useCallback(async () => {
    if (!timelineId) return;
    try {
      const res = await fetch(
        `${API_BASE}/api/student/me/timelines/${timelineId}`,
        { credentials: "include" },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        setLoadError(
          body?.message ?? `Couldn't load your first cut (HTTP ${res.status}).`,
        );
        setLoading(false);
        return;
      }
      const body = (await res.json()) as { ok: boolean; timeline: Timeline };
      setTimeline(body.timeline);
      setLoadError(null);
    } catch {
      setLoadError("Network error.");
    } finally {
      setLoading(false);
    }
  }, [timelineId]);

  useEffect(() => {
    void ensureTimeline();
  }, [ensureTimeline]);

  useEffect(() => {
    if (timelineId) void loadTimeline();
  }, [timelineId, loadTimeline]);

  // Server PATCH. Returns true on success, false on any failure so the
  // caller can roll back the optimistic UI update.
  const patchTimeline = useCallback(
    async (next: {
      clips?: TimelineClip[];
      titleCardText?: string;
    }): Promise<boolean> => {
      if (!timelineId) return false;
      setSaving(true);
      try {
        const payload: Record<string, unknown> = {};
        if (next.clips)
          payload["clips"] = next.clips.map((c) => ({ fileId: c.fileId }));
        if (typeof next.titleCardText === "string")
          payload["titleCardText"] = next.titleCardText;
        const res = await fetch(
          `${API_BASE}/api/student/me/timelines/${timelineId}`,
          {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
        );
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            message?: string;
          };
          setLoadError(body?.message ?? `Save failed (HTTP ${res.status}).`);
          return false;
        }
        return true;
      } catch {
        setLoadError("Network error while saving.");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [timelineId],
  );

  // Optimistic + rollback. On PATCH failure we restore the previous
  // clip list so the on-screen state matches what the server persisted.
  const reorderClips = (from: number, to: number) => {
    if (!timeline) return;
    if (from === to) return;
    const prev = timeline.clips;
    const next = [...prev];
    const [moved] = next.splice(from, 1);
    if (!moved) return;
    next.splice(to, 0, moved);
    setTimeline({ ...timeline, clips: next });
    void patchTimeline({ clips: next }).then((ok) => {
      if (!ok)
        setTimeline((t) => (t ? { ...t, clips: prev } : t));
    });
  };

  const removeClip = (fileId: number) => {
    if (!timeline) return;
    const prev = timeline.clips;
    const next = prev.filter((c) => c.fileId !== fileId);
    setTimeline({ ...timeline, clips: next });
    void patchTimeline({ clips: next }).then((ok) => {
      if (!ok)
        setTimeline((t) => (t ? { ...t, clips: prev } : t));
    });
  };

  const onTitleChange = (text: string) => {
    if (!timeline) return;
    setTimeline({ ...timeline, titleCardText: text });
  };

  const onTitleBlur = () => {
    if (!timeline) return;
    void patchTimeline({ titleCardText: timeline.titleCardText });
  };

  const offloadToTeacher = async () => {
    if (!timeline || !projectId) return;
    if (timeline.clips.length === 0) {
      setOffloadError(
        "Your first cut has no clips. Add files or send the raw files instead.",
      );
      return;
    }
    setOffloading(true);
    setOffloadError(null);
    try {
      // Single atomic server call: finalize handler does the offload
      // (file lock + teacher email) FIRST, then stamps the timeline —
      // so there is no half-finalised state if the client disconnects.
      const res = await fetch(
        `${API_BASE}/api/student/me/timelines/${timeline.id}/finalize`,
        { method: "POST", credentials: "include" },
      );
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
      };
      if (!res.ok || !body?.ok) {
        setOffloadError(
          body?.message ?? `Couldn't send to your teacher (HTTP ${res.status}).`,
        );
        return;
      }
      navigate(backHref);
    } catch (err) {
      setOffloadError(
        err instanceof Error ? `Network error: ${err.message}` : "Network error.",
      );
    } finally {
      setOffloading(false);
    }
  };

  const sendRawInstead = async () => {
    if (!projectId) return;
    if (
      !window.confirm(
        "Skip the first cut and send the raw files to your teacher instead?",
      )
    )
      return;
    setOffloading(true);
    setOffloadError(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/student/me/projects/${projectId}/offload`,
        { method: "POST", credentials: "include" },
      );
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
      };
      if (!res.ok || !body?.ok) {
        setOffloadError(
          body?.message ?? `Offload failed (HTTP ${res.status}).`,
        );
        return;
      }
      navigate(backHref);
    } catch {
      setOffloadError("Network error.");
    } finally {
      setOffloading(false);
    }
  };

  if (loading) {
    return (
      <StudentPortalShell>
        <div className="flex items-center justify-center py-20 text-sm text-zinc-400">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Preparing your first cut…
        </div>
      </StudentPortalShell>
    );
  }

  if (loadError || !timeline) {
    return (
      <StudentPortalShell>
        <div className="mx-auto max-w-md space-y-4">
          <div className="flex items-start gap-2 rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{loadError ?? "First cut unavailable."}</span>
          </div>
          <button
            onClick={() => navigate(backHref)}
            className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-200 transition hover:bg-white/[0.06]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to project
          </button>
        </div>
      </StudentPortalShell>
    );
  }

  return (
    <StudentPortalShell>
      <div className="mx-auto max-w-2xl space-y-5">
        {/* Header */}
        <div>
          <button
            onClick={() => navigate(backHref)}
            className="mb-3 inline-flex items-center gap-1.5 text-xs text-zinc-500 transition hover:text-zinc-300"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to project
          </button>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-violet-300/80">
            <Sparkles className="h-3 w-3" />
            First Cut · Sequence
          </div>
          <h1 className="mt-1 text-xl font-semibold text-zinc-50">
            {timeline.projectName}
          </h1>
          <p className="mt-0.5 text-xs text-zinc-500">
            {timeline.organizationName}
            {timeline.teacherName ? ` · ${timeline.teacherName}` : ""}
          </p>
        </div>

        {/* Status pill */}
        <div className="portal-glass flex items-center gap-2 rounded-lg px-3 py-2 text-xs">
          <span className="inline-flex h-2 w-2 rounded-full bg-violet-400" />
          <span className="font-medium text-zinc-200">Ready to Deliver</span>
          <span className="text-zinc-500">
            · {timeline.clips.length} clip
            {timeline.clips.length === 1 ? "" : "s"}
          </span>
          {saving && (
            <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-zinc-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              Saving…
            </span>
          )}
        </div>

        {/* Title card */}
        <section className="portal-glass rounded-xl p-5">
          <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Title card text
          </label>
          <input
            type="text"
            value={timeline.titleCardText}
            onChange={(e) => onTitleChange(e.target.value)}
            onBlur={onTitleBlur}
            maxLength={120}
            placeholder="What's this video about?"
            className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-violet-400/40 focus:ring-1 focus:ring-violet-400/30"
          />
          <p className="mt-1.5 text-[10px] text-zinc-500">
            Shown at the start of your first cut.
          </p>
        </section>

        {/* Clip list */}
        <section className="portal-glass rounded-xl p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-zinc-200">
              Timeline ({timeline.clips.length})
            </h2>
            <p className="text-[10px] text-zinc-500">Drag to reorder</p>
          </div>

          {timeline.clips.length === 0 ? (
            <div className="rounded-md border border-dashed border-white/10 bg-black/20 px-4 py-6 text-center text-xs text-zinc-500">
              No clips left in this cut. Send raw files instead, or add more
              files on the project page.
            </div>
          ) : (
            <ul className="space-y-2">
              {timeline.clips.map((clip, idx) => {
                const Icon = iconForFile(clip.fileName);
                const isDragging = dragIndex === idx;
                return (
                  <li
                    key={clip.fileId}
                    draggable
                    onDragStart={(e) => {
                      setDragIndex(idx);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragIndex === null) return;
                      reorderClips(dragIndex, idx);
                      setDragIndex(null);
                    }}
                    onDragEnd={() => setDragIndex(null)}
                    className={`group flex items-center gap-3 rounded-lg border bg-black/30 px-3 py-2.5 text-sm transition ${
                      isDragging
                        ? "border-violet-400/40 opacity-50"
                        : "border-white/5 hover:border-white/15"
                    }`}
                  >
                    <GripVertical className="h-4 w-4 cursor-grab text-zinc-600" />
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-violet-500/15 text-[10px] font-semibold text-violet-200 ring-1 ring-violet-400/20">
                      {idx + 1}
                    </div>
                    <Icon className="h-4 w-4 shrink-0 text-zinc-500" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-zinc-100">
                        {clip.fileName}
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        {formatBytes(clip.fileSize)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeClip(clip.fileId)}
                      className="rounded p-1 text-zinc-500 opacity-0 transition group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-300"
                      aria-label={`Remove ${clip.fileName}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Actions */}
        {offloadError && (
          <div className="flex items-start gap-2 rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{offloadError}</span>
          </div>
        )}

        <button
          onClick={offloadToTeacher}
          disabled={offloading || timeline.clips.length === 0}
          className="group relative w-full overflow-hidden rounded-xl px-5 py-4 shadow-lg shadow-violet-900/30 transition disabled:cursor-not-allowed disabled:opacity-60"
          style={{
            background:
              "linear-gradient(135deg, #2563eb 0%, #7c3aed 55%, #a855f7 100%)",
          }}
        >
          <div className="flex items-center justify-center gap-2 text-sm font-semibold text-white">
            {offloading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending to teacher…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Offload to Teacher
              </>
            )}
          </div>
        </button>

        <button
          onClick={sendRawInstead}
          disabled={offloading}
          className="block w-full text-center text-xs text-zinc-500 underline-offset-2 transition hover:text-zinc-300 hover:underline disabled:opacity-50"
        >
          Send raw files instead
        </button>

        <p className="pt-2 text-center text-[10px] text-zinc-600">
          <CheckCircle2 className="-mt-0.5 mr-1 inline h-3 w-3 text-emerald-400/70" />
          You can adjust the order again before your teacher gets it.
        </p>
      </div>
    </StudentPortalShell>
  );
}
