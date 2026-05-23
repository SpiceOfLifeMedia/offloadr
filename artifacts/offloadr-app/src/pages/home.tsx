import { PublicLayout } from "@/components/layout/public-layout";
import { openDemoModal } from "@/components/marketing/demo-modal";
import {
  ArrowRight,
  Upload,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Smartphone,
  School,
  Users,
  Eye,
  Server,
  KeyRound,
  GraduationCap,
  Play,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  Constants                                                                  */
/* -------------------------------------------------------------------------- */

const LOGIN_HREF = "https://offloadr-pilot.fly.dev/offloadr/login";

/* -------------------------------------------------------------------------- */
/*  Atoms                                                                      */
/* -------------------------------------------------------------------------- */

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="brand-eyebrow">{children}</div>;
}

function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "left",
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  align?: "left" | "center";
}) {
  return (
    <div
      className={`max-w-3xl space-y-4 ${align === "center" ? "mx-auto text-center" : ""}`}
    >
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-zinc-50 leading-[1.05]">
        {title}
      </h2>
      {subtitle && (
        <p
          className={`text-base md:text-lg text-zinc-300 leading-relaxed max-w-2xl ${
            align === "center" ? "mx-auto" : ""
          }`}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}

function PrimaryCTA({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={openDemoModal}
      className="inline-flex h-12 items-center justify-center rounded-lg bg-white px-7 text-sm font-semibold text-zinc-950 hover:bg-zinc-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50"
    >
      {children}
      <ArrowRight className="ml-2 h-4 w-4" />
    </button>
  );
}

function SecondaryCTA({ children, href = LOGIN_HREF }: { children: React.ReactNode; href?: string }) {
  return (
    <a
      href={href}
      className="inline-flex h-12 items-center justify-center rounded-lg border border-zinc-700 px-7 text-sm font-semibold text-zinc-100 hover:bg-zinc-900 hover:border-zinc-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50"
    >
      {children}
    </a>
  );
}

/* -------------------------------------------------------------------------- */
/*  Hero — composed static stack on the right, gradient text on headline       */
/* -------------------------------------------------------------------------- */

function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-xl h-[480px] md:h-[520px]">
      {/* Static glow halo — no animation */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-16 -z-10 rounded-[3rem]"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 50%, rgb(79 70 229 / 0.16) 0%, rgb(124 58 237 / 0.08) 40%, transparent 70%)",
          filter: "blur(48px)",
        }}
      />

      {/* Top-left: Student uploads card (offset, slight rotation) */}
      <div
        className="absolute top-0 left-0 w-[240px] rounded-xl border border-white/[0.08] bg-zinc-950/85 backdrop-blur-sm p-4 brand-card shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)]"
        style={{ transform: "rotate(-3deg)" }}
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="brand-icon brand-icon-sm brand-blue">
            <Upload className="h-3.5 w-3.5" strokeWidth={2} />
          </div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
            Student uploads
          </div>
        </div>
        <ul className="space-y-1.5 text-[12px]">
          <li className="flex items-center justify-between text-zinc-300">
            <span className="truncate">interview_ava.mp4</span>
            <span className="text-zinc-500 font-mono ml-2">84 MB</span>
          </li>
          <li className="flex items-center justify-between text-zinc-300">
            <span className="truncate">b_roll_mia.mov</span>
            <span className="text-zinc-500 font-mono ml-2">112 MB</span>
          </li>
          <li className="flex items-center justify-between text-zinc-300">
            <span className="truncate">cover_noah.jpg</span>
            <span className="text-zinc-500 font-mono ml-2">4 MB</span>
          </li>
        </ul>
      </div>

      {/* Bottom-right: Final MP4 ready card */}
      <div
        className="absolute bottom-0 right-0 w-[240px] rounded-xl border border-white/[0.08] bg-zinc-950/85 backdrop-blur-sm p-4 brand-card shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)]"
        style={{ transform: "rotate(3deg)" }}
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="brand-icon brand-icon-sm brand-emerald">
            <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
          </div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
            Final MP4
          </div>
        </div>
        <div className="text-sm font-semibold text-zinc-100 mb-1.5">
          Episode 4 — Approved
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 ring-1 ring-emerald-400/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
          <ShieldCheck className="h-2.5 w-2.5" />
          Safe to download
        </span>
      </div>

      {/* Centre: main Episode 4 card (largest, slight tilt the other way) */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(280px,calc(100vw-3rem))] sm:w-[340px] md:w-[400px] rounded-2xl border border-white/[0.10] bg-zinc-950/90 backdrop-blur-sm p-6 brand-card shadow-[0_40px_120px_-40px_rgba(0,0,0,0.95)] z-10"
        style={{ transform: "translate(-50%, -50%) rotate(-1deg)" }}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
            Year 6 Media Studies
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/10 ring-1 ring-violet-400/30 px-2.5 py-1 text-[11px] font-semibold text-violet-200">
            <Sparkles className="h-3 w-3" />
            AI Draft
          </span>
        </div>

        <div className="text-lg font-semibold text-zinc-50 tracking-tight">
          Episode 4 — Lunchtime News
        </div>
        <div className="mt-1 text-[13px] text-zinc-400">
          AI draft ready for your review · 3 students contributed
        </div>

        <div className="mt-5 flex items-center gap-4">
          <button
            type="button"
            className="h-11 w-11 rounded-full bg-white text-zinc-950 grid place-items-center hover:bg-zinc-200 transition-colors flex-shrink-0"
            aria-label="Play preview"
          >
            <Play className="h-3.5 w-3.5 ml-0.5" />
          </button>
          <div className="flex-1">
            {/* The ONE pulsing element — only on the progress bar */}
            <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full w-2/5 rounded-full brand-pulse"
                style={{
                  background:
                    "linear-gradient(90deg, rgb(0 128 255), rgb(79 70 229), rgb(124 58 237))",
                }}
              />
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-zinc-500 font-mono">
              <span>00:42</span>
              <span>01:48</span>
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2 text-[11px] text-zinc-300">
          <div className="rounded-lg bg-zinc-900/60 ring-1 ring-white/[0.05] px-3 py-2">
            <div className="text-zinc-500 text-[10px]">Uploaded by</div>
            <div className="font-semibold text-zinc-100 mt-0.5 truncate">
              Ava, Mia, Noah
            </div>
          </div>
          <div className="rounded-lg bg-zinc-900/60 ring-1 ring-white/[0.05] px-3 py-2">
            <div className="text-zinc-500 text-[10px]">AI prepared</div>
            <div className="font-semibold text-zinc-100 mt-0.5">02:14 ago</div>
          </div>
          <div className="rounded-lg bg-zinc-900/60 ring-1 ring-white/[0.05] px-3 py-2">
            <div className="text-zinc-500 text-[10px]">Status</div>
            <div className="font-semibold text-emerald-300 mt-0.5">Safe</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Single static hero glow — no animation */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute -top-60 left-1/2 -translate-x-1/2 h-[820px] w-[1300px] rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(closest-side, rgb(79 70 229 / 0.18), transparent)",
          }}
        />
      </div>

      <div className="container pt-20 md:pt-32 pb-24 md:pb-32 relative z-10">
        <div className="grid lg:grid-cols-12 gap-16 items-center">
          <div className="lg:col-span-7 space-y-8">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-300">
              <span
                className="h-1.5 w-1.5 rounded-full brand-pulse"
                style={{ background: "rgb(167 139 250)" }}
              />
              Built for school media programs
            </span>

            <h1 className="text-5xl md:text-7xl font-semibold tracking-tight text-zinc-50 leading-[0.98]">
              Students record.
              <br />
              <span className="brand-gradient-text">
                Offloadr builds the story.
              </span>
            </h1>

            <p className="text-lg md:text-xl text-zinc-300 leading-relaxed max-w-2xl">
              Students upload footage from iPads, laptops or phones. Offloadr
              organises the media, prepares a first video draft and gives
              teachers a final MP4 to review, download and share.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <PrimaryCTA>Book a School Demo</PrimaryCTA>
              <SecondaryCTA>Log in to Offloadr</SecondaryCTA>
            </div>

            {/* Proof stats row — answers principal / IT objections fast */}
            <dl className="flex flex-wrap items-center gap-x-8 gap-y-3 pt-4 text-sm">
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Browser-based
                </dt>
                <dd className="mt-0.5 text-zinc-100 font-semibold">
                  100% — no installs
                </dd>
              </div>
              <div className="hidden sm:block h-8 w-px bg-white/[0.08]" />
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Data region
                </dt>
                <dd className="mt-0.5 text-zinc-100 font-semibold">
                  Hosted in Australia
                </dd>
              </div>
              <div className="hidden sm:block h-8 w-px bg-white/[0.08]" />
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Student accounts
                </dt>
                <dd className="mt-0.5 text-zinc-100 font-semibold">
                  Zero to create
                </dd>
              </div>
            </dl>

            <div className="pt-1 text-xs text-zinc-500">
              Now piloting with Australian secondary schools and education media
              programs.
            </div>
          </div>

          <div className="lg:col-span-5">
            <HeroVisual />
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  How it works — 4 calm steps, brand-coloured progression                    */
/* -------------------------------------------------------------------------- */

