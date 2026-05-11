import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container flex h-20 items-center justify-between gap-8">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Offloadr">
            <img
              src={`${import.meta.env.BASE_URL}logo.png`}
              alt="Offloadr"
              className="h-9 w-auto dark:invert"
            />
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#arc" className="hover:text-foreground transition-colors">How it works</a>
            <a href="#editor" className="hover:text-foreground transition-colors">Editor handoff</a>
            <a href="#everything" className="hover:text-foreground transition-colors">What you get</a>
          </nav>

          <div className="flex items-center gap-2">
            <Link href="/login">
              <Button variant="ghost" className="h-10 px-4 text-sm font-medium">
                Log in
              </Button>
            </Link>
            <Link href="/register">
              <Button className="h-10 px-5 text-sm font-semibold shadow-sm">
                Start a project
              </Button>
            </Link>
          </div>
        </div>
      </header>
      <main className="flex-1">
        {children}
      </main>
      <footer className="border-t py-12 bg-muted/30">
        <div className="container text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Offloadr. The layer between the session ending and the project being editable.
        </div>
      </footer>
    </div>
  );
}
