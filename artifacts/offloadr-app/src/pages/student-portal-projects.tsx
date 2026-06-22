import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  Loader2,
  Lock,
  FolderOpen,
  ArrowRight,
  CheckCircle2,
  User,
  CalendarClock,
} from "lucide-react";
import StudentPortalShell from "@/components/student-portal/shell";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface ProjectCard {
  projectId: number;
  projectName: string;
  organizationName: string;
  teacherName: string | null;
  dueDate: string | null;
  draftCount: number;
  submittedCount: number;
  locked: boolean;
}

export default function StudentPortalProjects() {
  const [, navigate] = useLocation();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectCard[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/student/me/upload-targets`, {
      credentials: "include",
    })
      .then(async (res) => {
        if (res.status === 401) {
          navigate("/student-login");
          return null;
        }
        if (res.status === 404) {
          setLoadError(
            "Student accounts are not enabled in this environment.",
          );
          return null;
        }
        if (!res.ok) {
          setLoadError(`Couldn't load projects (HTTP ${res.status}).`);
          return null;
        }
        return (await res.json()) as { projects: ProjectCard[] };
      })
      .then((body) => {
        if (cancelled || !body) return;
        setProjects(body.projects);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(
          err instanceof Error
            ? `Network error: ${err.message}`
            : "Network error.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <StudentPortalShell>
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="space-y-2">
          <div className="brand-eyebrow text-[11px] uppercase tracking-[0.18em] text-[rgb(var(--brand-violet-light))]/90">
            My workspace
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-[2rem]">
            My Media{" "}
            <span className="brand-gradient-text">Projects</span>
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-zinc-400">
            Pick a project to upload to. Files stay private until you press{" "}
            <span className="font-medium text-zinc-200">Offload to Teacher</span>.
          </p>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-16 text-sm text-zinc-400">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading your
            projects…
          </div>
        )}

        {loadError && (
          <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {loadError}
          </div>
        )}

        {!loading && !loadError && projects.length === 0 && (
          <div className="portal-glass rounded-2xl px-6 py-14 text-center">
            {/* Soft inline SVG — pulsing-glow folder with two small media
                tiles fanning out. Pure CSS pulse, no animation lib. Reads
                as "nothing here yet, but the space is ready". */}
            <div className="relative mx-auto mb-5 h-24 w-24">
              <div className="absolute inset-0 rounded-full bg-[rgb(var(--brand-blue))]/15 blur-2xl animate-pulse" />
              <svg
                viewBox="0 0 96 96"
                className="relative h-full w-full"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="es-folder" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="rgb(var(--brand-blue))" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="rgb(var(--brand-violet))" stopOpacity="0.9" />
                  </linearGradient>
                </defs>
                {/* Two faint media tiles behind */}
                <rect x="14" y="24" width="34" height="44" rx="6"
                  fill="white" fillOpacity="0.05" stroke="white" strokeOpacity="0.08" />
                <rect x="48" y="24" width="34" height="44" rx="6"
                  fill="white" fillOpacity="0.05" stroke="white" strokeOpacity="0.08" />
                {/* Folder in front */}
                <path
                  d="M22 36 H40 L46 42 H74 a4 4 0 0 1 4 4 V70 a4 4 0 0 1 -4 4 H22 a4 4 0 0 1 -4 -4 V40 a4 4 0 0 1 4 -4 Z"
                  fill="url(#es-folder)"
                  fillOpacity="0.18"
                  stroke="url(#es-folder)"
                  strokeOpacity="0.7"
                  strokeWidth="1.2"
                />
              </svg>
            </div>
            <div className="text-base font-semibold text-white">
              You're all caught up
            </div>
            <div className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-zinc-400">
              No projects are open for you right now. Your teacher will let you know when there's something new to upload.
            </div>
          </div>
        )}

        {!loading && projects.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {projects.map((p) => (
              <button
                key={p.projectId}
                type="button"
                onClick={() => navigate(`/student-projects/${p.projectId}`)}
                className="portal-glass group relative overflow-hidden rounded-xl p-5 text-left transition hover:-translate-y-0.5"
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${
                      p.locked
                        ? "border-amber-300/30 bg-amber-400/10 text-amber-200"
                        : "border-[rgb(var(--brand-blue))]/30 bg-[rgb(var(--brand-blue))]/10 text-[rgb(125,191,255)]"
                    }`}
                  >
                    {p.locked ? (
                      <Lock className="h-5 w-5" />
                    ) : (
                      <FolderOpen className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-base font-semibold text-white">
                      {p.projectName}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-zinc-500">
                      {p.organizationName}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-zinc-600 transition group-hover:translate-x-0.5 group-hover:text-[rgb(var(--brand-violet-light))]" />
                </div>

                {(p.teacherName || p.dueDate) && (
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-zinc-400">
                    {p.teacherName && (
                      <span className="inline-flex items-center gap-1">
                        <User className="h-3 w-3 text-zinc-500" />
                        {p.teacherName}
                      </span>
                    )}
                    {p.dueDate && (
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock className="h-3 w-3 text-zinc-500" />
                        Due {p.dueDate}
                      </span>
                    )}
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {p.locked ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/30 bg-amber-400/10 px-2 py-0.5 text-[11px] font-medium text-amber-200">
                      <Lock className="h-3 w-3" />
                      Delivered
                    </span>
                  ) : p.draftCount > 0 ? (
                    <span className="inline-flex items-center rounded-full border border-[rgb(var(--brand-blue))]/30 bg-[rgb(var(--brand-blue))]/10 px-2 py-0.5 text-[11px] font-medium text-[rgb(125,191,255)]">
                      {p.draftCount} draft file
                      {p.draftCount === 1 ? "" : "s"}
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full border border-white/5 bg-white/[0.03] px-2 py-0.5 text-[11px] text-zinc-500">
                      Ready for upload
                    </span>
                  )}
                  {p.submittedCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500">
                      <CheckCircle2 className="h-3 w-3 text-emerald-400/70" />
                      {p.submittedCount} previously offloaded
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Quick Upload Mode footer intentionally removed for logged-in
            students. They already have an account; the fallback is
            confusing and developer-facing for kids. The /student-upload
            entry point still exists for teachers who hand out one-off
            codes — it's just not advertised here. */}
      </div>
    </StudentPortalShell>
  );
}
