import { PublicLayout } from "@/components/layout/public-layout";
import {
  ArrowRight,
  Upload,
  Sparkles,
  ShieldCheck,
  GraduationCap,
  CheckCircle2,
  Clock,
  Lock,
  Smartphone,
  School,
  Users,
  FileVideo,
  Check,
  Play,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  Shared atoms                                                              */
/* -------------------------------------------------------------------------- */

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
      {children}
    </div>
  );
}

type BadgeTone = "indigo" | "emerald" | "amber" | "sky" | "zinc";
const BADGE: Record<BadgeTone, string> = {
  indigo: "bg-indigo-500/10 text-indigo-300 ring-indigo-400/20",
  emerald: "bg-emerald-500/10 text-emerald-300 ring-emerald-400/20",
  amber: "bg-amber-500/10 text-amber-300 ring-amber-400/20",
  sky: "bg-sky-500/10 text-sky-300 ring-sky-400/20",
  zinc: "bg-zinc-800/80 text-zinc-300 ring-zinc-700/60",
};

function Badge({
  tone = "zinc",
  icon: Icon,
  children,
}: {
  tone?: BadgeTone;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${BADGE[tone]}`}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Hero classroom dashboard mockup                                           */
/* -------------------------------------------------------------------------- */

function ClassroomHubMock() {
  return (
    <div className="relative">
      {/* soft glow */}
      <div className="pointer-events-none absolute -inset-8 -z-10 rounded-[2rem] bg-gradient-to-br from-indigo-500/10 via-sky-500/5 to-emerald-500/10 blur-3xl" />

      <div className="rounded-2xl border border-white/[0.08] bg-zinc-950 shadow-[0_40px_120px_-40px_rgba(0,0,0,0.9)] overflow-hidden">
        {/* window chrome */}
        <div className="flex items-center gap-2 border-b border-white/[0.06] bg-zinc-900/50 px-4 py-3">
          <div className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
          <div className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
          <div className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
          <div className="ml-3 truncate text-[11px] text-zinc-500 font-mono">
            offloadr / year-6-media-studies / classroom-hub
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Badge tone="emerald" icon={ShieldCheck}>Safe to close</Badge>
          </div>
        </div>

        {/* body */}
        <div className="grid grid-cols-12 gap-0">
          {/* sidebar */}
          <aside className="col-span-4 border-r border-white/[0.06] bg-zinc-950/60 p-4 space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 px-2 pb-2">
              Your classes
            </div>
            {[
              { name: "Year 6 Media Studies", n: 24, active: true },
              { name: "Year 9 Newsroom", n: 18 },
              { name: "Year 11 Production", n: 12 },
            ].map((c) => (
              <div
                key={c.name}
                className={`flex items-center justify-between rounded-lg px-2.5 py-2 text-sm ${
                  c.active
                    ? "bg-white/[0.05] text-zinc-100"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  <School className="h-3.5 w-3.5 text-zinc-500" />
                  {c.name}
                </span>
                <span className="text-[10px] text-zinc-500">{c.n}</span>
              </div>
            ))}

            <div className="pt-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 px-2 pb-2">
              Today
            </div>
            <div className="rounded-lg border border-white/[0.06] bg-zinc-900/40 p-3 text-xs text-zinc-300 space-y-2">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                3 students uploaded
              </div>
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                1 AI draft ready
              </div>
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                1 awaiting your review
              </div>
            </div>
          </aside>

          {/* main */}
          <div className="col-span-8 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
                  Year 6 Media Studies
                </div>
                <div className="text-base font-semibold text-zinc-100">
                  Term 2 — Lunchtime News
                </div>
              </div>
              <Badge tone="sky" icon={Users}>24 students</Badge>
            </div>

            {/* project card */}
            <div className="rounded-xl border border-white/[0.06] bg-zinc-900/40 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-lg bg-indigo-500/15 text-indigo-300 grid place-items-center">
                    <FileVideo className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-zinc-100">
                      Episode 4 — Whole-school recap
                    </div>
                    <div className="text-[11px] text-zinc-500">
                      3 students uploaded today · 8 clips
                    </div>
                  </div>
                </div>
                <Badge tone="indigo" icon={Sparkles}>AI draft preparing · 02:14</Badge>
              </div>

              {/* student rows */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { who: "Ava", state: "Uploaded", tone: "emerald" as BadgeTone },
                  { who: "Mia", state: "Uploaded", tone: "emerald" as BadgeTone },
                  { who: "Noah", state: "Uploading 64%", tone: "sky" as BadgeTone },
                ].map((s) => (
                  <div
                    key={s.who}
                    className="rounded-lg border border-white/[0.06] bg-zinc-950/60 p-2.5"
                  >
                    <div className="text-[11px] text-zinc-400 mb-1">{s.who}</div>
                    <Badge tone={s.tone}>{s.state}</Badge>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                <Badge tone="emerald" icon={CheckCircle2}>Highlights detected</Badge>
                <Badge tone="amber" icon={Clock}>Teacher review pending</Badge>
                <Badge tone="zinc">Exporting MP4</Badge>
              </div>
            </div>

            {/* second compact card */}
            <div className="rounded-xl border border-white/[0.06] bg-zinc-900/40 p-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/15 text-emerald-300 grid place-items-center">
                  <Check className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-zinc-100">
                    Documentary — Local Heroes
                  </div>
                  <div className="text-[11px] text-zinc-500">Approved · Ready to share with parents</div>
                </div>
              </div>
              <Badge tone="emerald" icon={CheckCircle2}>Ready for approval</Badge>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  How it works                                                              */
/* -------------------------------------------------------------------------- */

const STEPS = [
  {
    n: "01",
    icon: Upload,
    title: "Students upload from any device",
    body: "Phone, school laptop or classroom camera. One scan, one tap — no accounts to create, no drives to hand around.",
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
    body: "Highlights detected. Captions generated. A first-cut export is ready before the next bell — for the teacher to review, not for the class to see.",
  },
  {
    n: "04",
    icon: ShieldCheck,
    title: "Teacher approves. Safe to close.",
    body: "Nothing leaves the classroom until the teacher signs off. Approved projects export to MP4, share with parents, or hand off to senior students for editing.",
  },
];

function HowItWorks() {
  return (
    <section id="how" className="border-y border-white/[0.06] bg-zinc-950/40">
      <div className="container py-20 md:py-28">
        <div className="max-w-3xl space-y-3 mb-12">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-zinc-100">
            From a phone in the back row to a teacher-approved project.
          </h2>
          <p className="text-base text-zinc-400 leading-relaxed max-w-2xl">
            Offloadr is the layer between students recording and teachers receiving a
            finished project. No drives, no DIY pipelines, no late nights chasing files.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="rounded-2xl border border-white/[0.06] bg-zinc-950/60 p-6 hover:bg-zinc-950 transition-colors"
            >
              <div className="flex items-center justify-between mb-5">
                <div className="h-10 w-10 rounded-xl bg-indigo-500/10 text-indigo-300 grid place-items-center ring-1 ring-indigo-400/20">
                  <s.icon className="h-4 w-4" />
                </div>
                <span className="text-[11px] font-mono text-zinc-600">{s.n}</span>
              </div>
              <div className="text-base font-semibold text-zinc-100 mb-2 tracking-tight">
                {s.title}
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Classroom Hub showcase                                                    */
/* -------------------------------------------------------------------------- */

function HubShowcase() {
  return (
    <section id="hub" className="border-b border-white/[0.06]">
      <div className="container py-20 md:py-28">
        <div className="grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-5 space-y-5">
            <Eyebrow>The Classroom Media Hub</Eyebrow>
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-zinc-100">
              Built around the way classrooms actually work.
            </h2>
            <p className="text-base text-zinc-400 leading-relaxed">
              One hub per class. Every student upload, every AI draft, every approval —
              in one calm dashboard the teacher can open between bells.
            </p>
            <ul className="space-y-3 text-sm text-zinc-300 pt-2">
              {[
                { icon: Users, t: "One workspace per class — Year 6, Year 9, Year 11." },
                { icon: Sparkles, t: "AI prepares the first draft. Teachers approve it." },
                { icon: Lock, t: "Nothing public, nothing shared, until the teacher says so." },
                { icon: Smartphone, t: "Students upload from phones — no accounts, no drives." },
              ].map((row) => (
                <li key={row.t} className="flex items-start gap-3">
                  <row.icon className="h-4 w-4 mt-0.5 text-indigo-300 flex-shrink-0" />
                  <span>{row.t}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-7">
            <ClassroomHubMock />
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Why schools choose Offloadr                                               */
/* -------------------------------------------------------------------------- */

const PILLARS = [
  {
    icon: ShieldCheck,
    title: "Safe for schools by default",
    body:
      "No public links. No student data exposed. Teachers control access at every step, and every upload is tied to a student in a class — never an anonymous file on a drive.",
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

function WhySchools() {
  return (
    <section id="safety" className="border-b border-white/[0.06] bg-zinc-950/40">
      <div className="container py-20 md:py-28">
        <div className="max-w-3xl space-y-3 mb-12">
          <Eyebrow>Why schools choose Offloadr</Eyebrow>
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-zinc-100">
            Modern classroom media, without the modern classroom mess.
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {PILLARS.map((p) => (
            <div
              key={p.title}
              className="rounded-2xl border border-white/[0.06] bg-zinc-950/60 p-7"
            >
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-300 grid place-items-center ring-1 ring-emerald-400/20 mb-5">
                <p.icon className="h-4 w-4" />
              </div>
              <div className="text-lg font-semibold text-zinc-100 tracking-tight mb-2">
                {p.title}
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Who it's for                                                              */
/* -------------------------------------------------------------------------- */

function WhoItsFor() {
  const audiences = [
    { icon: School, t: "Secondary schools with media programs" },
    { icon: GraduationCap, t: "Education media departments" },
    { icon: Users, t: "Student newsrooms & broadcast clubs" },
    { icon: Play, t: "TAFE and tertiary media courses" },
  ];
  return (
    <section className="border-b border-white/[0.06]">
      <div className="container py-20 md:py-24">
        <div className="grid lg:grid-cols-3 gap-10 items-start">
          <div className="space-y-3">
            <Eyebrow>Who it's for</Eyebrow>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-zinc-100">
              Built for schools running real media programs.
            </h2>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Not a podcast tool. Not a consumer app. Classroom media workflow
              infrastructure — designed for teachers, students, and the people
              responsible for what gets published.
            </p>
          </div>
          <div className="lg:col-span-2 grid sm:grid-cols-2 gap-3">
            {audiences.map((a) => (
              <div
                key={a.t}
                className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-zinc-950/60 px-5 py-4 text-sm text-zinc-200"
              >
                <div className="h-9 w-9 rounded-lg bg-white/[0.04] text-zinc-300 grid place-items-center">
                  <a.icon className="h-4 w-4" />
                </div>
                {a.t}
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

const DEMO_HREF =
  "mailto:demo@useoffloadr.com?subject=Offloadr%20school%20demo%20request&body=Hi%20Offloadr%20team%2C%0A%0AI%27d%20like%20to%20book%20a%20demo%20for%20our%20school.%0A%0ASchool%3A%20%0AYear%20levels%20%2F%20program%3A%20%0AStudents%20involved%3A%20%0ABest%20time%20to%20talk%3A%20%0A%0AThanks%2C";

function PilotCTA() {
  return (
    <section id="pilot" className="bg-gradient-to-b from-zinc-950 to-zinc-950/40">
      <div className="container py-24 md:py-32">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <Eyebrow>School pilot — Term 2 / Term 3</Eyebrow>
          <h2 className="text-4xl md:text-6xl font-semibold tracking-tight text-zinc-100 leading-[1.05]">
            Bring Offloadr to your classroom this term.
          </h2>
          <p className="text-base md:text-lg text-zinc-400 leading-relaxed max-w-2xl mx-auto">
            We're onboarding a small cohort of schools running media programs. A short
            demo, a guided setup, and your students can be uploading by the next lesson.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <a
              href={DEMO_HREF}
              className="inline-flex h-12 items-center justify-center rounded-lg bg-white px-7 text-sm font-semibold text-zinc-950 hover:bg-zinc-200 transition-colors"
            >
              Book a School Demo
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
            <a
              href="https://offloadr-pilot.fly.dev/offloadr/login"
              className="inline-flex h-12 items-center justify-center rounded-lg border border-zinc-700 px-7 text-sm font-semibold text-zinc-100 hover:bg-zinc-900 hover:border-zinc-600 transition-colors"
            >
              Log in to Offloadr
            </a>
          </div>
          <div className="pt-2 text-xs text-zinc-500">
            Already in the pilot? Sign in above to open your Classroom Hub.
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Hero                                                                       */
/* -------------------------------------------------------------------------- */

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* ambient background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
      >
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[680px] w-[1100px] rounded-full bg-gradient-to-br from-indigo-500/[0.18] via-sky-500/[0.06] to-transparent blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(99,102,241,0.06),transparent_60%)]" />
      </div>

      <div className="container pt-16 md:pt-24 pb-20 md:pb-28">
        <div className="grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6 space-y-7">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Built for schools
            </span>

            <h1 className="text-5xl md:text-7xl font-semibold tracking-tight text-zinc-100 leading-[0.98]">
              Students record.
              <br />
              <span className="text-zinc-500">Offloadr does the rest.</span>
            </h1>

            <p className="text-lg md:text-xl text-zinc-400 leading-relaxed max-w-xl">
              Classroom media workflow infrastructure. Students upload from any device,
              Offloadr organises every take, and AI prepares a teacher-ready draft
              before the next class.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <a
                href={DEMO_HREF}
                className="inline-flex h-12 items-center justify-center rounded-lg bg-white px-7 text-sm font-semibold text-zinc-950 hover:bg-zinc-200 transition-colors"
              >
                Book a School Demo
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
              <a
                href="https://offloadr-pilot.fly.dev/offloadr/login"
                className="inline-flex h-12 items-center justify-center rounded-lg border border-zinc-700 px-7 text-sm font-semibold text-zinc-100 hover:bg-zinc-900 hover:border-zinc-600 transition-colors"
              >
                Log in to Offloadr
              </a>
            </div>

            <div className="pt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-zinc-500">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                Safe-for-schools by default
              </span>
              <span className="flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-emerald-400" />
                Nothing public until a teacher approves
              </span>
              <span className="flex items-center gap-1.5">
                <Smartphone className="h-3.5 w-3.5 text-emerald-400" />
                Works on the devices students already have
              </span>
            </div>
          </div>

          <div className="lg:col-span-6">
            <ClassroomHubMock />
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
      {/* trust strip */}
      <div className="border-y border-white/[0.06] bg-zinc-950/60">
        <div className="container py-4 text-center text-xs text-zinc-500">
          Now piloting with Australian secondary schools and education media programs.
        </div>
      </div>
      <HowItWorks />
      <HubShowcase />
      <WhySchools />
      <WhoItsFor />
      <PilotCTA />
    </PublicLayout>
  );
}
