import { PublicLayout } from "@/components/layout/public-layout";
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

const DEMO_HREF =
  "mailto:demo@useoffloadr.com?subject=Offloadr%20school%20demo%20request&body=Hi%20Offloadr%20team%2C%0A%0AI%27d%20like%20to%20book%20a%20demo%20for%20our%20school.%0A%0ASchool%3A%20%0ARole%3A%20%0AYear%20levels%20%2F%20program%3A%20%0AStudent%20count%3A%20%0AState%3A%20%0ABest%20time%20to%20talk%3A%20%0A%0AThanks%2C";

const LOGIN_HREF = "https://offloadr-pilot.fly.dev/offloadr/login";

/* -------------------------------------------------------------------------- */
/*  Atoms                                                                      */
/* -------------------------------------------------------------------------- */

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
      {children}
    </div>
  );
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
        <p className="text-base md:text-lg text-zinc-300 leading-relaxed max-w-2xl">
          {subtitle}
        </p>
      )}
    </div>
  );
}

function PrimaryCTA({ children, href = DEMO_HREF }: { children: React.ReactNode; href?: string }) {
  return (
    <a
      href={href}
      className="inline-flex h-12 items-center justify-center rounded-lg bg-white px-7 text-sm font-semibold text-zinc-950 hover:bg-zinc-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50"
    >
      {children}
      <ArrowRight className="ml-2 h-4 w-4" />
    </a>
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
/*  Hero — typography-led, single calm visual                                 */
/* -------------------------------------------------------------------------- */

function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-xl">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-16 -z-10 rounded-[3rem] bg-gradient-to-br from-indigo-500/15 via-sky-500/5 to-emerald-500/10 blur-3xl"
      />

      <div className="rounded-2xl border border-white/[0.08] bg-zinc-950/80 backdrop-blur-sm p-7 shadow-[0_40px_120px_-40px_rgba(0,0,0,0.9)]">
        <div className="flex items-center justify-between mb-6">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
            Year 6 Media Studies
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 ring-1 ring-emerald-400/30 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
            <ShieldCheck className="h-3 w-3" />
            Approved
          </span>
        </div>

        <div className="text-xl font-semibold text-zinc-50 tracking-tight">
          Episode 4 — Lunchtime News
        </div>
        <div className="mt-1 text-sm text-zinc-300">
          AI draft ready for your review · 3 students contributed
        </div>

        <div className="mt-6 flex items-center gap-4">
          <button
            type="button"
            className="h-12 w-12 rounded-full bg-white text-zinc-950 grid place-items-center hover:bg-zinc-200 transition-colors"
            aria-label="Play preview"
          >
            <Play className="h-4 w-4 ml-0.5" />
          </button>
          <div className="flex-1">
            <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
              <div className="h-full w-2/5 rounded-full bg-gradient-to-r from-indigo-400 to-sky-400" />
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-zinc-400 font-mono">
              <span>00:42</span>
              <span>01:48</span>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-2 text-[11px] text-zinc-300">
          <div className="rounded-lg bg-zinc-900/60 ring-1 ring-white/[0.05] px-3 py-2.5">
            <div className="text-zinc-400 text-[10px]">Uploaded by</div>
            <div className="font-semibold text-zinc-100 mt-0.5">Ava, Mia, Noah</div>
          </div>
          <div className="rounded-lg bg-zinc-900/60 ring-1 ring-white/[0.05] px-3 py-2.5">
            <div className="text-zinc-400 text-[10px]">AI prepared</div>
            <div className="font-semibold text-zinc-100 mt-0.5">02:14 ago</div>
          </div>
          <div className="rounded-lg bg-zinc-900/60 ring-1 ring-white/[0.05] px-3 py-2.5">
            <div className="text-zinc-400 text-[10px]">Status</div>
            <div className="font-semibold text-emerald-300 mt-0.5">Safe to close</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-60 left-1/2 -translate-x-1/2 h-[820px] w-[1300px] rounded-full bg-[radial-gradient(closest-side,rgba(99,102,241,0.18),transparent)] blur-3xl" />
      </div>

      <div className="container pt-20 md:pt-32 pb-24 md:pb-32">
        <div className="grid lg:grid-cols-12 gap-16 items-center">
          <div className="lg:col-span-7 space-y-8">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              School media workflow infrastructure
            </span>

            <h1 className="text-5xl md:text-7xl font-semibold tracking-tight text-zinc-50 leading-[0.98]">
              Students create.
              <br />
              <span className="text-zinc-400">
                Offloadr organises and prepares everything automatically.
              </span>
            </h1>

            <p className="text-lg md:text-xl text-zinc-300 leading-relaxed max-w-2xl">
              The layer between students recording in the classroom and teachers
              receiving a finished, reviewable project — without the lost files,
              the chasing, or the late nights cutting in iMovie.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <PrimaryCTA>Book a School Demo</PrimaryCTA>
              <SecondaryCTA>Log in to Offloadr</SecondaryCTA>
            </div>

            <div className="pt-2 text-xs text-zinc-400">
              Now piloting with Australian secondary schools and education media programs.
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
/*  How it works — 4 calm steps                                                */
/* -------------------------------------------------------------------------- */

const STEPS = [
  {
    n: "01",
    icon: Upload,
    title: "Students upload from any device",
    body: "Phone, school laptop, Chromebook or classroom camera. One scan, one tap. No accounts to create, no drives to hand around.",
  },
  {
    n: "02",
    icon: School,
    title: "Offloadr organises every take",
    body: "Files land in the right class, the right project, with the right student attached. Nothing gets lost, nothing gets misnamed.",
  },
  {
    n: "03",
    icon: Sparkles,
    title: "AI prepares a teacher-ready draft",
    body: "Highlights detected, captions generated, a first-cut export ready before the next bell. For the teacher to review — not for the class to see.",
  },
  {
    n: "04",
    icon: ShieldCheck,
    title: "Teacher approves. Safe to close.",
    body: "Nothing leaves the classroom until the teacher signs off. Approved projects export to MP4, share with parents, or hand off to senior students.",
  },
];

function HowItWorks() {
  return (
    <section id="how" className="border-y border-white/[0.06] bg-zinc-950/40">
      <div className="container py-24 md:py-32">
        <SectionHeading
          eyebrow="How it works"
          title="From a phone in the back row to a teacher-approved project."
          subtitle="Four quiet steps. No drives, no DIY pipelines, no late nights chasing files."
        />

        <div className="mt-14 grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="rounded-2xl border border-white/[0.06] bg-zinc-950/60 p-7 hover:bg-zinc-950 transition-colors"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="h-10 w-10 rounded-xl bg-indigo-500/10 text-indigo-300 grid place-items-center ring-1 ring-indigo-400/20">
                  <s.icon className="h-4 w-4" />
                </div>
                <span className="text-[11px] font-mono text-zinc-500">{s.n}</span>
              </div>
              <div className="text-base font-semibold text-zinc-50 mb-2 tracking-tight">
                {s.title}
              </div>
              <p className="text-sm text-zinc-300 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  For Schools — three reasons                                                */
/* -------------------------------------------------------------------------- */

const REASONS = [
  {
    icon: ShieldCheck,
    title: "Safe-for-schools by default",
    body:
      "No public links. No student data exposed. Teachers control access at every step, and every upload is tied to a real student in a real class — never an anonymous file on a drive.",
  },
  {
    icon: Sparkles,
    title: "AI that helps teachers, not replaces them",
    body:
      "AI prepares the draft — highlights, captions, exports. A teacher always reviews before anything reaches the class, the parents, or the school's channels.",
  },
  {
    icon: Smartphone,
    title: "Works on the devices students already have",
    body:
      "Phone, school laptop, Chromebook, classroom camera. One scan, one tap, one upload. No app installs, no logins to remember, no IT tickets.",
  },
];

function ForSchools() {
  return (
    <section id="for-schools" className="border-b border-white/[0.06]">
      <div className="container py-24 md:py-32">
        <SectionHeading
          eyebrow="For schools"
          title="Built for the way real classrooms actually work."
        />
        <div className="mt-14 grid md:grid-cols-3 gap-4">
          {REASONS.map((r) => (
            <div
              key={r.title}
              className="rounded-2xl border border-white/[0.06] bg-zinc-950/60 p-8"
            >
              <div className="h-11 w-11 rounded-xl bg-emerald-500/10 text-emerald-300 grid place-items-center ring-1 ring-emerald-400/20 mb-6">
                <r.icon className="h-4 w-4" />
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
/*  Classroom Workflow — one calm visual                                       */
/* -------------------------------------------------------------------------- */

function WorkflowSection() {
  const lanes = [
    { label: "Students", icon: Users, items: ["Ava recorded interview", "Mia recorded B-roll", "Noah uploading…"] },
    { label: "Offloadr", icon: School, items: ["Sorted into Year 6 · Episode 4", "All 8 takes verified", "Ready for AI"] },
    { label: "Teacher", icon: GraduationCap, items: ["Draft ready to review", "Approve · Edit notes · Re-run AI", "Share with parents"] },
  ];

  return (
    <section id="workflow" className="border-b border-white/[0.06] bg-zinc-950/40">
      <div className="container py-24 md:py-32">
        <SectionHeading
          eyebrow="Classroom workflow"
          title="One simple flow. Three quiet hand-offs."
          subtitle="Students record. Offloadr organises and prepares. Teachers review and approve. That's the whole loop."
        />

        <div className="mt-14 grid md:grid-cols-3 gap-4">
          {lanes.map((lane, idx) => (
            <div
              key={lane.label}
              className="relative rounded-2xl border border-white/[0.06] bg-zinc-950/70 p-7"
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-lg bg-white/[0.05] grid place-items-center text-zinc-200">
                    <lane.icon className="h-4 w-4" />
                  </div>
                  <div className="text-sm font-semibold text-zinc-50 tracking-tight">
                    {lane.label}
                  </div>
                </div>
                <span className="text-[11px] font-mono text-zinc-500">0{idx + 1}</span>
              </div>
              <ul className="space-y-2.5 text-sm text-zinc-200">
                {lane.items.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-400 flex-shrink-0" />
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
/*  AI Editing — single clean four-stage strip                                */
/* -------------------------------------------------------------------------- */

const AI_STAGES = [
  { label: "Student uploads", icon: Upload, sub: "Phone, laptop, camera" },
  { label: "AI prepares draft", icon: Sparkles, sub: "Highlights · captions · cut" },
  { label: "Teacher reviews", icon: Eye, sub: "Approve · request changes" },
  { label: "Ready to export", icon: CheckCircle2, sub: "MP4 · share · archive" },
];

function AIEditingSection() {
  return (
    <section id="ai" className="border-b border-white/[0.06]">
      <div className="container py-24 md:py-32">
        <SectionHeading
          eyebrow="AI editing"
          title="AI does the first cut. Teachers do the calls that matter."
          subtitle="Offloadr's AI doesn't replace the teacher. It prepares a draft fast enough that the teacher can spend their time on judgement, not on importing files."
        />

        <div className="mt-14">
          <div className="rounded-2xl border border-white/[0.06] bg-zinc-950/70 p-6 md:p-10">
            <ol className="grid md:grid-cols-4 gap-4">
              {AI_STAGES.map((s, idx) => (
                <li key={s.label} className="relative">
                  <div className="flex items-start gap-4 md:flex-col md:items-start">
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500/20 to-sky-500/10 text-indigo-200 ring-1 ring-indigo-400/30 grid place-items-center flex-shrink-0">
                      <s.icon className="h-5 w-5" />
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
                      className="hidden md:block absolute top-6 left-[calc(50%+1.5rem)] right-[-1rem] h-px bg-gradient-to-r from-indigo-400/30 to-transparent"
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
                  <Sparkles className="h-4 w-4 mt-0.5 text-indigo-300 flex-shrink-0" />
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
/*  Security — school-grade trust signals                                      */
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
];

function SecuritySection() {
  return (
    <section id="security" className="border-b border-white/[0.06] bg-zinc-950/40">
      <div className="container py-24 md:py-32">
        <div className="grid lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-5 space-y-5 lg:sticky lg:top-28">
            <Eyebrow>Security · Built for Australian schools</Eyebrow>
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-zinc-50 leading-[1.05]">
              Built to pass the questions school IT actually asks.
            </h2>
            <p className="text-base text-zinc-300 leading-relaxed">
              Schools can't take risks with student data, and they shouldn't have to.
              Offloadr is designed around the way Australian schools have to operate —
              teacher-controlled, privacy-first, hosted locally, fully auditable.
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
                  className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 ring-1 ring-emerald-400/25 px-3 py-1 text-[11px] font-semibold text-emerald-200"
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
                className="rounded-2xl border border-white/[0.06] bg-zinc-950/70 p-6"
              >
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-300 grid place-items-center ring-1 ring-emerald-400/20 mb-4">
                  <p.icon className="h-4 w-4" />
                </div>
                <div className="text-base font-semibold text-zinc-50 tracking-tight mb-1.5">
                  {p.title}
                </div>
                <p className="text-sm text-zinc-300 leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Pilot CTA                                                                  */
/* -------------------------------------------------------------------------- */

function PilotCTA() {
  return (
    <section id="pilot" className="bg-gradient-to-b from-zinc-950 to-zinc-950/30">
      <div className="container py-28 md:py-36">
        <div className="max-w-3xl mx-auto text-center space-y-7">
          <Eyebrow>School pilot · Term 2 / Term 3</Eyebrow>
          <h2 className="text-4xl md:text-6xl font-semibold tracking-tight text-zinc-50 leading-[1.02]">
            Bring Offloadr to your classroom this term.
          </h2>
          <p className="text-base md:text-lg text-zinc-300 leading-relaxed max-w-2xl mx-auto">
            We're onboarding a small cohort of Australian schools running media
            programs. A short demo, a guided setup, and your students can be
            uploading by the next lesson.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <PrimaryCTA>Book a School Demo</PrimaryCTA>
            <SecondaryCTA>Log in to Offloadr</SecondaryCTA>
          </div>
          <div className="pt-1 text-xs text-zinc-400">
            Already in the pilot? Sign in above to open your Classroom Hub.
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