const STEPS = [
  {
    n: "01",
    icon: Upload,
    tint: "brand-blue",
    title: "Students upload from any device",
    body: "Phone, school laptop, Chromebook or classroom camera. One scan, one tap. No accounts to create, no drives to hand around.",
  },
  {
    n: "02",
    icon: School,
    tint: "brand-indigo",
    title: "Offloadr organises every take",
    body: "Files land in the right class, the right project, with the right student attached. Nothing gets lost, nothing gets misnamed.",
  },
  {
    n: "03",
    icon: Sparkles,
    tint: "brand-violet",
    title: "AI prepares a teacher-ready draft",
    body: "Highlights detected, captions generated, a first-cut export ready before the next bell. For the teacher to review — not for the class to see.",
  },
  {
    n: "04",
    icon: ShieldCheck,
    tint: "brand-emerald",
    title: "Teacher approves. Safe to close.",
    body: "Nothing leaves the classroom until the teacher signs off. Approved projects export to MP4, share with parents, or hand off to senior students.",
  },
] as const;

function HowItWorks() {
  return (
    <section
      id="how"
      className="relative border-y border-white/[0.06] bg-zinc-950/40"
    >
      <div className="container py-24 md:py-32 relative z-10">
        <SectionHeading
          eyebrow="How it works"
          title="From a phone in the back row to a teacher-approved project."
          subtitle="Four quiet steps. No drives, no DIY pipelines, no late nights chasing files."
        />

        <div className="mt-14 relative">
          {/* Gradient connector line behind the cards (desktop only) */}
          <div
            aria-hidden
            className="hidden lg:block absolute top-12 left-[12.5%] right-[12.5%] h-px pointer-events-none"
            style={{
              background:
                "linear-gradient(90deg, rgb(0 128 255 / 0.35), rgb(79 70 229 / 0.35), rgb(124 58 237 / 0.35), rgb(16 185 129 / 0.35))",
            }}
          />

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {STEPS.map((s) => (
              <div
                key={s.n}
                className="brand-card rounded-2xl border border-white/[0.06] bg-zinc-950/80 p-7"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className={`brand-icon ${s.tint}`}>
                    <s.icon className="h-5 w-5" strokeWidth={2} />
                  </div>
                  <span className="text-[11px] font-mono text-zinc-500">
                    {s.n}
                  </span>
                </div>
                <div className="text-base font-semibold text-zinc-50 mb-2 tracking-tight">
                  {s.title}
                </div>
                <p className="text-sm text-zinc-300 leading-relaxed">
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  For Schools — three reasons, brand-coloured                                */
/* -------------------------------------------------------------------------- */

const REASONS = [
  {
    icon: ShieldCheck,
    tint: "brand-blue",
    title: "Safe-for-schools by default",
    body:
      "No public links. No student data exposed. Teachers control access at every step, and every upload is tied to a real student in a real class — never an anonymous file on a drive.",
  },
  {
    icon: Sparkles,
    tint: "brand-indigo",
    title: "AI that helps teachers, not replaces them",
    body:
      "AI prepares the draft — highlights, captions, exports. A teacher always reviews before anything reaches the class, the parents, or the school's channels.",
  },
  {
    icon: Smartphone,
    tint: "brand-violet",
    title: "Works on the devices students already have",
    body:
      "Phone, school laptop, Chromebook, classroom camera. One scan, one tap, one upload. No app installs, no logins to remember, no IT tickets.",
  },
] as const;

function ForSchools() {
  return (
    <section id="for-schools" className="relative border-b border-white/[0.06]">
      <div className="container py-24 md:py-32 relative z-10">
        <SectionHeading
          eyebrow="For schools"
          title="Built for the way real classrooms actually work."
        />
        <div className="mt-14 grid md:grid-cols-3 gap-4">
          {REASONS.map((r) => (
            <div
              key={r.title}
              className="brand-card rounded-2xl border border-white/[0.06] bg-zinc-950/80 p-8"
            >
              <div className={`brand-icon ${r.tint} mb-6`}>
                <r.icon className="h-5 w-5" strokeWidth={2} />
              </div>
              <div className="text-lg font-semibold text-zinc-50 tracking-tight mb-2">
                {r.title}
              </div>
              <p className="text-sm text-zinc-300 leading-relaxed">{r.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Classroom Workflow — three lanes with brand-coloured checks                */
/* -------------------------------------------------------------------------- */

function WorkflowSection() {
  const lanes = [
    {
      label: "Students",
      icon: Users,
      tint: "brand-blue",
      checkColor: "text-[rgb(96_165_250)]",
      items: [
        "Ava recorded interview",
        "Mia recorded B-roll",
        "Noah uploading…",
      ],
    },
    {
      label: "Offloadr",
      icon: School,
      tint: "brand-indigo",
      checkColor: "text-[rgb(167_139_250)]",
      items: [
        "Sorted into Year 6 · Episode 4",
        "All 8 takes verified",
        "Ready for AI",
      ],
    },
    {
      label: "Teacher",
      icon: GraduationCap,
      tint: "brand-emerald",
      checkColor: "text-emerald-400",
      items: [
        "Draft ready to review",
        "Approve · Edit notes · Re-run AI",
        "Share with parents",
      ],
    },
  ] as const;

  return (
    <section
      id="workflow"
      className="relative border-b border-white/[0.06] bg-zinc-950/40"
    >
      <div className="container py-24 md:py-32 relative z-10">
        <SectionHeading
          eyebrow="Classroom workflow"
          title="One simple flow. Three quiet hand-offs."
          subtitle="Students record. Offloadr organises and prepares. Teachers review and approve. That's the whole loop."
        />

        <div className="mt-14 grid md:grid-cols-3 gap-4">
          {lanes.map((lane, idx) => (
            <div
              key={lane.label}
              className="brand-card relative rounded-2xl border border-white/[0.06] bg-zinc-950/80 p-7"
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className={`brand-icon brand-icon-sm ${lane.tint}`}>
                    <lane.icon className="h-4 w-4" strokeWidth={2} />
                  </div>
                  <div className="text-sm font-semibold text-zinc-50 tracking-tight">
                    {lane.label}
                  </div>
                </div>
                <span className="text-[11px] font-mono text-zinc-500">
                  0{idx + 1}
                </span>
              </div>
              <ul className="space-y-2.5 text-sm text-zinc-200">
                {lane.items.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <CheckCircle2
                      className={`h-4 w-4 mt-0.5 ${lane.checkColor} flex-shrink-0`}
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  AI Editing — single clean four-stage strip, brand-coloured                 */
/* -------------------------------------------------------------------------- */

const AI_STAGES = [
  {
    label: "Student uploads",
    icon: Upload,
    tint: "brand-blue",
    sub: "Phone, laptop, camera",
  },
  {
    label: "AI prepares draft",
    icon: Sparkles,
    tint: "brand-indigo",
    sub: "Highlights · captions · cut",
  },
  {
    label: "Teacher reviews",
    icon: Eye,
    tint: "brand-violet",
    sub: "Approve · request changes",
  },
  {
    label: "Ready to export",
    icon: CheckCircle2,
    tint: "brand-emerald",
    sub: "MP4 · share · archive",
  },
] as const;

function AIEditingSection() {
  return (
    <section id="ai" className="relative border-b border-white/[0.06]">
      <div className="container py-24 md:py-32 relative z-10">
        <SectionHeading
          eyebrow="AI editing"
          title="AI does the first cut. Teachers do the calls that matter."
          subtitle="Offloadr's AI doesn't replace the teacher. It prepares a draft fast enough that the teacher can spend their time on judgement, not on importing files."
        />

        <div className="mt-14">
          <div className="brand-card rounded-2xl border border-white/[0.06] bg-zinc-950/80 p-6 md:p-10">
            <ol className="grid md:grid-cols-4 gap-4 relative">
              {AI_STAGES.map((s, idx) => (
                <li key={s.label} className="relative">
                  <div className="flex items-start gap-4 md:flex-col md:items-start">
                    <div className={`brand-icon ${s.tint} flex-shrink-0`}>
                      <s.icon className="h-5 w-5" strokeWidth={2} />
                    </div>
                    <div className="md:mt-4">
                      <div className="text-[11px] font-mono text-zinc-500 mb-1">
                        Step {idx + 1}
                      </div>
                      <div className="text-base font-semibold text-zinc-50 tracking-tight">
                        {s.label}
                      </div>
                      <div className="text-sm text-zinc-300 mt-1">{s.sub}</div>
                    </div>
                  </div>
                  {idx < AI_STAGES.length - 1 && (
                    <div
                      aria-hidden
                      className="hidden md:block absolute top-5 left-[calc(50%+1.75rem)] right-[-1rem] h-px"
                      style={{
                        background:
                          "linear-gradient(90deg, rgb(79 70 229 / 0.4), rgb(124 58 237 / 0.15) 80%, transparent)",
                      }}
                    />
                  )}
                </li>
              ))}
            </ol>

            <div className="mt-10 grid sm:grid-cols-3 gap-3">
              {[
                "Captions generated from student audio, ready to caption-burn",
                "Highlight detection picks the moments teachers usually mark",
                "First-cut MP4 export available in the teacher dashboard",
              ].map((t) => (
                <div
                  key={t}
                  className="flex items-start gap-2.5 rounded-lg bg-zinc-900/40 ring-1 ring-white/[0.04] px-4 py-3 text-sm text-zinc-200"
                >
                  <Sparkles
                    className="h-4 w-4 mt-0.5 flex-shrink-0"
                    strokeWidth={2}
                    style={{ color: "rgb(167 139 250)" }}
                  />
                  <span>{t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Security — school-grade trust signals, all blue                            */
/* -------------------------------------------------------------------------- */

const SECURITY_POINTS = [
  {
    icon: Lock,
    title: "Teacher-controlled access",
    body: "Every upload is tied to a student in a class. Nothing is shared, public, or sent home until the teacher explicitly approves it.",
  },
  {
    icon: KeyRound,
    title: "Student privacy by design",
    body: "Students don't sign up. They upload via a per-class scan-and-tap code. No public accounts, no public profiles, nothing for the open internet to crawl.",
  },
  {
    icon: Server,
    title: "Australian-hosted infrastructure",
    body: "Storage and processing run in Australian data regions, on infrastructure aligned to how school IT teams actually operate.",
  },
  {
    icon: Eye,
    title: "A clear audit trail",
    body: "Every upload, every AI run, every approval is logged against a teacher and a class. If it's ever asked about, there's an answer.",
  },
] as const;

function SecuritySection() {
  return (
    <section
      id="security"
      className="relative border-b border-white/[0.06] bg-zinc-950/40"
    >
      <div className="container py-24 md:py-32 relative z-10">
        <div className="grid lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-5 space-y-5 lg:sticky lg:top-28">
            <Eyebrow>Security · Built for Australian schools</Eyebrow>
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-zinc-50 leading-[1.05]">
              Built to pass the questions school IT actually asks.
            </h2>
            <p className="text-base text-zinc-300 leading-relaxed">
              Schools can't take risks with student data, and they shouldn't
              have to. Offloadr is designed around the way Australian schools
              have to operate — teacher-controlled, privacy-first, hosted
              locally, fully auditable.
            </p>
            <div className="pt-2 flex flex-wrap gap-2">
              {[
                "No public student links",
                "AU data regions",
                "Teacher approvals on every share",
                "Audit log on every action",
              ].map((t) => (
                <span
                  key={t}
                  className="brand-chip-blue inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold"
                >
                  <ShieldCheck className="h-3 w-3" />
                  {t}
                </span>
              ))}
            </div>
          </div>

          <div className="lg:col-span-7 grid sm:grid-cols-2 gap-4">
            {SECURITY_POINTS.map((p) => (
              <div
                key={p.title}
                className="brand-card rounded-2xl border border-white/[0.06] bg-zinc-950/80 p-6"
              >
                <div className="brand-icon brand-blue mb-4">
                  <p.icon className="h-5 w-5" strokeWidth={2} />
                </div>
                <div className="text-base font-semibold text-zinc-50 tracking-tight mb-1.5">
                  {p.title}
                </div>
                <p className="text-sm text-zinc-300 leading-relaxed">
                  {p.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Pilot CTA — wrapped in a bordered card, static glow, gradient on Offloadr  */
/* -------------------------------------------------------------------------- */

function PilotCTA() {
  return (
    <section
      id="pilot"
      className="relative bg-gradient-to-b from-zinc-950 to-zinc-950/30"
    >
      <div className="container py-24 md:py-32 relative z-10">
        <div
          className="brand-card relative mx-auto max-w-4xl rounded-3xl border bg-zinc-950/80 px-8 py-16 md:px-16 md:py-20 text-center overflow-hidden"
          style={{ borderColor: "rgb(79 70 229 / 0.22)" }}
        >
          {/* Static internal glow */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at center top, rgb(79 70 229 / 0.10) 0%, transparent 60%)",
            }}
          />

          <div className="relative z-10 space-y-7 max-w-3xl mx-auto">
            <div className="flex justify-center">
              <Eyebrow>School pilot · Term 2 / Term 3</Eyebrow>
            </div>
            <h2 className="text-4xl md:text-6xl font-semibold tracking-tight text-zinc-50 leading-[1.02]">
              Bring <span className="brand-gradient-text">Offloadr</span> to
              your classroom this term.
            </h2>
            <p className="text-base md:text-lg text-zinc-300 leading-relaxed max-w-2xl mx-auto">
              We're onboarding a small cohort of Australian schools running
              media programs. A short demo, a guided setup, and your students
              can be uploading by the next lesson.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <PrimaryCTA>Book a School Demo</PrimaryCTA>
              <SecondaryCTA>Log in to Offloadr</SecondaryCTA>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function Home() {
  return (
    <PublicLayout>
      <Hero />
      <HowItWorks />
      <ForSchools />
      <WorkflowSection />
      <AIEditingSection />
      <SecuritySection />
      <PilotCTA />
    </PublicLayout>
  );
}
