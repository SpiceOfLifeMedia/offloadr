import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import {
  useGetProject,
  useListRecordingSessions,
  useCreateRecordingSession,
  useUpdateRecordingSession,
  useListParticipants,
  getListRecordingSessionsQueryKey,
  getGetProjectQueryKey,
  getListParticipantsQueryKey,
  type RecordingSession,
} from "@/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";

type Status = RecordingSession["status"];

type ConfidenceKey = "audio" | "video" | "storage" | "helper";

const CONFIDENCE_LABELS: Record<ConfidenceKey, string> = {
  audio: "Audio",
  video: "Camera feeds",
  storage: "Recording drive",
  helper: "Helper app",
};

// Confidence dots are click-to-toggle in dev so we can demo failure states.
// In production they are read-only display.
const CONFIDENCE_INTERACTIVE = import.meta.env.DEV;

function formatTimer(ms: number): string {
  const totalMs = Math.max(0, Math.floor(ms));
  const m = Math.floor(totalMs / 60000);
  const s = Math.floor((totalMs % 60000) / 1000);
  const cs = Math.floor((totalMs % 1000) / 10);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}:${String(cs).padStart(2, "0")}`;
}

export default function ProducerMode() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: project } = useGetProject(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectQueryKey(projectId) },
  });
  const { data: sessions } = useListRecordingSessions(projectId, {
    query: { enabled: !!projectId, queryKey: getListRecordingSessionsQueryKey(projectId) },
  });
  const { data: participants } = useListParticipants(projectId, {
    query: { enabled: !!projectId, queryKey: getListParticipantsQueryKey(projectId) },
  });

  const createSession = useCreateRecordingSession();
  const updateSession = useUpdateRecordingSession();

  // Confidence — V1 has no real hardware. Defaults to all green.
  const [confidence, setConfidence] = useState<Record<ConfidenceKey, "green" | "amber" | "red">>({
    audio: "green",
    video: "green",
    storage: "green",
    helper: "green",
  });

  // Active session is server-authoritative.
  const [activeId, setActiveId] = useState<number | null>(null);
  const serverActive = useMemo<RecordingSession | undefined>(() => {
    if (!sessions) return undefined;
    return sessions.find((s) => s.status !== "complete" && s.status !== "error");
  }, [sessions]);
  useEffect(() => {
    if (serverActive && serverActive.id !== activeId) {
      setActiveId(serverActive.id);
    }
  }, [serverActive, activeId]);
  const active = useMemo<RecordingSession | undefined>(
    () => sessions?.find((s) => s.id === activeId) ?? serverActive,
    [sessions, activeId, serverActive],
  );

  // Take number = next take after the most recent completed take, or 1.
  const completedTakeCount = useMemo(
    () => (sessions ?? []).filter((s) => s.status === "complete").length,
    [sessions],
  );
  const currentTakeNumber =
    active && active.status !== "complete" && active.status !== "error"
      ? completedTakeCount + 1
      : completedTakeCount + 1;

  // Timer
  const [now, setNow] = useState<number>(Date.now());
  useEffect(() => {
    if (active?.status !== "recording") return;
    const t = setInterval(() => setNow(Date.now()), 50);
    return () => clearInterval(t);
  }, [active?.status]);

  const elapsedMs = useMemo(() => {
    if (!active?.startedAt) return 0;
    if (active.status === "recording") {
      return now - new Date(active.startedAt).getTime();
    }
    return active.durationMs ?? 0;
  }, [active?.startedAt, active?.status, active?.durationMs, now]);

  // Stop confirm + simulated upload
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const uploadTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListRecordingSessionsQueryKey(projectId) });
    queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
  };

  // Checklist
  const checklist = useMemo(() => {
    return [
      { label: "Project named", ok: !!project?.projectName, fix: "Add a project name in the project setup." },
      { label: "Audio", ok: confidence.audio === "green", fix: "Check audio inputs and levels." },
      { label: "Camera feeds", ok: confidence.video === "green", fix: "Check camera feeds." },
      { label: "Recording drive", ok: confidence.storage === "green", fix: "Check the recording drive has free space." },
      { label: "Helper app", ok: confidence.helper === "green", fix: "Reconnect the helper app to this project." },
    ];
  }, [project?.projectName, confidence]);

  const checklistOk = checklist.every((c) => c.ok);
  const failing = checklist.filter((c) => !c.ok);

  const transitionTo = (id: number, status: Status, extra?: Record<string, unknown>) =>
    new Promise<void>((resolve, reject) => {
      updateSession.mutate(
        { id, data: { status, ...extra } as Parameters<typeof updateSession.mutate>[0]["data"] },
        {
          onSuccess: () => {
            invalidate();
            resolve();
          },
          onError: (err) => reject(err),
        },
      );
    });

  const handlePressRecord = async () => {
    if (!checklistOk) return;
    if (active && (active.status === "ready" || active.status === "idle")) {
      await transitionTo(active.id, "recording");
      return;
    }
    createSession.mutate(
      { id: projectId, data: {} },
      {
        onSuccess: async (s) => {
          setActiveId(s.id);
          try {
            await transitionTo(s.id, "ready");
            await transitionTo(s.id, "recording");
          } catch {
            /* surfaced via mutation error state */
          }
        },
      },
    );
  };

  const handleConfirmStop = async () => {
    if (!active) return;
    setShowStopConfirm(false);
    try {
      await transitionTo(active.id, "stopping");
      await transitionTo(active.id, "uploading");
      setUploadPct(0);
      if (uploadTimerRef.current) clearInterval(uploadTimerRef.current);
      uploadTimerRef.current = setInterval(() => {
        setUploadPct((p) => {
          const next = Math.min(100, p + Math.random() * 9 + 4);
          if (next >= 100) {
            if (uploadTimerRef.current) clearInterval(uploadTimerRef.current);
            const fileRefs = [
              { id: `sim-${active.id}-master`, label: "Master mix (simulated)" },
              { id: `sim-${active.id}-multitrack`, label: "Multitrack stems (simulated)" },
              { id: `sim-${active.id}-video`, label: "Video reference (simulated)" },
            ];
            void transitionTo(active.id, "complete", { fileRefs });
          }
          return next;
        });
      }, 250);
    } catch {
      /* error state surfaced by mutation */
    }
  };

  useEffect(() => {
    return () => {
      if (uploadTimerRef.current) clearInterval(uploadTimerRef.current);
    };
  }, []);

  // Status banner copy
  const statusCopy: Record<Status, { headline: string; sub: string; tone: string }> = {
    idle: { headline: "Standby", sub: "Get the helper app ready, then press RECORD.", tone: "text-zinc-300" },
    ready: { headline: "Ready", sub: "All checks passed. Press RECORD to start.", tone: "text-emerald-400" },
    recording: { headline: "Recording", sub: "Session is live.", tone: "text-red-400" },
    stopping: { headline: "Stopping", sub: "Closing out the session…", tone: "text-amber-300" },
    uploading: { headline: "Uploading", sub: "Moving files to storage…", tone: "text-amber-300" },
    complete: { headline: "Complete", sub: "Files uploaded. Project advancing.", tone: "text-emerald-400" },
    error: { headline: "Error", sub: active?.errorMessage ?? "Something went wrong.", tone: "text-red-400" },
  };

  const currentStatus: Status = active?.status ?? (checklistOk ? "ready" : "idle");
  const recordEnabled =
    checklistOk &&
    (!active ||
      active.status === "ready" ||
      active.status === "idle" ||
      active.status === "complete" ||
      active.status === "error");

  // Talent line: up to 3 names, then "+N more". Mic labels collapsed if any present.
  const talentList = (participants ?? []).map((p) => p.name).filter(Boolean);
  const talentSummary =
    talentList.length === 0
      ? null
      : talentList.length <= 3
        ? talentList.join(", ")
        : `${talentList.slice(0, 3).join(", ")} +${talentList.length - 3} more`;
  const micLabels = (participants ?? [])
    .map((p) => p.micLabel)
    .filter((m): m is string => !!m && m.trim() !== "");
  const micSummary = micLabels.length > 0 ? micLabels.join(" · ") : null;

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      {/* Top bar — minimal */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-900">
        <Link href={`/projects/${projectId}`}>
          <Button variant="ghost" size="sm" className="gap-2 text-zinc-400 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Exit Producer Mode
          </Button>
        </Link>
        <div className="text-sm text-zinc-500 truncate max-w-[50%]">
          {project?.projectName ?? "Loading…"}
        </div>
      </div>

      {/* Take/talent strip — the production context */}
      {(project || talentSummary) && (
        <div className="border-b border-zinc-900 bg-zinc-900/40 px-6 py-3">
          <div className="max-w-4xl mx-auto flex flex-wrap items-center gap-x-6 gap-y-1.5 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-semibold">
                Next take
              </span>
              <span className="font-mono font-semibold text-white tabular-nums">
                #{String(currentTakeNumber).padStart(2, "0")}
              </span>
            </div>
            {project?.episodeTitle && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-semibold">
                  Episode
                </span>
                <span className="text-zinc-200 truncate max-w-xs">{project.episodeTitle}</span>
              </div>
            )}
            {talentSummary && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-semibold">
                  Talent
                </span>
                <span className="text-zinc-200">{talentSummary}</span>
              </div>
            )}
            {micSummary && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-semibold">
                  Mics
                </span>
                <span className="font-mono text-zinc-300 text-xs">{micSummary}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main appliance area */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="text-center mb-8">
          <div
            className={`text-6xl md:text-8xl font-bold tracking-tight ${statusCopy[currentStatus].tone}`}
          >
            {statusCopy[currentStatus].headline}
          </div>
          <div className="mt-3 text-zinc-400 text-lg">{statusCopy[currentStatus].sub}</div>
        </div>

        <div
          className={`font-mono text-5xl md:text-7xl mb-10 tabular-nums ${
            active?.status === "recording" ? "text-red-400" : "text-zinc-600"
          }`}
        >
          {formatTimer(elapsedMs)}
        </div>

        {active?.status === "recording" ? (
          <button
            onClick={() => setShowStopConfirm(true)}
            className="w-56 h-56 rounded-full bg-zinc-800 border-4 border-red-500 hover:bg-zinc-700 transition flex flex-col items-center justify-center"
            data-testid="button-stop"
          >
            <div className="w-20 h-20 bg-red-500 rounded-md" />
            <div className="mt-3 text-xl font-semibold tracking-wide">STOP</div>
          </button>
        ) : (
          <button
            onClick={handlePressRecord}
            disabled={!recordEnabled || createSession.isPending || updateSession.isPending}
            className={`w-56 h-56 rounded-full flex flex-col items-center justify-center transition border-4 ${
              recordEnabled
                ? "bg-red-600 hover:bg-red-500 border-red-400 shadow-[0_0_60px_rgba(239,68,68,0.35)]"
                : "bg-zinc-800 border-zinc-700 cursor-not-allowed"
            }`}
            data-testid="button-record"
          >
            <div className={`w-24 h-24 rounded-full ${recordEnabled ? "bg-white" : "bg-zinc-600"}`} />
            <div className="mt-3 text-xl font-semibold tracking-wide">
              {createSession.isPending ? "Starting…" : "RECORD"}
            </div>
          </button>
        )}

        {!checklistOk && !active && (
          <div className="mt-8 max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <div className="text-amber-400 font-semibold mb-2">Fix this before recording:</div>
            <ul className="space-y-1 text-zinc-300 text-sm">
              {failing.map((f) => (
                <li key={f.label}>
                  <span className="font-medium">{f.label}.</span>{" "}
                  <span className="text-zinc-400">{f.fix}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Confidence dots — bottom strip */}
      <div className="border-t border-zinc-900 px-6 py-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
          {(Object.keys(CONFIDENCE_LABELS) as ConfidenceKey[]).map((k) => {
            const state = confidence[k];
            const dotColor =
              state === "green" ? "bg-emerald-500" : state === "amber" ? "bg-amber-400" : "bg-red-500";
            const Wrapper: React.ElementType = CONFIDENCE_INTERACTIVE ? "button" : "div";
            const wrapperProps = CONFIDENCE_INTERACTIVE
              ? {
                  onClick: () =>
                    setConfidence((c) => ({ ...c, [k]: c[k] === "green" ? "red" : "green" })),
                  "data-testid": `confidence-${k}`,
                }
              : {};
            return (
              <Wrapper
                key={k}
                {...wrapperProps}
                className={`flex items-center gap-3 text-left bg-zinc-900 ${
                  CONFIDENCE_INTERACTIVE ? "hover:bg-zinc-800 cursor-pointer" : ""
                } border border-zinc-800 rounded-lg px-4 py-3`}
              >
                <span className={`h-3 w-3 rounded-full ${dotColor}`} />
                <div className="flex-1">
                  <div className="text-sm font-medium">{CONFIDENCE_LABELS[k]}</div>
                  <div className="text-xs text-zinc-500">
                    {state === "green" ? "OK" : state === "amber" ? "Check" : "Not ready"}
                  </div>
                </div>
              </Wrapper>
            );
          })}
        </div>
      </div>

      {/* Full-screen STOP confirm */}
      {showStopConfirm && (
        <div className="fixed inset-0 bg-zinc-950/95 backdrop-blur z-50 flex flex-col items-center justify-center px-6">
          <div className="text-5xl md:text-7xl font-bold mb-4">Stop recording?</div>
          <div className="text-zinc-400 text-lg mb-12 text-center max-w-xl">
            If you stop, the session will close and files will start uploading.
          </div>
          <div className="flex flex-col gap-4 w-full max-w-md">
            <Button
              onClick={() => setShowStopConfirm(false)}
              className="h-16 text-lg bg-emerald-600 hover:bg-emerald-500 text-white"
              data-testid="button-keep-recording"
            >
              Keep recording
            </Button>
            <Button
              variant="outline"
              onClick={handleConfirmStop}
              className="h-14 text-base bg-transparent border-zinc-700 text-zinc-300 hover:bg-zinc-900 hover:text-white"
              data-testid="button-stop-and-upload"
            >
              Stop &amp; start upload
            </Button>
          </div>
        </div>
      )}

      {/* Full-screen upload */}
      {(active?.status === "uploading" || active?.status === "stopping") && (
        <div className="fixed inset-0 bg-zinc-950/95 backdrop-blur z-40 flex flex-col items-center justify-center px-6">
          <Loader2 className="h-12 w-12 text-amber-300 animate-spin mb-6" />
          <div className="text-4xl md:text-6xl font-bold mb-3">Uploading session</div>
          <div className="text-zinc-400 text-lg mb-10">Finalising files and pushing to storage…</div>
          <div className="w-full max-w-md h-3 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-400 transition-all duration-200"
              style={{ width: `${uploadPct}%` }}
            />
          </div>
          <div className="mt-3 text-sm text-zinc-500 tabular-nums">{Math.floor(uploadPct)}%</div>
        </div>
      )}

      {/* Complete overlay */}
      {active?.status === "complete" && (
        <div className="fixed inset-0 bg-zinc-950/95 backdrop-blur z-30 flex flex-col items-center justify-center px-6">
          <div className="text-6xl md:text-8xl font-bold text-emerald-400 mb-4">Complete</div>
          <div className="text-zinc-400 text-lg mb-10 text-center max-w-xl">
            Files uploaded. Project is advancing toward ready for editor.
          </div>
          <div className="flex gap-3">
            <Button
              onClick={() => {
                setActiveId(null);
                setUploadPct(0);
              }}
              className="h-12 px-6"
            >
              New session
            </Button>
            <Button
              variant="outline"
              onClick={() => setLocation(`/projects/${projectId}`)}
              className="h-12 px-6"
            >
              Back to project
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
