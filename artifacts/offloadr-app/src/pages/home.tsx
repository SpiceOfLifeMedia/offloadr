import { useEffect, useState } from "react";
import { PublicLayout } from "@/components/layout/public-layout";
import {
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  FileAudio,
  FileVideo,
  Square,
  CloudUpload,
  ShieldCheck,
  Send,
  Scissors,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  Atoms                                                                      */
/* -------------------------------------------------------------------------- */

function Dot({ tone = "ok" }: { tone?: "ok" | "warn" | "off" | "rec" }) {
  const cls =
    tone === "ok"
      ? "bg-emerald-500"
      : tone === "rec"
        ? "bg-red-500"
        : tone === "warn"
          ? "bg-amber-500"
          : "bg-zinc-600";
  return <span className={`inline-block h-1.5 w-1.5 rounded-full ${cls}`} />;
}

type StageTone = "rec" | "uploading" | "ready";

function StagePill({ tone, children }: { tone: StageTone; children: React.ReactNode }) {
  const map: Record<StageTone, string> = {
    rec: "bg-red-500/15 text-red-400 ring-red-500/30",
    uploading: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
    ready: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ring-1 ${map[tone]}`}
    >
      <Dot tone={tone === "rec" ? "rec" : tone === "ready" ? "ok" : "warn"} />
      {children}
    </span>
  );
}

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Hero — animated 3-stage operational dashboard                              */
/* -------------------------------------------------------------------------- */

const STAGES = ["rec", "uploading", "ready"] as const;
type Stage = (typeof STAGES)[number];

function HeroComposition({ stage }: { stage: Stage }) {
  const elapsed = stage === "rec" ? "00:42:18" : "00:54:02";
  const pct = stage === "uploading" ? 78 : stage === "ready" ? 100 : 0;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)]">
      <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900/60 px-4 py-2.5">
        <div className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
        <div className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
        <div className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
        <div className="ml-3 truncate text-[11px] text-zinc-500 font-mono">
          offloadr / founders-brief / studio-a
        </div>
        <div className="ml-auto">
          {stage === "rec" && <StagePill tone="rec">Recording</StagePill>}
          {stage === "uploading" && <StagePill tone="uploading">Uploading</StagePill>}
          {stage === "ready" && <StagePill tone="ready">Ready for editor</StagePill>}
        </div>
      </div>

      <div className="grid md:grid-cols-[200px_1fr]">
        <aside className="hidden md:block border-r border-zinc-800 bg-zinc-900/30 px-4 py-5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 mb-3">
            Hardware
          </div>
          <div className="space-y-2 text-xs">
            {[
              { name: "RODECaster Pro II", on: true },
              { name: "Camera A", on: true },
              { name: "Camera B", on: true },
              { name: "Camera C", on: stage !== "ready" },
              { name: "Recording drive", on: true },
              { name: "Helper app", on: true },
            ].map((d) => (
              <div key={d.name} className="flex items-center justify-between text-zinc-400">
                <span>{d.name}</span>
                <Dot tone={d.on ? "ok" : "off"} />
              </div>
            ))}
          </div>
        </aside>

        <div className="p-5 md:p-7 min-h-[300px]">
          {stage === "rec" && (
            <div className="space-y-4">
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                    Take 04 · in progress
                  </div>
                  <div className="text-base font-semibold mt-1 text-zinc-100">
                    Episode 14 — How to read a term sheet
                  </div>
                </div>
                <div className="font-mono tabular-nums text-2xl text-red-400">{elapsed}</div>
              </div>
              <div className="text-xs text-zinc-500">
                Talent: Jane Doe, David Chen, Marco Reyes · Mics 1, 2, 3
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
                <div className="text-[11px] uppercase tracking-wider text-zinc-500 mb-2">
                  Live signal
                </div>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  {[
                    { m: "Mic 1", w: 68 },
                    { m: "Mic 2", w: 54 },
                    { m: "Mic 3", w: 72 },
                  ].map(({ m, w }) => (
                    <div key={m} className="space-y-1.5">
                      <div className="text-zinc-400">{m}</div>
                      <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${w}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {stage === "uploading" && (
            <div className="space-y-4">
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                  Stopped 12 seconds ago · 9 files · verifying
                </div>
                <div className="text-base font-semibold mt-1 text-zinc-100">
                  Pulling files into the project…
                </div>
              </div>
              <div className="space-y-2">
                {[
                  { n: "lav-jane-doe.wav", p: 100 },
                  { n: "lav-david-chen.wav", p: 100 },
                  { n: "lav-marco-reyes.wav", p: 96 },
                  { n: "cam-a-wide.mp4", p: 64 },
                  { n: "cam-b-host.mp4", p: 41 },
                ].map((f) => (
                  <div
                    key={f.n}
                    className="flex items-center gap-3 rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-xs"
                  >
                    {f.n.endsWith(".mp4") ? (
                      <FileVideo className="h-3.5 w-3.5 text-purple-400 flex-shrink-0" />
                    ) : (
                      <FileAudio className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
                    )}
                    <span className="font-mono truncate flex-1 text-zinc-300">{f.n}</span>
                    <span className="text-zinc-500 tabular-nums">{f.p}%</span>
                    <div className="h-1 w-16 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-amber-500 transition-all duration-700"
                        style={{ width: `${f.p}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-[11px] text-zinc-500">
                Total {pct}% · resumes if the connection drops · checksum verified per file
              </div>
            </div>
          )}

          {stage === "ready" && (
            <div className="space-y-4">
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                    Project complete
                  </div>
                  <div className="text-base font-semibold mt-1 text-zinc-100">
                    Founder's Brief · Episode 14
                  </div>
                </div>
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              </div>
              <div className="rounded-lg border border-emerald-900/60 bg-emerald-950/40 p-3 flex items-center gap-3 text-sm">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                <div className="text-zinc-200">
                  <span className="font-semibold">9 files · 48 GB · </span>
                  <span className="text-emerald-400">all verified · ready to edit</span>
                </div>
              </div>
              <button className="w-full h-10 rounded-md bg-white text-zinc-950 text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-zinc-200 transition-colors">
                Send to editor <ArrowRight className="h-4 w-4" />
              </button>
              <div className="text-[11px] text-zinc-500 text-center">
                One link. Folder structure, notes, and missing-file checklist included.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HeroAnimation() {
  const [stageIndex, setStageIndex] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStageIndex((i) => (i + 1) % STAGES.length), 2600);
    return () => clearInterval(t);
  }, []);
  const stage = STAGES[stageIndex];

  return (
    <div className="relative">
      <HeroComposition stage={stage} />
      <div className="mt-4 flex items-center justify-center gap-2">
        {STAGES.map((s, i) => (
          <button
            key={s}
            onClick={() => setStageIndex(i)}
            aria-label={`Show stage ${s}`}
            className={`h-1.5 rounded-full transition-all ${
              i === stageIndex ? "w-8 bg-zinc-300" : "w-1.5 bg-zinc-700"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Workflow — 5 horizontal steps                                              */
/* -------------------------------------------------------------------------- */

const WORKFLOW_STEPS = [
  {
    icon: Square,
    label: "Record",
    body: "On the same gear you already use. Offloadr is not in the recording path.",
  },
  {
    icon: CloudUpload,
    label: "Upload",
    body: "Drop files in once. They land in the right folder, every time. Resumable.",
  },
  {
    icon: ShieldCheck,
    label: "Verify",
    body: "Checksum per file. Missing-file checklist runs against the expected setup.",
  },
  {
    icon: Send,
    label: "Handoff",
    body: "One revocable share link. Producer notes attached. No login for the editor.",
  },
  {
    icon: Scissors,
    label: "Edit",
    body: "The editor opens a clean project. They start cutting, not chasing.",
  },
];

function WorkflowSection() {
  return (
    <section id="workflow" className="border-b border-zinc-900">
      <div className="container py-20 md:py-28">
        <div className="max-w-3xl space-y-3 mb-14">
          <SectionEyebrow>The workflow</SectionEyebrow>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-zinc-100">
            Five steps. Nothing the editor has to chase.
          </h2>
        </div>

        <div className="relative">
          <div className="hidden md:block absolute left-0 right-0 top-7 h-px bg-zinc-800" />
          <div className="grid md:grid-cols-5 gap-8 md:gap-5 relative">
            {WORKFLOW_STEPS.map((s, i) => (
              <div key={s.label} className="space-y-3">
                <div className="relative h-14 w-14 rounded-full bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-300">
                  <s.icon className="h-5 w-5" />
                  <span className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-zinc-900 border border-zinc-700 text-[10px] font-mono text-zinc-400 flex items-center justify-center">
                    {i + 1}
                  </span>
                </div>
                <div>
                  <div className="text-sm font-semibold text-zinc-100">{s.label}</div>
                  <div className="text-sm text-zinc-500 mt-1 leading-relaxed">{s.body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Producer Mode — centerpiece                                                */
/* -------------------------------------------------------------------------- */

function ProducerModeMock() {
  return (
    <div className="rounded-xl bg-zinc-950 text-zinc-100 overflow-hidden border border-zinc-800 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)]">
      <div className="flex items-center justify-between border-b border-zinc-900 px-4 py-2.5 text-[11px]">
        <span className="text-zinc-500">Producer Mode</span>
        <span className="text-zinc-500">Founder's Brief · Studio A</span>
      </div>

      <div className="border-b border-zinc-900 bg-zinc-900/40 px-4 py-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
        <span>
          <span className="text-zinc-500 uppercase tracking-wider mr-1.5">Next take</span>
          <span className="font-mono font-semibold">#04</span>
        </span>
        <span>
          <span className="text-zinc-500 uppercase tracking-wider mr-1.5">Talent</span>
          Jane Doe, David Chen, Marco Reyes
        </span>
        <span>
          <span className="text-zinc-500 uppercase tracking-wider mr-1.5">Mics</span>
          <span className="font-mono">1 · 2 · 3</span>
        </span>
      </div>

      <div className="px-6 py-10 flex flex-col items-center text-center">
        <div className="text-4xl font-bold tracking-tight text-emerald-400">Ready</div>
        <div className="mt-1.5 text-xs text-zinc-500">All checks passed. Press RECORD to start.</div>
        <div className="mt-5 font-mono text-3xl tabular-nums text-zinc-700">00:00:00</div>
        <button
          aria-label="Record"
          className="mt-6 h-28 w-28 rounded-full bg-red-600 border-4 border-red-400/60 shadow-[0_0_40px_rgba(239,68,68,0.35)] flex flex-col items-center justify-center"
        >
          <span className="h-12 w-12 rounded-full bg-white" />
          <span className="mt-1.5 text-xs font-semibold tracking-wide text-white">RECORD</span>
        </button>
      </div>

      <div className="border-t border-zinc-900 px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
        {["Audio", "Camera feeds", "Recording drive", "Helper app"].map((l) => (
          <div
            key={l}
            className="flex items-center gap-2 bg-zinc-900/60 border border-zinc-800 rounded px-2.5 py-2"
          >
            <Dot tone="ok" />
            <span className="text-zinc-300">{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MissingFileCallout() {
  return (
    <div className="rounded-xl border border-amber-900/60 bg-amber-950/20 p-5">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 space-y-3">
          <div>
            <div className="text-sm font-semibold text-zinc-100">Missing-file checklist</div>
            <div className="text-xs text-zinc-500 mt-0.5">
              Compared against the expected setup for this project.
            </div>
          </div>
          <div className="space-y-1.5 text-xs font-mono">
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Expected lavs</span>
              <span className="text-zinc-300">3 found · 3 expected</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Expected cameras</span>
              <span className="text-amber-400">2 found · 3 expected</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Expected project file</span>
              <span className="text-zinc-300">1 found</span>
            </div>
          </div>
          <div className="rounded-md bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
            <span className="font-mono text-zinc-200">cam-c-guest.mp4</span>
            <span className="text-zinc-500">— not received from Camera C</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Beta waitlist form                                                         */
/* -------------------------------------------------------------------------- */

type FormState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success" }
  | { kind: "error"; message: string };

function BetaForm() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [state, setState] = useState<FormState>({ kind: "idle" });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (state.kind === "submitting") return;
    setState({ kind: "submitting" });
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role: role.trim() || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Request failed (${res.status})`);
      }
      setState({ kind: "success" });
    } catch (err) {
      setState({ kind: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    }
  }

  if (state.kind === "success") {
    return (
      <div className="rounded-xl border border-emerald-900/60 bg-emerald-950/30 p-8 text-center">
        <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-3" />
        <div className="text-lg font-semibold text-zinc-100">You're on the list.</div>
        <div className="mt-2 text-sm text-zinc-400 max-w-md mx-auto">
          We'll reach out before opening the beta to make sure Offloadr fits how your team actually works.
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl border border-zinc-800 bg-zinc-950 p-6 md:p-8 space-y-4"
    >
      <div className="grid md:grid-cols-[1fr_220px] gap-3">
        <input
          type="email"
          required
          autoComplete="email"
          placeholder="you@studio.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-12 rounded-md bg-zinc-900 border border-zinc-800 px-4 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/60"
        />
        <input
          type="text"
          placeholder="Studio / school / agency (optional)"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="h-12 rounded-md bg-zinc-900 border border-zinc-800 px-4 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/60"
        />
      </div>
      <button
        type="submit"
        disabled={state.kind === "submitting"}
        className="w-full h-12 rounded-md bg-white text-zinc-950 text-sm font-semibold hover:bg-zinc-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
      >
        {state.kind === "submitting" ? "Joining…" : (
          <>Join the Beta <ArrowRight className="h-4 w-4" /></>
        )}
      </button>
      {state.kind === "error" && (
        <div className="text-xs text-red-400">{state.message}</div>
      )}
      <div className="text-[11px] text-zinc-500 text-center">
        We'll only email you about the beta. No newsletter, no spam.
      </div>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function Home() {
  return (
    <PublicLayout>
      <div className="flex flex-col">
        {/* 1. HERO */}
        <section className="border-b border-zinc-900">
          <div className="container py-16 md:py-24">
            <div className="grid lg:grid-cols-[1fr_1.1fr] gap-12 lg:gap-16 items-center">
              <div className="space-y-7">
                <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/50 px-3 py-1 text-[11px] font-medium text-zinc-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Now piloting with schools and classroom media programs
                </div>
                <h1 className="text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight leading-[1.02] text-zinc-100">
                  Classroom recordings,
                  <br />
                  <span className="text-zinc-500">ready to edit before the bell.</span>
                </h1>
                <p className="text-lg md:text-xl text-zinc-400 leading-relaxed max-w-xl">
                  Offloadr takes over the moment a class stops recording — automatically
                  uploading, verifying, organising and handing every take to the editor
                  or the next student in the workflow.
                </p>
                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <a
                    href="#beta"
                    className="inline-flex h-12 items-center rounded-md bg-white px-7 text-base font-semibold text-zinc-950 hover:bg-zinc-200 transition-colors gap-1.5"
                  >
                    Join the Beta <ArrowRight className="h-4 w-4" />
                  </a>
                  <a
                    href="https://offloadr-pilot.fly.dev/offloadr/login"
                    className="inline-flex h-12 items-center rounded-md border border-zinc-700 px-7 text-base font-semibold text-zinc-100 hover:bg-zinc-900 hover:border-zinc-600 transition-colors gap-1.5"
                  >
                    Log in to the app <ArrowRight className="h-4 w-4" />
                  </a>
                  <a
                    href="#handoff"
                    className="text-sm font-medium text-zinc-400 hover:text-zinc-100 inline-flex items-center gap-1.5 transition-colors"
                  >
                    See what the editor sees <ArrowRight className="h-3.5 w-3.5" />
                  </a>
                </div>
                <div className="text-xs text-zinc-500 pt-1">
                  Offloadr doesn't record. It takes over the moment recording stops, so teachers and producers don't carry drives home.
                </div>
              </div>

              <div>
                <HeroAnimation />
              </div>
            </div>
          </div>
        </section>

        {/* 2. THE PROBLEM */}
        <section id="problem" className="border-b border-zinc-900 bg-zinc-950/60">
          <div className="container py-20 md:py-24">
            <div className="max-w-3xl space-y-3 mb-12">
              <SectionEyebrow>The problem</SectionEyebrow>
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-zinc-100">
                Production workflows are still chaos.
              </h2>
              <p className="text-base text-zinc-400 leading-relaxed max-w-2xl">
                The recording's done. Now your team spends the rest of the week answering
                "where's the file?" instead of cutting the episode.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-5 max-w-6xl">
              {[
                {
                  title: "Missing SD cards",
                  body: "Half the project lives on a card in someone's kit bag. The editor messages you on Tuesday: \u201cthe lav from take 4\u201d — you don't know.",
                },
                {
                  title: "Editors chasing files",
                  body: "DMs, email threads, Drive folders, WeTransfer links. The editor opens nine tabs before they open a timeline.",
                },
                {
                  title: "Broken handoffs",
                  body: "Files renamed mid-pipeline, takes unlabelled, project files lost. Nobody is sure what version of what is the real one.",
                },
                {
                  title: "Drive folder confusion",
                  body: "Three shared folders, two naming conventions, one folder nobody has access to. Permissions lottery every time.",
                },
                {
                  title: "Manual upload checks",
                  body: "Producers spending Sunday night refreshing an upload page to see if camera B finally went through.",
                },
                {
                  title: "Uncertainty after stop",
                  body: "Was it really recorded? Was it really uploaded? Did anything corrupt? Right now: nobody knows until the editor opens it.",
                },
              ].map((p) => (
                <div
                  key={p.title}
                  className="rounded-lg border border-zinc-800 bg-zinc-950 p-5"
                >
                  <div className="flex items-center gap-2 text-amber-400 text-[11px] uppercase tracking-wider font-semibold mb-2">
                    <AlertTriangle className="h-3.5 w-3.5" /> Pain
                  </div>
                  <div className="text-sm font-semibold text-zinc-100 mb-2">{p.title}</div>
                  <div className="text-sm text-zinc-400 leading-relaxed">{p.body}</div>
                </div>
              ))}
            </div>
            <div className="mt-12 pt-8 border-t border-zinc-800 max-w-3xl">
              <p className="text-lg md:text-xl font-medium text-zinc-200">
                Offloadr is the layer between recording ending and editing beginning.
              </p>
            </div>
          </div>
        </section>

        {/* 3. THE WORKFLOW — 5 horizontal steps */}
        <WorkflowSection />

        {/* 4. PRODUCER MODE — centerpiece */}
        <section id="producer" className="border-b border-zinc-900 bg-zinc-950/60">
          <div className="container py-20 md:py-28">
            <div className="max-w-3xl space-y-3 mb-14">
              <SectionEyebrow>Producer Mode</SectionEyebrow>
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-zinc-100">
                Operational confidence before you press record.
              </h2>
              <p className="text-base text-zinc-400 leading-relaxed max-w-2xl">
                Producer Mode runs in the studio. It checks the kit, watches the uploads,
                tags takes while they're fresh, and tells you the moment something
                expected from the session isn't there yet.
              </p>
            </div>

            <div className="grid lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-14 items-start">
              <ProducerModeMock />
              <div className="space-y-6">
                <div className="grid sm:grid-cols-2 gap-4">
                  {[
                    { t: "Kit checks", b: "Audio, cameras, drive, helper app — all verified before record." },
                    { t: "Recording readiness", b: "Single status: Ready, Warning, or Not ready. No guessing." },
                    { t: "Take organisation", b: "Tag take number, talent, mic assignments while it's fresh." },
                    { t: "Session status", b: "See uploads land in real time. Know what's still on a card." },
                    { t: "Project verification", b: "Compare what landed against the expected setup for this project." },
                    { t: "Missing-file alerts", b: "Flagged before the editor ever sees the project. Nothing slips." },
                  ].map((f) => (
                    <div
                      key={f.t}
                      className="rounded-lg border border-zinc-800 bg-zinc-950 p-4"
                    >
                      <div className="text-sm font-semibold text-zinc-100">{f.t}</div>
                      <div className="text-sm text-zinc-500 mt-1.5 leading-relaxed">{f.b}</div>
                    </div>
                  ))}
                </div>
                <MissingFileCallout />
              </div>
            </div>
          </div>
        </section>

        {/* 5. EDITOR HANDOFF — real screenshot */}
        <section id="handoff" className="border-b border-zinc-900">
          <div className="container py-20 md:py-28">
            <div className="max-w-3xl space-y-3 mb-12">
              <SectionEyebrow>Editor handoff</SectionEyebrow>
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-zinc-100">
                The editor opens a clean project.
              </h2>
              <p className="text-base text-zinc-400 leading-relaxed max-w-2xl">
                One link. Verified files in a folder structure they recognise. Takes
                labelled, producer notes attached, missing items flagged before they
                ever open a timeline.
              </p>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)]">
              <img
                src={`${import.meta.env.BASE_URL}marketing/editor-handoff.jpg`}
                alt="Offloadr editor handoff page showing organised project files, missing-file flag, and download-all button"
                className="w-full h-auto block opacity-95"
                loading="lazy"
              />
            </div>
            <div className="mt-4 text-xs text-zinc-500 text-center">
              Real Offloadr editor handoff page — Founder's Brief, Episode 14.
            </div>

            <div className="mt-10 grid md:grid-cols-2 gap-x-12 gap-y-2 max-w-4xl text-sm">
              {[
                "Verified uploads — checksum per file",
                "Folder structure your editor recognises",
                "Cleaned filenames so the editor knows what's what",
                "Producer notes attached to takes",
                "Missing-file checklist on the share page",
                "Whole-project ZIP for the editor",
                "Per-project access — no shared Drive folders",
                "No login required for the editor",
              ].map((line) => (
                <div key={line} className="flex items-start gap-3 py-2 border-b border-zinc-900">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <span className="text-zinc-300">{line}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 6. WHO IT'S FOR */}
        <section id="who" className="border-b border-zinc-900 bg-zinc-950/60">
          <div className="container py-20 md:py-28">
            <div className="max-w-3xl space-y-3 mb-12">
              <SectionEyebrow>Who it's for</SectionEyebrow>
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-zinc-100">
                Built for classrooms and studios where a lost take is a real problem.
              </h2>
              <p className="text-base text-zinc-400 leading-relaxed max-w-2xl">
                Offloadr is built for media programs and production teams with real
                handoffs — teachers passing footage to student editors, producers passing
                projects to post, and anyone downstream who needs the takes ready,
                organised and accounted for the moment recording ends.
              </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6 md:p-8">
                <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500 font-semibold mb-4">
                  Primary
                </div>
                <ul className="space-y-3 text-sm text-zinc-200">
                  {[
                    "Schools with media programs",
                    "Education media departments",
                    "Student media teams",
                    "Podcast studios",
                    "Small production houses",
                  ].map((t) => (
                    <li key={t} className="flex items-center gap-3">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6 md:p-8">
                <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500 font-semibold mb-4">
                  Secondary
                </div>
                <ul className="space-y-3 text-sm text-zinc-200">
                  {[
                    "Creators with regular release schedules",
                    "Agencies producing client content",
                    "Remote production teams",
                    "Video podcast networks",
                  ].map((t) => (
                    <li key={t} className="flex items-center gap-3">
                      <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* 7. CTA — Beta */}
        <section id="beta">
          <div className="container py-24 md:py-32">
            <div className="max-w-2xl mx-auto text-center space-y-8">
              <SectionEyebrow>Closed beta</SectionEyebrow>
              <h2 className="text-3xl md:text-5xl font-semibold tracking-tight leading-[1.05] text-zinc-100">
                Production doesn't end
                <br />
                <span className="text-zinc-500">when recording stops.</span>
              </h2>
              <p className="text-base text-zinc-400 max-w-lg mx-auto">
                Offloadr is opening in waves to studios, schools and production teams.
                Leave your email — we'll reach out before the beta opens.
              </p>
              <div className="pt-4">
                <BetaForm />
              </div>
            </div>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
