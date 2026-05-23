import { Link } from "wouter";

export function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="border-b border-border/60 bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/65 sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between gap-8">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Offloadr">
            <img
              src={`${import.meta.env.BASE_URL}logo.png`}
              alt="Offloadr"
              className="h-7 w-auto brightness-0 invert"
            />
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm text-zinc-400">
            <a href="#problem" className="hover:text-zinc-100 transition-colors">The problem</a>
            <a href="#workflow" className="hover:text-zinc-100 transition-colors">Workflow</a>
            <a href="#producer" className="hover:text-zinc-100 transition-colors">Producer Mode</a>
            <a href="#handoff" className="hover:text-zinc-100 transition-colors">Editor handoff</a>
          </nav>

          <div className="flex items-center gap-3">
            <a
              href="https://offloadr-pilot.fly.dev/offloadr/login"
              className="hidden sm:inline-flex h-9 items-center rounded-md border border-zinc-700 px-4 text-sm font-semibold text-zinc-100 hover:bg-zinc-900 hover:border-zinc-600 transition-colors"
            >
              Log in
            </a>
            <a
              href="#beta"
              className="inline-flex h-9 items-center rounded-md bg-white px-4 text-sm font-semibold text-zinc-950 hover:bg-zinc-200 transition-colors"
            >
              Join the Beta
            </a>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border/60 py-10">
        <div className="container text-center text-xs text-zinc-500">
          &copy; {new Date().getFullYear()} Offloadr. The layer between recording ending and editing beginning.
        </div>
      </footer>
    </div>
  );
}
