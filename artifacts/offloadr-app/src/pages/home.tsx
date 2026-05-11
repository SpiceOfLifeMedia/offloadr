import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { PublicLayout } from "@/components/layout/public-layout";
import {
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  FolderOpen,
  FileAudio,
  FileVideo,
  File as FileIcon,
  Square,
  CloudUpload,
  Folders,
  Inbox,
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
          : "bg-muted-foreground/40";
  return <span className={`inline-block h-1.5 w-1.5 rounded-full ${cls}`} />;
}

type StageTone = "rec" | "uploading" | "ready";

function StagePill({ tone, children }: { tone: StageTone; children: React.ReactNode }) {
  const map: Record<StageTone, string> = {
    rec: "bg-red-500/10 text-red-600 ring-red-500/20",
    uploading: "bg-amber-500/10 text-amber-700 ring-amber-500/20",
    ready: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20",
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
    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Hero composition — animated 3-stage status                                 */
/* -------------------------------------------------------------------------- */

const STAGES = ["rec", "uploading", "ready"] as const;
type Stage = (typeof STAGES)[number];

function HeroComposition({ stage }: { stage: Stage }) {
  const elapsed = stage === "rec" ? "00:42:18" : "00:54:02";
  const pct = stage === "uploading" ? 78 : stage === "ready" ? 100 : 0;

  return (
    <div className="rounded-xl border border-border/70 bg-card shadow-[0_20px_60px_-25px_rgba(0,0,0,0.25)] overflow-hidden">
      {/* Window chrome */}
      <div className="flex items-center gap-2 border-b border-border/60 bg-muted/30 px-4 py-2.5">
        <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
        <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
        <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
        <div className="ml-3 truncate text-[11px] text-muted-foreground font-mono">
          offloadr / founders-brief / studio-a
        </div>
        <div className="ml-auto">
          {stage === "rec" && <StagePill tone="rec">Recording</StagePill>}
          {stage === "uploading" && <StagePill tone="uploading">Uploading</StagePill>}
          {stage === "ready" && <StagePill tone="ready">Ready for editor</StagePill>}
        </div>
      </div>

      {/* Body */}
      <div className="grid md:grid-cols-[200px_1fr]">
        {/* Sidebar — hardware list */}
        <aside className="hidden md:block border-r border-border/60 bg-muted/10 px-4 py-5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-3">
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
              <div key={d.name} className="flex items-center justify-between text-muted-foreground">
                <span>{d.name}</span>
                <Dot tone={d.on ? "ok" : "off"} />
              </div>
            ))}
          </div>
        </aside>

        {/* Main panel — switches per stage */}
        <div className="p-5 md:p-7 min-h-[300px]">
          {stage === "rec" && (
            <div className="space-y-4">
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    Take 04 · in progress
                  </div>
                  <div className="text-base font-semibold mt-1">
                    Episode 14 — How to read a term sheet
                  </div>
                </div>
                <div className="font-mono tabular-nums text-2xl text-red-600">{elapsed}</div>
              </div>
              <div className="text-xs text-muted-foreground">
                Talent: Jane Doe, David Chen, Marco Reyes · Mics 1, 2, 3
              </div>
              <div className="rounded-lg border border-border/60 bg-background p-4">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
                  Live signal
                </div>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  {[
                    { m: "Mic 1", w: 68 },
                    { m: "Mic 2", w: 54 },
                    { m: "Mic 3", w: 72 },
                  ].map(({ m, w }) => (
                    <div key={m} className="space-y-1.5">
                      <div className="text-muted-foreground">{m}</div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${w}%` }}
                        />
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
                <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Stopped 12 seconds ago · 9 files
                </div>
                <div className="text-base font-semibold mt-1">Pulling files into the project…</div>
              </div>
              <div className="space-y-2.5">
                {[
                  { n: "lav-jane-doe.wav", p: 100, role: "lav" },
                  { n: "lav-david-chen.wav", p: 100, role: "lav" },
                  { n: "lav-marco-reyes.wav", p: 96, role: "lav" },
                  { n: "cam-a-wide.mp4", p: 64, role: "cam-a" },
                  { n: "cam-b-host.mp4", p: 41, role: "cam-b" },
                ].map((f) => (
                  <div
                    key={f.n}
                    className="flex items-center gap-3 rounded-md border border-border/50 bg-background px-3 py-2 text-xs"
                  >
                    {f.n.endsWith(".mp4") ? (
                      <FileVideo className="h-3.5 w-3.5 text-purple-500 flex-shrink-0" />
                    ) : (
                      <FileAudio className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                    )}
                    <span className="font-mono truncate flex-1">{f.n}</span>
                    <span className="text-muted-foreground tabular-nums">{f.p}%</span>
                    <div className="h-1 w-16 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-amber-500 transition-all duration-700"
                        style={{ width: `${f.p}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Total {pct}% · resumes if the connection drops
              </div>
            </div>
          )}

          {stage === "ready" && (
            <div className="space-y-4">
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    Project complete
                  </div>
                  <div className="text-base font-semibold mt-1">
                    Founder's Brief · Episode 14
                  </div>
                </div>
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 dark:bg-emerald-950/20 dark:border-emerald-900 p-3 flex items-center gap-3 text-sm">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <div>
                  <span className="font-semibold">9 files · 48 GB · </span>
                  <span className="text-emerald-700 dark:text-emerald-400">
                    all verified · ready to edit
                  </span>
                </div>
              </div>
              <button className="w-full h-10 rounded-md bg-foreground text-background text-sm font-semibold inline-flex items-center justify-center gap-2">
                Send to editor <ArrowRight className="h-4 w-4" />
              </button>
              <div className="text-[11px] text-muted-foreground text-center">
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
    const t = setInterval(() => setStageIndex((i) => (i + 1) % STAGES.length), 2400);
    return () => clearInterval(t);
  }, []);
  const stage = STAGES[stageIndex];

  return (
    <div className="relative">
      <HeroComposition stage={stage} />
      {/* Stage indicator dots */}
      <div className="mt-4 flex items-center justify-center gap-2">
        {STAGES.map((s, i) => (
          <button
            key={s}
            onClick={() => setStageIndex(i)}
            aria-label={`Show stage ${s}`}
            className={`h-1.5 rounded-full transition-all ${
              i === stageIndex ? "w-8 bg-foreground" : "w-1.5 bg-muted-foreground/30"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Section 4 — Stop safely visual                                             */
/* -------------------------------------------------------------------------- */

function StopSafelyVisual() {
  const files = [
    { n: "lav-jane-doe.wav", size: "1.1 GB", state: "done" },
    { n: "lav-david-chen.wav", size: "1.1 GB", state: "done" },
    { n: "lav-marco-reyes.wav", size: "1.1 GB", state: "done" },
    { n: "host-mic-mix.wav", size: "938 MB", state: "active" },
    { n: "cam-a-wide.mp4", size: "17.2 GB", state: "queued" },
    { n: "cam-b-host.mp4", size: "13.9 GB", state: "queued" },
  ];

  return (
    <div className="rounded-xl border border-border/70 bg-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-4 py-2.5 text-xs">
        <span className="font-semibold">Founder's Brief — uploads</span>
        <StagePill tone="uploading">Uploading</StagePill>
      </div>
      <div className="divide-y divide-border/60">
        {files.map((f) => (
          <div key={f.n} className="flex items-center gap-3 px-4 py-2.5 text-xs">
            {f.n.endsWith(".mp4") ? (
              <FileVideo className="h-3.5 w-3.5 text-purple-500" />
            ) : (
              <FileAudio className="h-3.5 w-3.5 text-blue-500" />
            )}
            <span className="font-mono flex-1 truncate">{f.n}</span>
            <span className="tabular-nums text-muted-foreground w-16 text-right">{f.size}</span>
            <div className="w-24 flex items-center gap-2">
              {f.state === "done" && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
              {f.state === "done" && <span className="text-emerald-700">Verified</span>}
              {f.state === "active" && (
                <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                  <div className="h-full w-[62%] rounded-full bg-amber-500" />
                </div>
              )}
              {f.state === "queued" && <span className="text-muted-foreground">Queued</span>}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-border/60 bg-muted/20 px-4 py-2.5 text-[11px] text-muted-foreground flex items-center justify-between">
        <span>Project: Founder's Brief / Episode 14</span>
        <span className="font-mono tabular-nums">3 of 6 verified</span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Section 5 — Producer Mode + missing-file callout                           */
/* -------------------------------------------------------------------------- */

function ProducerModeMock() {
  return (
    <div className="rounded-xl bg-zinc-950 text-zinc-100 overflow-hidden border border-zinc-900 shadow-[0_20px_60px_-25px_rgba(0,0,0,0.5)]">
      <div className="flex items-center justify-between border-b border-zinc-900 px-4 py-2.5 text-[11px]">
        <span className="text-zinc-500">Producer Mode</span>
        <span className="text-zinc-500">Founder's Brief · Studio A</span>
      </div>

      {/* take/talent strip */}
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

      {/* big status + record button */}
      <div className="px-6 py-10 flex flex-col items-center text-center">
        <div className="text-4xl font-bold tracking-tight text-emerald-400">Ready</div>
        <div className="mt-1.5 text-xs text-zinc-500">All checks passed. Press RECORD to start.</div>
        <div className="mt-5 font-mono text-3xl tabular-nums text-zinc-700">00:00:00</div>
        <button
          aria-label="Record"
          className="mt-6 h-28 w-28 rounded-full bg-red-600 border-4 border-red-400 shadow-[0_0_40px_rgba(239,68,68,0.35)] flex flex-col items-center justify-center"
        >
          <span className="h-12 w-12 rounded-full bg-white" />
          <span className="mt-1.5 text-xs font-semibold tracking-wide">RECORD</span>
        </button>
      </div>

      {/* confidence dots */}
      <div className="border-t border-zinc-900 px-4 py-3 grid grid-cols-4 gap-2 text-[11px]">
        {["Audio", "Camera feeds", "Recording drive", "Helper app"].map((l) => (
          <div
            key={l}
            className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-2"
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
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-900 p-5">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 space-y-3">
          <div>
            <div className="text-sm font-semibold">Missing-file checklist</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Compared against the expected setup for this project.
            </div>
          </div>
          <div className="space-y-1.5 text-xs font-mono">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Expected lavs</span>
              <span>3 found · 3 expected</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Expected cameras</span>
              <span className="text-amber-700">2 found · 3 expected</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Expected project file</span>
              <span>1 found</span>
            </div>
          </div>
          <div className="rounded-md bg-background border border-border/60 px-3 py-2 text-xs flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
            <span className="font-mono">cam-c-guest.mp4</span>
            <span className="text-muted-foreground">— not received from Camera C</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function Home() {
  return (
    <PublicLayout>
      <div className="flex flex-col">
        {/* ============================================================ */}
        {/* 1. HERO                                                       */}
        {/* ============================================================ */}
        <section className="border-b border-border/60">
          <div className="container py-16 md:py-24">
            <div className="grid lg:grid-cols-[1fr_1.1fr] gap-12 lg:gap-16 items-center">
              <div className="space-y-7">
                <h1 className="text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight leading-[1.02]">
                  Stop the recording.
                  <br />
                  <span className="text-muted-foreground">Walk away.</span>
                </h1>
                <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-xl">
                  Offloadr handles the upload, the organisation, and the handoff — so by
                  the time the editor opens the project, everything is already there.
                </p>
                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <Link href="/register">
                    <Button size="lg" className="h-12 px-7 text-base font-semibold">
                      Start a project <ArrowRight className="ml-1.5 h-4 w-4" />
                    </Button>
                  </Link>
                  <a
                    href="#editor"
                    className="text-sm font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
                  >
                    See what the editor sees <ArrowRight className="h-3.5 w-3.5" />
                  </a>
                </div>
                <div className="text-xs text-muted-foreground pt-1">
                  Offloadr does not record. Offloadr takes over when the recording ends.
                </div>
              </div>

              <div>
                <HeroAnimation />
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* 2. THE CHAOS                                                  */}
        {/* ============================================================ */}
        <section id="chaos" className="border-b border-border/60 bg-muted/20">
          <div className="container py-20 md:py-24">
            <div className="max-w-3xl space-y-3 mb-12">
              <SectionEyebrow>Before Offloadr</SectionEyebrow>
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
                The session ends. The chaos starts.
              </h2>
            </div>
            <div className="grid md:grid-cols-3 gap-8 md:gap-10 max-w-5xl">
              {[
                "You finish the session and now there's 240 GB on three SD cards, two laptops, and someone's phone.",
                "The editor messages you Tuesday: \u201cWhere's the lav from take 4?\u201d You don't know.",
                "Half the project lives in DMs, half in a Drive folder, half is still on a card in the kit bag.",
              ].map((line, i) => (
                <div key={i} className="text-base leading-relaxed text-foreground/90">
                  {line}
                </div>
              ))}
            </div>
            <div className="mt-12 pt-8 border-t border-border/60 max-w-3xl">
              <p className="text-lg md:text-xl font-medium">
                Offloadr is the layer between the session ending and the project being editable.
              </p>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* 3. THE OFFLOADR ARC — the aha moment                          */}
        {/* ============================================================ */}
        <section id="arc" className="border-b border-border/60">
          <div className="container py-20 md:py-24">
            <div className="max-w-3xl space-y-3 mb-14">
              <SectionEyebrow>The arc</SectionEyebrow>
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
                Four steps. One link at the end.
              </h2>
            </div>

            <div className="relative">
              {/* connecting line */}
              <div className="hidden md:block absolute left-0 right-0 top-7 h-px bg-border/80" />
              <div className="grid md:grid-cols-4 gap-8 md:gap-6 relative">
                {[
                  {
                    icon: Square,
                    tone: "rec" as const,
                    label: "You stop recording",
                    body: "On the same gear you already use. Offloadr is not in the recording path.",
                  },
                  {
                    icon: CloudUpload,
                    tone: "uploading" as const,
                    label: "Files upload",
                    body: "Drop the files in once. They land in the right folder, every time.",
                  },
                  {
                    icon: Folders,
                    tone: "uploading" as const,
                    label: "Organise + verify",
                    body: "Producer Mode tags takes. Missing-file checklist runs before you share.",
                  },
                  {
                    icon: Inbox,
                    tone: "ready" as const,
                    label: "Editor opens project",
                    body: "One link. Whole project, organised, with producer notes attached.",
                  },
                ].map((n) => (
                  <div key={n.label} className="space-y-3">
                    <div
                      className={`relative h-14 w-14 rounded-full bg-card border-2 flex items-center justify-center ${
                        n.tone === "rec"
                          ? "border-red-500/40 text-red-600"
                          : n.tone === "uploading"
                            ? "border-amber-500/40 text-amber-700"
                            : "border-emerald-500/40 text-emerald-700"
                      }`}
                    >
                      <n.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{n.label}</div>
                      <div className="text-sm text-muted-foreground mt-1 leading-relaxed">
                        {n.body}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* 4. STOP SAFELY                                                */}
        {/* ============================================================ */}
        <section id="stop" className="border-b border-border/60 bg-muted/20">
          <div className="container py-20 md:py-24">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              <div className="space-y-5 max-w-lg">
                <SectionEyebrow>Land in the right folder</SectionEyebrow>
                <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
                  Files land in their folders. Not your inbox.
                </h2>
                <p className="text-base text-muted-foreground leading-relaxed">
                  Every file goes into the right place — audio in 01_AUDIO, video in
                  02_VIDEO, project files where the editor expects them. Each upload is
                  verified end to end before it counts as done, so you know what landed
                  and what didn't.
                </p>
              </div>
              <StopSafelyVisual />
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* 5. STAY ORGANISED — Producer Mode + missing files             */}
        {/* ============================================================ */}
        <section id="organise" className="border-b border-border/60">
          <div className="container py-20 md:py-24">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
              <div className="lg:order-2">
                <ProducerModeMock />
              </div>
              <div className="space-y-6 max-w-lg lg:order-1">
                <div className="space-y-5">
                  <SectionEyebrow>Stay organised</SectionEyebrow>
                  <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
                    Tag the take while it's still fresh.
                  </h2>
                  <p className="text-base text-muted-foreground leading-relaxed">
                    While the engineer breaks down the kit, the producer marks takes,
                    leaves notes, and sees instantly if anything expected from the
                    session isn't there yet. No more "I'll label them later" — later is now.
                  </p>
                </div>
                <MissingFileCallout />
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* 6. EDITOR OPENS A CLEAN PROJECT — REAL SCREENSHOT             */}
        {/* ============================================================ */}
        <section id="editor" className="border-b border-border/60 bg-muted/20">
          <div className="container py-20 md:py-24">
            <div className="max-w-3xl space-y-4 mb-12">
              <SectionEyebrow>Editor handoff</SectionEyebrow>
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
                What the editor actually receives.
              </h2>
              <p className="text-base text-muted-foreground leading-relaxed max-w-2xl">
                One link. The editor sees every file in the right folder, every take labeled,
                every missing item flagged before they ask. They can start cutting in the
                time it usually takes to figure out what's where.
              </p>
            </div>
            <div className="rounded-xl border border-border/70 bg-card overflow-hidden shadow-[0_30px_80px_-30px_rgba(0,0,0,0.25)]">
              <img
                src={`${import.meta.env.BASE_URL}marketing/editor-handoff.jpg`}
                alt="Offloadr editor handoff page showing organised project files, missing-file flag, and download-all button"
                className="w-full h-auto block"
                loading="lazy"
              />
            </div>
            <div className="mt-4 text-xs text-muted-foreground text-center">
              Real Offloadr editor handoff page — Founder's Brief, Episode 14.
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* 7. WHAT'S IN EVERY PROJECT                                    */}
        {/* ============================================================ */}
        <section id="everything" className="border-b border-border/60">
          <div className="container py-20 md:py-24">
            <div className="max-w-3xl space-y-3 mb-12">
              <SectionEyebrow>What's in every project</SectionEyebrow>
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
                The table-stakes are already there.
              </h2>
            </div>
            <div className="grid md:grid-cols-2 gap-x-12 gap-y-3 max-w-4xl text-base">
              {[
                "Producer notes attached to takes",
                "Missing-file checklist before you share",
                "Folder structure your editor will recognise",
                "Cleaned filenames so the editor knows what's what",
                "One share link per project, revocable",
                "Whole-project ZIP download for the editor",
                "Per-project access — no shared Drive folders",
                "No login required for the editor on the share page",
              ].map((line) => (
                <div key={line} className="flex items-start gap-3 py-2 border-b border-border/40">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-1 flex-shrink-0" />
                  <span>{line}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* 8. CTA                                                        */}
        {/* ============================================================ */}
        <section id="cta">
          <div className="container py-24 md:py-32">
            <div className="max-w-3xl mx-auto text-center space-y-8">
              <h2 className="text-3xl md:text-5xl font-semibold tracking-tight leading-tight">
                Your next session ends in chaos by default.
                <br />
                <span className="text-muted-foreground">Change the default.</span>
              </h2>
              <div>
                <Link href="/register">
                  <Button size="lg" className="h-12 px-8 text-base font-semibold">
                    Start a project <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                </Link>
              </div>
              <div className="text-xs text-muted-foreground">
                No credit card to set up. One project free while you try it.
              </div>
            </div>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
