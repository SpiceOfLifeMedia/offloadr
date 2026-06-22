import { useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { Loader2, ArrowRight, AlertTriangle, KeyRound } from "lucide-react";
import PortalLogo from "@/components/student-portal/portal-logo";

const CODE_ALPHABET = /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]+$/i;

/**
 * Quick Upload Mode — the no-account fallback. Same visual system as the
 * student portal so the brand is consistent across both flows.
 */
export default function StudentUpload() {
  const [, setLocation] = useLocation();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const normalized = code.trim().toUpperCase().replace(/[\s-]/g, "");
    if (normalized.length < 4 || normalized.length > 16) {
      setError("That code doesn't look right — check with your teacher.");
      return;
    }
    if (!CODE_ALPHABET.test(normalized)) {
      setError(
        "Codes only use letters and numbers. Double-check what your teacher gave you.",
      );
      return;
    }
    setSubmitting(true);
    setLocation(`/student-upload/${normalized}`);
  };

  return (
    <div className="portal-bg relative flex min-h-screen flex-col text-zinc-100">
      <header className="relative z-10 border-b border-white/5 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center justify-center px-4 py-4">
          <PortalLogo />
        </div>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-12 sm:py-16">
        <div className="w-full max-w-md">
          <div className="mb-7 text-center">
            <div className="brand-eyebrow mb-2 inline-flex text-[11px] uppercase tracking-[0.18em] text-[rgb(var(--brand-violet-light))]/90">
              Quick Upload Mode
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-[1.75rem]">
              Enter your{" "}
              <span className="brand-gradient-text">upload code</span>
            </h1>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-zinc-400">
              No account needed — paste the code your teacher gave you to
              upload audio, video, photos, or documents into your class
              project.
            </p>
          </div>

          <div className="portal-glass relative rounded-2xl p-6 sm:p-7">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label
                  htmlFor="code"
                  className="block text-xs font-medium uppercase tracking-wider text-zinc-400"
                >
                  Upload code
                </label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <input
                    id="code"
                    data-testid="input-student-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="K7M2QP"
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    maxLength={16}
                    className="w-full rounded-md border border-white/10 bg-black/30 py-3.5 pl-10 pr-3 text-center font-mono text-2xl tracking-[0.4em] uppercase text-white placeholder-zinc-700 outline-none transition focus:border-[rgb(var(--brand-indigo))]/60 focus:bg-black/40 focus:ring-2 focus:ring-[rgb(var(--brand-indigo))]/25 disabled:opacity-60"
                    disabled={submitting}
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                data-testid="button-student-code-continue"
                disabled={submitting || code.trim().length === 0}
                className="portal-cta inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Continuing…
                  </>
                ) : (
                  <>
                    Continue <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>

              <p className="pt-4 text-center text-xs leading-relaxed text-zinc-500">
                You don't need an account. Only your name and the files you
                pick will be sent to your teacher's review queue.
              </p>
            </form>
          </div>

          <p className="mt-6 text-center text-xs leading-relaxed text-zinc-400">
            Have a username and password?{" "}
            <button
              className="text-[rgb(var(--brand-violet-light))] underline-offset-2 transition hover:text-white hover:underline"
              onClick={() => setLocation("/student-login")}
            >
              Student Login
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}
