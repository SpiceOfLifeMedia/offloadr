import { useState, type FormEvent } from "react";
import { useLocation, useRoute } from "wouter";
import { Loader2, AlertTriangle, Lock } from "lucide-react";
import PortalLogo from "@/components/student-portal/portal-logo";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function StudentPortalLogin() {
  const [, navigate] = useLocation();
  // Canonical /s/:school/login or /s/:school — the school context is
  // invisible to the student; the URL the teacher shared resolves it.
  const [matchedS1, sParams1] = useRoute<{ school: string }>(
    "/s/:school/login",
  );
  const [matchedS2, sParams2] = useRoute<{ school: string }>("/s/:school");
  // Legacy /student-login/:orgSlug — keep working so old links don't break.
  const [matchedLegacy, legacyParams] = useRoute<{ orgSlug: string }>(
    "/student-login/:orgSlug",
  );
  // Guarded decode — malformed percent-encoded values would otherwise
  // throw URIError during render and crash the login page.
  const urlOrgSlug = (() => {
    const raw = matchedS1
      ? sParams1?.school
      : matchedS2
        ? sParams2?.school
        : matchedLegacy
          ? legacyParams?.orgSlug
          : "";
    if (!raw) return "";
    try {
      return decodeURIComponent(raw).toLowerCase();
    } catch {
      return raw.toLowerCase();
    }
  })();

  const [orgSlug, setOrgSlug] = useState(urlOrgSlug);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const effectiveOrg = (urlOrgSlug || orgSlug).trim().toLowerCase();
    if (!effectiveOrg) {
      setError(
        "Your school code is missing. Ask your teacher for the link they shared.",
      );
      return;
    }
    if (!username.trim() || !password) {
      setError("Username and password are required.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/student/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          organizationSlug: effectiveOrg,
          username: username.trim().toLowerCase(),
          password,
        }),
      });
      if (res.status === 404) {
        setError(
          "Student accounts are not enabled in this environment. (Expected on production until Stage 3.)",
        );
        return;
      }
      if (!res.ok) {
        let message = "Login failed. Check your username and password.";
        try {
          const body = (await res.json()) as { message?: string };
          if (body?.message) message = body.message;
        } catch {
          /* swallow */
        }
        if (res.status === 429) {
          message = "Too many attempts. Wait a minute and try again.";
        }
        setError(message);
        return;
      }
      navigate("/student-projects");
    } catch (err) {
      setError(
        err instanceof Error
          ? `Network error: ${err.message}`
          : "Network error.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="portal-bg relative flex min-h-screen flex-col text-zinc-100">
      <header className="relative z-10 border-b border-white/5 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center justify-center px-4 py-4">
          <PortalLogo />
        </div>
      </header>

      <div className="relative z-10 border-b border-amber-300/30 bg-amber-400/[0.10] px-4 py-2 text-center text-xs tracking-wide text-amber-100">
        <span className="font-semibold uppercase tracking-wider text-amber-200">
          Test Environment
        </span>{" "}
        <span className="text-amber-200/70">·</span>{" "}
        <span className="text-amber-100/90">
          internal pilot rehearsal only
        </span>
      </div>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-12 sm:py-16">
        <div className="w-full max-w-md">
          <div className="mb-7 text-center">
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-[2rem]">
              Student <span className="brand-gradient-text">Login</span>
            </h1>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-zinc-400">
              Log in to upload media to your class projects safely and
              securely.
            </p>
          </div>

          <div className="portal-glass relative rounded-2xl p-6 sm:p-7">
            <form onSubmit={onSubmit} className="space-y-5">
              {!urlOrgSlug && (
                <div className="space-y-1.5">
                  <label
                    htmlFor="orgSlug"
                    className="block text-xs font-medium uppercase tracking-wider text-zinc-400"
                  >
                    School code
                  </label>
                  <input
                    id="orgSlug"
                    value={orgSlug}
                    onChange={(e) => setOrgSlug(e.target.value)}
                    placeholder="your-school"
                    autoComplete="organization"
                    disabled={submitting}
                    className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none transition focus:border-[rgb(var(--brand-indigo))]/60 focus:bg-black/40 focus:ring-2 focus:ring-[rgb(var(--brand-indigo))]/25 disabled:opacity-60"
                  />
                  <p className="text-[11px] text-zinc-500">
                    Your teacher will normally share a direct link so this
                    field is filled in for you.
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <label
                  htmlFor="username"
                  className="block text-xs font-medium uppercase tracking-wider text-zinc-400"
                >
                  Username
                </label>
                <input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="sam.leverenz"
                  autoComplete="username"
                  disabled={submitting}
                  className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none transition focus:border-[rgb(var(--brand-indigo))]/60 focus:bg-black/40 focus:ring-2 focus:ring-[rgb(var(--brand-indigo))]/25 disabled:opacity-60"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="password"
                  className="block text-xs font-medium uppercase tracking-wider text-zinc-400"
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={submitting}
                  className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none transition focus:border-[rgb(var(--brand-indigo))]/60 focus:bg-black/40 focus:ring-2 focus:ring-[rgb(var(--brand-indigo))]/25 disabled:opacity-60"
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="portal-cta inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  <>Log In</>
                )}
              </button>

              <div className="flex items-center justify-center gap-1.5 pt-1 text-[11px] text-zinc-500">
                <Lock className="h-3 w-3" />
                <span>
                  Encrypted in transit · sessions expire automatically
                </span>
              </div>
            </form>
          </div>

          <p className="mt-6 text-center text-xs leading-relaxed text-zinc-400">
            Need help? Ask your teacher for your Offloadr login details.
          </p>

          <p className="mt-3 text-center text-[11px] text-zinc-500">
            No account?{" "}
            <button
              className="text-[rgb(var(--brand-violet-light))] underline-offset-2 transition hover:text-white hover:underline"
              onClick={() => navigate("/student-upload")}
            >
              Use an upload code instead
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}
