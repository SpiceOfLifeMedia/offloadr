import { useLocation } from "wouter";
import { LogOut } from "lucide-react";
import PortalLogo from "./portal-logo";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Props {
  children: React.ReactNode;
  hideSignOut?: boolean;
}

/**
 * Shared chrome for /student-* pages.
 *
 * Visual contract (deliberately disciplined — see redesign brief 2026-05-24):
 *   - portal-bg = 2-layer cinematic background (deep navy + indigo/violet
 *     blooms + faint masked grid). No particles, no animated streaks.
 *   - Logo = colored bars icon + white "Offloadr" typeset wordmark.
 *   - Persistent TEST banner — internal pilot rehearsal only.
 *   - Sign-out lives in the header, ghost-styled so it doesn't compete with
 *     primary actions.
 */
export default function StudentPortalShell({ children, hideSignOut }: Props) {
  const [, navigate] = useLocation();

  const onLogout = async () => {
    try {
      await fetch(`${API_BASE}/api/student/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      /* ignore */
    }
    navigate("/student-login");
  };

  return (
    <div className="portal-bg min-h-screen text-zinc-100">
      <header className="relative z-10 border-b border-white/5 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <PortalLogo />
          {!hideSignOut && (
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-400 transition hover:bg-white/5 hover:text-white"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          )}
        </div>
      </header>

      {/* Subtle pilot-mode strip. Deliberately low-contrast so it reads as
          informational metadata, not a developer caution-tape banner. Kept
          legible (not a hidden footnote) because the warning IS real, but
          school-facing — no yellow, no uppercase shouting. */}
      <div className="relative z-10 border-b border-white/5 bg-white/[0.02] px-4 py-1.5 text-center text-[11px] tracking-wide text-zinc-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-300/70" />
          <span className="text-zinc-300">Pilot environment</span>
          <span className="text-zinc-600">·</span>
          <span className="text-zinc-500">internal rehearsal — do not upload real student work</span>
        </span>
      </div>

      <main className="relative z-10 px-4 py-10 sm:px-6 sm:py-14">
        {children}
      </main>
    </div>
  );
}
