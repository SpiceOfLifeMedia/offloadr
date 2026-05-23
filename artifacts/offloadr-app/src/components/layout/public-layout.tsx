import { Link } from "wouter";

export function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="border-b border-white/[0.06] bg-zinc-950/80 backdrop-blur-xl supports-[backdrop-filter]:bg-zinc-950/60 sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between gap-8">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Offloadr">
            <img
              src={`${import.meta.env.BASE_URL}logo.png`}
              alt="Offloadr"
              className="h-7 w-auto brightness-0 invert"
            />
            <span className="hidden sm:inline text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
              for schools
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm text-zinc-400">
            <a href="#how" className="hover:text-zinc-100 transition-colors">How it works</a>
            <a href="#hub" className="hover:text-zinc-100 transition-colors">Classroom Hub</a>
            <a href="#safety" className="hover:text-zinc-100 transition-colors">Built for schools</a>
            <a href="#pilot" className="hover:text-zinc-100 transition-colors">Pilot</a>
          </nav>

          <div className="flex items-center gap-3">
            <a
              href="https://offloadr-pilot.fly.dev/offloadr/login"
              className="hidden sm:inline-flex h-9 items-center rounded-md border border-zinc-700 px-4 text-sm font-semibold text-zinc-100 hover:bg-zinc-900 hover:border-zinc-600 transition-colors"
            >
              Log in to Offloadr
            </a>
            <a
              href="mailto:demo@useoffloadr.com?subject=Offloadr%20school%20demo%20request&body=Hi%20Offloadr%20team%2C%0A%0AI%27d%20like%20to%20book%20a%20demo%20for%20our%20school.%0A%0ASchool%3A%20%0AYear%20levels%20%2F%20program%3A%20%0AStudents%20involved%3A%20%0ABest%20time%20to%20talk%3A%20%0A%0AThanks%2C"
              className="inline-flex h-9 items-center rounded-md bg-white px-4 text-sm font-semibold text-zinc-950 hover:bg-zinc-200 transition-colors"
            >
              Book a School Demo
            </a>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-white/[0.06] py-10">
        <div className="container text-center text-xs text-zinc-500">
          &copy; {new Date().getFullYear()} Offloadr. Classroom media workflow infrastructure for schools.
        </div>
      </footer>
    </div>
  );
}
