import { PublicLayout } from "@/components/layout/public-layout";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  Mic,
  Video,
  HardDrive,
  Cable,
  CloudUpload,
  CheckCircle2,
  Radio,
  GraduationCap,
  ShieldCheck,
  Sparkles,
  ArrowRight,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  Atoms                                                                     */
/* -------------------------------------------------------------------------- */

function Dot({ tone = "ok" }: { tone?: "ok" | "warn" | "off" }) {
  const cls =
    tone === "ok"
      ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"
      : tone === "warn"
        ? "bg-amber-500"
        : "bg-muted-foreground/40";
  return <span className={`inline-block h-2 w-2 rounded-full ${cls}`} />;
}

function StatusPill({
  tone,
  children,
}: {
  tone: "ready" | "recording" | "uploading" | "complete";
  children: React.ReactNode;
}) {
  const map = {
    ready: "bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20",
    recording: "bg-red-500/10 text-red-600 ring-1 ring-red-500/20",
    uploading: "bg-blue-500/10 text-blue-600 ring-1 ring-blue-500/20",
    complete: "bg-foreground/5 text-foreground ring-1 ring-foreground/10",
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${map[tone]}`}
    >
      <Dot tone={tone === "complete" ? "off" : "ok"} />
      {children}
    </span>
  );
}

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Hero — dominant cinematic mockup                                          */
/* -------------------------------------------------------------------------- */

function HeroDashboard() {
  return (
    <div className="relative rounded-2xl border border-border/60 bg-card shadow-[0_30px_80px_-20px_rgba(15,23,42,0.25)] ring-1 ring-foreground/5 overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border/60 bg-muted/40 px-4 py-2.5">
        <div className="h-2.5 w-2.5 rounded-full bg-red-400/60" />
        <div className="h-2.5 w-2.5 rounded-full bg-amber-400/60" />
        <div className="h-2.5 w-2.5 rounded-full bg-emerald-400/60" />
        <div className="ml-3 truncate text-xs text-muted-foreground font-mono">
          offloadr.app / studio-a / live-session
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="relative inline-flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
          </span>
          <span className="text-[11px] font-medium text-red-600">LIVE</span>
        </div>
      </div>

      <div className="grid lg:grid-cols-[240px_1fr]">
        {/* sidebar */}
        <aside className="hidden lg:flex flex-col gap-1 border-r border-border/60 bg-muted/20 p-5 text-sm">
          <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Workspace
          </div>
          <div className="rounded-md bg-foreground/[0.06] px-3 py-2 font-medium flex items-center gap-2">
            <Radio className="h-3.5 w-3.5 text-blue-600" />
            Live Sessions
          </div>
          <div className="rounded-md px-3 py-2 text-muted-foreground flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
            Projects
          </div>
          <div className="rounded-md px-3 py-2 text-muted-foreground flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
            Storage
          </div>
          <div className="rounded-md px-3 py-2 text-muted-foreground flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
            Editors
          </div>

          <div className="mt-6 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Connected hardware
          </div>
          <div className="space-y-1.5 px-2 text-xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>RODECaster Pro II</span>
              <Dot tone="ok" />
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Camera A · B · C</span>
              <Dot tone="ok" />
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Podcart · Studio A</span>
              <Dot tone="ok" />
            </div>
          </div>
        </aside>

        {/* main */}
        <div className="p-5 md:p-7 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground">
                Greenfield High · Studio A
              </div>
              <div className="text-base font-semibold">Live productions</div>
            </div>
            <div className="hidden sm:flex h-9 items-center rounded-md bg-foreground px-3.5 text-xs font-medium text-background">
              + New session
            </div>
          </div>

          {/* live recording row */}
          <div className="rounded-xl border border-border/60 bg-background p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">
                  Year 11 Oracy — Debate Final
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  Studio A · 3 cameras · RODECaster Pro II · 4 mics
                </div>
              </div>
              <StatusPill tone="recording">Recording</StatusPill>
            </div>
            <div className="mt-3 flex items-center gap-4 text-xs flex-wrap">
              <div className="flex items-center gap-1.5"><Mic className="h-3 w-3 text-emerald-500" /> Audio</div>
              <div className="flex items-center gap-1.5"><Video className="h-3 w-3 text-emerald-500" /> Video</div>
              <div className="flex items-center gap-1.5"><HardDrive className="h-3 w-3 text-emerald-500" /> Storage</div>
              <div className="flex items-center gap-1.5"><Cable className="h-3 w-3 text-emerald-500" /> Podcart</div>
              <div className="ml-auto font-mono tabular-nums text-foreground text-sm">
                00:42:18
              </div>
            </div>
          </div>

          {/* uploading */}
          <div className="rounded-xl border border-border/60 bg-background p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">
                  News Bulletin — Wk 14
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  Auto-offload from local source · 12 of 14 files
                </div>
              </div>
              <StatusPill tone="uploading">Uploading</StatusPill>
            </div>
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Pulling from Mac Mini · Studio B</span>
                <span className="font-mono tabular-nums text-foreground">78%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full w-[78%] rounded-full bg-gradient-to-r from-blue-500 to-blue-400" />
              </div>
            </div>
          </div>

          {/* ready */}
          <div className="rounded-xl border border-border/60 bg-background p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">
                  Ep 142 — Founders Lounge
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  Folder organised · share link ready · all files present
                </div>
              </div>
              <StatusPill tone="complete">Ready for editor</StatusPill>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FloatingProducerCard() {
  return (
    <div className="relative w-[260px] rounded-2xl border border-zinc-800 bg-zinc-950 text-zinc-100 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6)] overflow-hidden">
      <div className="border-b border-zinc-800/80 px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-zinc-500 flex items-center justify-between">
        <span>Producer Mode</span>
        <span className="flex items-center gap-1.5 text-red-400">
          <span className="relative inline-flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
          </span>
          REC
        </span>
      </div>
      <div className="p-5 space-y-4 text-center">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-zinc-500">Recording</div>
          <div className="mt-1 font-mono text-3xl tabular-nums">00:42:18</div>
        </div>
        <div className="relative mx-auto h-16 w-16">
          <span className="absolute inset-0 animate-ping rounded-full bg-red-500/30" />
          <button
            type="button"
            aria-label="Stop recording"
            className="relative h-16 w-16 rounded-full bg-red-600 ring-[6px] ring-red-600/20 flex items-center justify-center"
          >
            <span className="h-5 w-5 rounded-sm bg-zinc-100" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-1.5 text-[10px] text-left">
          <div className="flex items-center gap-1.5 rounded bg-zinc-900 px-2 py-1.5"><Dot tone="ok" /> Audio</div>
          <div className="flex items-center gap-1.5 rounded bg-zinc-900 px-2 py-1.5"><Dot tone="ok" /> Video</div>
          <div className="flex items-center gap-1.5 rounded bg-zinc-900 px-2 py-1.5"><Dot tone="ok" /> Storage</div>
          <div className="flex items-center gap-1.5 rounded bg-zinc-900 px-2 py-1.5"><Dot tone="ok" /> Podcart</div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Producer Mode — the WOW moment                                            */
/* -------------------------------------------------------------------------- */

function ProducerModeShowcase() {
  const checks = [
    { icon: Mic, label: "Audio Working", sub: "RODECaster · 4 mics" },
    { icon: Video, label: "Video Working", sub: "3 cameras locked" },
    { icon: HardDrive, label: "Storage Ready", sub: "412 GB available" },
    { icon: Cable, label: "Podcart Connected", sub: "Studio A · linked" },
    { icon: CloudUpload, label: "Upload Ready", sub: "Auto-offload armed" },
  ];

  return (
    <div className="relative mx-auto max-w-6xl rounded-[2rem] border border-zinc-800 bg-zinc-950 text-zinc-100 shadow-[0_50px_120px_-30px_rgba(220,38,38,0.35)] overflow-hidden">
      {/* background glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-red-600/20 blur-[120px]" />
        <div className="absolute bottom-0 left-0 h-[300px] w-[300px] rounded-full bg-blue-600/10 blur-[100px]" />
      </div>

      <div className="relative grid lg:grid-cols-[1.1fr_1fr] gap-10 p-8 md:p-12 lg:p-16 items-center">
        {/* left: giant record button + timer */}
        <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-red-300">
            <span className="relative inline-flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
            </span>
            Producer Mode · Live
          </div>

          <div className="mt-6 text-[11px] uppercase tracking-[0.25em] text-zinc-500">
            Session timer
          </div>
          <div className="mt-1 font-mono text-6xl md:text-7xl tabular-nums tracking-tight">
            01:12:04
          </div>

          <div className="mt-10 relative">
            {/* halo */}
            <span className="absolute inset-0 -m-6 rounded-full bg-red-600/20 blur-2xl" />
            <span className="absolute inset-0 -m-2 rounded-full bg-red-600/30 blur-xl animate-pulse" />
            <button
              type="button"
              aria-label="Stop recording"
              className="relative h-44 w-44 md:h-52 md:w-52 rounded-full bg-gradient-to-b from-red-500 to-red-700 ring-[10px] ring-red-600/20 shadow-[0_20px_60px_-10px_rgba(220,38,38,0.7)] flex items-center justify-center transition-transform hover:scale-[1.02]"
            >
              <span className="absolute inset-3 rounded-full ring-1 ring-white/20" />
              <span className="h-16 w-16 md:h-20 md:w-20 rounded-xl bg-white/95 shadow-inner" />
            </button>
          </div>

          <div className="mt-8 max-w-sm text-sm text-zinc-400 leading-relaxed">
            One screen. One button. The whole production under control.
            Students press <span className="text-zinc-100 font-medium">RECORD</span> with confidence
            and <span className="text-zinc-100 font-medium">STOP</span> without fear of losing the take.
          </div>
        </div>

        {/* right: confidence checklist */}
        <div className="space-y-3">
          <div className="text-[11px] uppercase tracking-[0.25em] text-zinc-500">
            Pre-flight confidence check
          </div>
          {checks.map(({ icon: Icon, label, sub }) => (
            <div
              key={label}
              className="flex items-center gap-4 rounded-xl border border-zinc-800/80 bg-gradient-to-br from-zinc-900/90 to-zinc-900/40 px-4 py-3.5 backdrop-blur"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/20">
                <Icon className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-zinc-100">{label}</div>
                <div className="text-xs text-zinc-500">{sub}</div>
              </div>
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            </div>
          ))}

          <div className="mt-2 flex items-center gap-3 rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-sm text-blue-200">
            <ShieldCheck className="h-4 w-4 text-blue-300 flex-shrink-0" />
            All systems green. Safe to record.
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Editor handoff mockup                                                     */
/* -------------------------------------------------------------------------- */

function HandoffMockup() {
  return (
    <div className="relative mx-auto w-full max-w-lg">
      <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-blue-500/10 to-emerald-500/5 blur-2xl" />
      <div className="relative rounded-2xl border border-border/60 bg-card shadow-xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-5 py-3">
          <div className="text-sm font-semibold">Ep 142 — Founders Lounge</div>
          <StatusPill tone="complete">Ready for editor</StatusPill>
        </div>
        <div className="divide-y divide-border/60 text-sm">
          {[
            { name: "01_audio / multitrack.wav", meta: "1.2 GB" },
            { name: "02_video / cam_a.mov", meta: "8.4 GB" },
            { name: "02_video / cam_b.mov", meta: "8.1 GB" },
            { name: "02_video / cam_c.mov", meta: "7.9 GB" },
            { name: "03_notes / producer.md", meta: "2 KB" },
          ].map((f) => (
            <div key={f.name} className="flex items-center justify-between px-5 py-3">
              <div className="font-mono text-xs text-muted-foreground">{f.name}</div>
              <div className="text-xs tabular-nums text-muted-foreground">{f.meta}</div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-border/60 bg-muted/20 px-5 py-3 text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-muted-foreground">All expected files present</span>
          </div>
          <div className="rounded-md bg-foreground px-3 py-1.5 font-medium text-background">
            Copy share link
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default function Home() {
  return (
    <PublicLayout>
      <div className="flex flex-col">

        {/* ─────────────────────────────────────────────────────────────── */}
        {/* HERO                                                            */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden">
          {/* layered backdrop */}
          <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-muted/40" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[600px] bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.12),transparent_60%)]" />
          <div className="pointer-events-none absolute -left-32 top-40 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -right-32 top-60 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl" />
          {/* subtle grid */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />

          <div className="relative container pt-16 pb-32 md:pt-24 md:pb-40">
            <div className="mx-auto max-w-4xl text-center space-y-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-background/80 px-3.5 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
                <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                The recording confidence platform — built for schools, studios and Podcart
              </div>

              <h1 className="text-5xl md:text-7xl lg:text-[5.25rem] font-extrabold tracking-tight leading-[0.98]">
                The operating system
                <br />
                <span className="bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-500 bg-clip-text text-transparent">
                  for school media.
                </span>
              </h1>

              <p className="mx-auto max-w-2xl text-lg md:text-xl text-muted-foreground leading-relaxed">
                Record locally. Offload automatically. Producer Mode gives students
                the confidence to run real productions — and gives teachers their
                time back.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3">
                <a href="mailto:hello@offloadr.app?subject=Offloadr%20demo%20request">
                  <Button size="lg" className="h-12 px-8 text-base font-semibold shadow-lg shadow-blue-600/20">
                    Book a Demo <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                </a>
                <a href="#producer-mode">
                  <Button size="lg" variant="outline" className="h-12 px-7 text-base">
                    See Producer Mode
                  </Button>
                </a>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><Dot tone="ok" /> Built for RODECaster Pro II</span>
                <span className="inline-flex items-center gap-1.5"><Dot tone="ok" /> Multi-camera ready</span>
                <span className="inline-flex items-center gap-1.5"><Dot tone="ok" /> Education-grade workflows</span>
              </div>
            </div>

            {/* DOMINANT MOCKUP */}
            <div className="relative mx-auto mt-20 max-w-7xl">
              {/* under-glow */}
              <div className="pointer-events-none absolute -inset-x-12 -bottom-12 h-32 rounded-[3rem] bg-blue-500/25 blur-3xl" />
              <div className="pointer-events-none absolute inset-x-1/4 -bottom-4 h-12 rounded-full bg-foreground/10 blur-2xl" />

              <HeroDashboard />

              {/* floating producer-mode card overlapping */}
              <div className="hidden md:block absolute -right-4 lg:-right-12 -bottom-12 lg:-bottom-16 z-10">
                <FloatingProducerCard />
              </div>
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────── */}
        {/* TRUST STRIP                                                     */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <section className="border-y border-border/60 bg-muted/20">
          <div className="container py-10">
            <div className="grid grid-cols-2 gap-6 md:grid-cols-4 text-center">
              {[
                { stat: "0", label: "files dragged by hand" },
                { stat: "1-tap", label: "recording confidence" },
                { stat: "100%", label: "session integrity check" },
                { stat: "EDU", label: "first infrastructure" },
              ].map((s) => (
                <div key={s.label} className="space-y-1">
                  <div className="text-2xl md:text-3xl font-bold tracking-tight">{s.stat}</div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────── */}
        {/* PRODUCER MODE — THE WOW MOMENT                                  */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <section
          id="producer-mode"
          className="relative overflow-hidden bg-gradient-to-b from-background to-zinc-950"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(220,38,38,0.08),transparent_70%)]" />
          <div className="relative container py-24 md:py-32">
            <div className="mx-auto max-w-3xl text-center space-y-5 mb-16">
              <SectionEyebrow>The centrepiece</SectionEyebrow>
              <h2 className="text-4xl md:text-6xl font-bold tracking-tight">
                Producer Mode.
                <br />
                <span className="text-muted-foreground">One screen. Total confidence.</span>
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
                Built so a Year 8 student can run the same studio session a
                professional producer would. No menus. No file management. No
                anxiety — just a green light to record and a safe way to stop.
              </p>
            </div>

            <ProducerModeShowcase />

            <div className="mx-auto mt-12 grid max-w-5xl gap-4 md:grid-cols-3 text-sm">
              {[
                {
                  t: "Idiot-proof workflow",
                  d: "Pre-flight check gates the record button. Students never start a session that isn't actually recording.",
                },
                {
                  t: "Safe to stop",
                  d: "Full-screen STOP confirmation prevents accidental cuts mid-take. The take is locked the moment you stop.",
                },
                {
                  t: "Auto-offload built in",
                  d: "The moment recording ends, files are pulled from the local hardware into a clean project. Nothing dragged.",
                },
              ].map((b) => (
                <div
                  key={b.t}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 backdrop-blur"
                >
                  <div className="text-sm font-semibold text-zinc-100">{b.t}</div>
                  <div className="mt-1.5 text-sm text-zinc-400 leading-relaxed">{b.d}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────── */}
        {/* HOW IT WORKS                                                    */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <section id="how-it-works" className="border-b border-border/60">
          <div className="container py-24 md:py-28">
            <div className="mx-auto max-w-3xl text-center space-y-4 mb-16">
              <SectionEyebrow>Record to ready</SectionEyebrow>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
                Four clean steps. Zero chaos.
              </h2>
              <p className="text-base text-muted-foreground leading-relaxed">
                Offloadr isn't recording in the cloud. It is the workflow
                infrastructure around your local studio — so the recording
                actually arrives, organised, every time.
              </p>
            </div>

            <div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-2 lg:grid-cols-4">
              {[
                { n: "01", t: "Record locally", d: "Use the gear teams already trust — RODECaster, cameras, switchers, Mac Mini, Podcart." },
                { n: "02", t: "Stop with confidence", d: "Producer Mode confirms audio, video, storage and Podcart are all live before you hit stop." },
                { n: "03", t: "Auto-offload", d: "Files are pulled from local sources into a structured project. No drag and drop, no chasing SD cards." },
                { n: "04", t: "Editor handoff", d: "One secure share link. Tagged files, missing-file checklist, producer notes attached." },
              ].map((s, i) => (
                <div key={s.n} className="relative">
                  <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm hover:shadow-md transition-shadow h-full">
                    <div className="flex items-center justify-between">
                      <div className="font-mono text-xs font-semibold text-blue-600">{s.n}</div>
                      <div className="h-8 w-8 rounded-lg bg-blue-500/10 ring-1 ring-blue-500/20 flex items-center justify-center text-blue-600 text-xs font-bold">
                        {i + 1}
                      </div>
                    </div>
                    <div className="mt-4 text-lg font-semibold">{s.t}</div>
                    <div className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────── */}
        {/* ECOSYSTEM — Podcart + Schools                                   */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <section
          id="schools"
          className="relative overflow-hidden border-b border-border/60 bg-muted/20"
        >
          <div className="pointer-events-none absolute -left-40 top-1/2 h-96 w-96 -translate-y-1/2 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="relative container py-24 md:py-28">
            <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr] items-start">
              <div className="space-y-6">
                <SectionEyebrow>
                  <GraduationCap className="h-3 w-3" /> Education-first ecosystem
                </SectionEyebrow>
                <h2 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight">
                  Hardware, software and workflow —
                  <span className="text-blue-600"> built for the next generation of student voice.</span>
                </h2>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  Offloadr is the workflow layer behind Podcart, the school
                  studio cart used for Oracy, podcasting, debate, news and
                  student broadcasting. Hardware and software designed together
                  — so a teacher with no production background can still run a
                  real studio.
                </p>

                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { t: "Podcart hardware", d: "RODECaster, cameras, Mac Mini, mixer — all integrated." },
                    { t: "Producer Mode", d: "Student-safe control surface for live productions." },
                    { t: "Oracy & debate", d: "Capture-ready workflows for speaking and listening." },
                    { t: "Term archives", d: "Cloud storage organised by class, project and year." },
                  ].map((c) => (
                    <div
                      key={c.t}
                      className="rounded-xl border border-border/60 bg-background p-4 shadow-sm"
                    >
                      <div className="text-sm font-semibold">{c.t}</div>
                      <div className="mt-1 text-xs text-muted-foreground leading-relaxed">{c.d}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ecosystem visual */}
              <div className="relative">
                <div className="absolute -inset-6 rounded-3xl bg-gradient-to-br from-blue-500/10 via-transparent to-indigo-500/10 blur-2xl" />
                <div className="relative rounded-2xl border border-border/60 bg-card p-6 shadow-xl">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-4">
                    Studio A · live signal map
                  </div>
                  <div className="space-y-2.5">
                    {[
                      { src: "RODECaster Pro II", to: "4-track audio", ok: true },
                      { src: "Camera A · B · C", to: "Multi-cam video", ok: true },
                      { src: "Podcart Mac Mini", to: "Local capture", ok: true },
                      { src: "Producer Mode tablet", to: "Session control", ok: true },
                      { src: "Offloadr cloud", to: "Auto-offload + handoff", ok: true },
                    ].map((row) => (
                      <div
                        key={row.src}
                        className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/60 px-3 py-2.5 text-xs"
                      >
                        <div className="flex-1 font-medium">{row.src}</div>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <div className="flex-1 text-right text-muted-foreground">{row.to}</div>
                        <Dot tone="ok" />
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 grid grid-cols-4 gap-2 text-center text-[10px] uppercase tracking-wider text-muted-foreground">
                    {["Capture", "Confirm", "Offload", "Hand off"].map((s, i) => (
                      <div key={s} className="space-y-1">
                        <div className={`h-1 rounded-full ${i < 4 ? "bg-blue-500" : "bg-muted"}`} />
                        <div>{s}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              {[
                "Student voice", "Oracy lessons", "School podcasts", "Debate finals",
                "School news", "Remote guests", "Oral assessments", "Teacher workload ↓",
              ].map((u) => (
                <div
                  key={u}
                  className="rounded-lg border border-border/60 bg-background px-4 py-3 font-medium text-center"
                >
                  {u}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────── */}
        {/* EDITOR HANDOFF                                                  */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <section className="border-b border-border/60">
          <div className="container py-24 md:py-28">
            <div className="grid items-center gap-16 lg:grid-cols-2">
              <div>
                <HandoffMockup />
              </div>
              <div className="space-y-5">
                <SectionEyebrow>Editor handoff</SectionEyebrow>
                <h2 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight">
                  Project ready for editor.
                  <br />
                  <span className="text-muted-foreground">Every. single. time.</span>
                </h2>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  When a session completes, Offloadr produces a clean,
                  predictable project. Folders are organised. Files are tagged.
                  Anything missing is flagged before the editor ever opens it.
                </p>
                <ul className="space-y-3 text-sm">
                  {[
                    "Predictable folder structure across every project",
                    "Tagged audio, video and notes — ready for FCP, Resolve or Premiere",
                    "Missing-file checklist surfaced before share",
                    "Single secure share link, time-bound, owner-revocable",
                  ].map((b) => (
                    <li key={b} className="flex items-start gap-3">
                      <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-500 flex-shrink-0" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────── */}
        {/* PRICING                                                         */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <section id="pricing" className="border-b border-border/60 bg-muted/20">
          <div className="container py-24 md:py-28">
            <div className="mx-auto max-w-3xl text-center space-y-4 mb-14">
              <SectionEyebrow>Pricing</SectionEyebrow>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
                Simple plans for every studio.
              </h2>
              <p className="text-base text-muted-foreground">
                Start small. Scale into Podcart and Education when you're ready.
              </p>
            </div>

            <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-3">
              {[
                {
                  name: "Creator",
                  tag: "Solo podcasters and creators",
                  bullets: ["1 active project at a time", "Local upload from one source", "Basic editor share link"],
                  cta: "Start free", href: "/register", primary: false,
                },
                {
                  name: "Studio",
                  tag: "Production teams and agencies",
                  bullets: ["Unlimited projects", "Multi-source recording sessions", "Producer Mode for every session", "Editor handoff with checklist"],
                  cta: "Start a Project", href: "/register", primary: true,
                },
                {
                  name: "Education",
                  tag: "Schools running Podcart",
                  bullets: ["Producer Mode for students", "School-grade workflows", "Cloud storage for term archives", "Podcart hardware + support"],
                  cta: "Talk to us", href: "mailto:hello@offloadr.app", primary: false,
                },
              ].map((p) => (
                <div
                  key={p.name}
                  className={`relative rounded-2xl border bg-background p-7 flex flex-col ${
                    p.primary
                      ? "border-blue-500/40 shadow-xl shadow-blue-500/10 ring-1 ring-blue-500/20"
                      : "border-border/60"
                  }`}
                >
                  {p.primary && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                      Most popular
                    </div>
                  )}
                  <div className="text-sm font-semibold text-blue-600">{p.name}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{p.tag}</div>
                  <ul className="mt-5 space-y-2.5 text-sm flex-1">
                    {p.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2.5">
                        <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-500 flex-shrink-0" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-6">
                    {p.href.startsWith("mailto:") ? (
                      <a href={p.href} className="block">
                        <Button variant={p.primary ? "default" : "outline"} className="w-full">{p.cta}</Button>
                      </a>
                    ) : (
                      <Link href={p.href} className="block">
                        <Button variant={p.primary ? "default" : "outline"} className="w-full">{p.cta}</Button>
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────── */}
        {/* FINAL CTA                                                       */}
        {/* ─────────────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.10),transparent_60%)]" />
          <div className="relative container py-24 md:py-32">
            <div className="mx-auto max-w-3xl text-center space-y-7">
              <SectionEyebrow>The future of student media</SectionEyebrow>
              <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.05]">
                From recording chaos
                <br />
                <span className="bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent">
                  to ready-to-edit projects.
                </span>
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
                Offloadr is the operating system schools, studios and Podcart
                teams use to run real productions with confidence. Start a
                project in minutes — or book a demo and see Producer Mode live.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <a href="mailto:hello@offloadr.app?subject=Offloadr%20demo%20request">
                  <Button size="lg" className="h-12 px-8 text-base font-semibold shadow-lg shadow-blue-600/20">
                    Book a Demo <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                </a>
                <Link href="/register">
                  <Button size="lg" variant="outline" className="h-12 px-7 text-base">
                    Start a Project
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
