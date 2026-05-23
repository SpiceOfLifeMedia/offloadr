import { Link, useLocation } from "wouter";
import { DemoModal, openDemoModal } from "@/components/marketing/demo-modal";

const NAV = [
  { label: "How It Works", anchor: "#how" },
  { label: "For Schools", anchor: "#for-schools" },
  { label: "Classroom Workflow", anchor: "#workflow" },
  { label: "AI Editing", anchor: "#ai" },
  { label: "Security", anchor: "#security" },
];

export function PublicLayout({ children }: { children: React.ReactNode }) {
  const [pathname] = useLocation();
  const onHome = pathname === "/" || pathname === "";
  const navHref = (anchor: string) => (onHome ? anchor : `/${anchor}`);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground relative overflow-x-hidden">
      {/* Subtle dot grid — fixed behind everything, ~3% opacity. */}
      <div aria-hidden className="brand-dot-grid" />

      {/* Ambient brand orbs — two only, static, ~5% opacity. Top of page only;
          absolute (not fixed) so they fade out naturally on scroll. */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 left-0 -translate-x-1/3 -translate-y-1/3 w-[640px] h-[640px] rounded-full z-0"
        style={{
          background:
            "radial-gradient(circle, rgba(0,128,255,0.05) 0%, rgba(0,128,255,0) 70%)",
          filter: "blur(40px)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 right-0 translate-x-1/3 -translate-y-1/3 w-[640px] h-[640px] rounded-full z-0"
        style={{
          background:
            "radial-gradient(circle, rgba(124,58,237,0.05) 0%, rgba(124,58,237,0) 70%)",
          filter: "blur(40px)",
        }}
      />

      <header className="border-b border-white/[0.06] bg-zinc-950/80 backdrop-blur-md supports-[backdrop-filter]:bg-zinc-950/65 sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between gap-8">
          <Link href="/" className="flex items-center gap-2.5 group" aria-label="Offloadr">
            <img
              src={`${import.meta.env.BASE_URL}logo.png`}
              alt="Offloadr"
              className="h-7 w-auto brightness-0 invert"
            />
            <span className="hidden sm:inline text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500 group-hover:text-zinc-400 transition-colors">
              for schools
            </span>
          </Link>

          <nav className="hidden lg:flex items-center gap-7 text-[13px] text-zinc-400">
            {NAV.map((n) => (
              <a
                key={n.label}
                href={navHref(n.anchor)}
                className="hover:text-zinc-100 transition-colors focus-visible:outline-none focus-visible:text-zinc-100"
              >
                {n.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <a
              href="https://offloadr-pilot.fly.dev/offloadr/login"
              className="hidden sm:inline-flex h-9 items-center rounded-md border border-zinc-700 px-4 text-[13px] font-semibold text-zinc-100 hover:bg-zinc-900 hover:border-zinc-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/40"
            >
              Log in
            </a>
            <button
              type="button"
              onClick={openDemoModal}
              className="inline-flex h-9 items-center rounded-md bg-white px-4 text-[13px] font-semibold text-zinc-950 hover:bg-zinc-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/40"
            >
              Book Demo
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-white/[0.06] py-12">
        <div className="container">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-center gap-3">
              <img
                src={`${import.meta.env.BASE_URL}logo.png`}
                alt="Offloadr"
                className="h-6 w-auto brightness-0 invert"
              />
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                for schools
              </span>
            </div>
            <div className="text-xs text-zinc-500">
              School media workflow infrastructure. Built in Australia.
            </div>
            <div className="text-xs text-zinc-500">
              &copy; {new Date().getFullYear()} Offloadr
            </div>
          </div>
        </div>
      </footer>
      <DemoModal />
    </div>
  );
}
