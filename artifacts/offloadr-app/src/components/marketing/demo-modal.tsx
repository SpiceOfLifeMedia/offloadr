import { useCallback, useEffect, useRef, useState } from "react";
import { X, Check, Loader2, AlertCircle, Mail } from "lucide-react";

const OPEN_EVENT = "offloadr:open-demo";
const FALLBACK_EMAIL = "demo@useoffloadr.com";

function buildMailtoFallback(form: FormState): string {
  const subject = `Offloadr school demo request — ${form.school || "(school)"}`;
  const body = [
    `Hi Offloadr team,`,
    ``,
    `Name:                  ${form.fullName}`,
    `School / organisation: ${form.school}`,
    `Role:                  ${form.role}`,
    `State:                 ${form.state}`,
    `Student count:         ${form.studentCount}`,
    `Email:                 ${form.email}`,
    form.phone ? `Phone:                 ${form.phone}` : "",
    ``,
    `Current media workflow:`,
    form.workflow,
    ``,
    `Thanks,`,
  ]
    .filter(Boolean)
    .join("\n");
  return `mailto:${FALLBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function openDemoModal() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OPEN_EVENT));
}

const ROLE_OPTIONS = [
  "Teacher",
  "Head of Media / Arts",
  "IT Lead",
  "Principal or Deputy",
  "Other",
];

const STUDENT_COUNT_OPTIONS = [
  "Under 50",
  "50 – 200",
  "200 – 500",
  "500 – 1,000",
  "1,000+",
];

const STATE_OPTIONS = [
  "NSW",
  "VIC",
  "QLD",
  "WA",
  "SA",
  "TAS",
  "ACT",
  "NT",
  "International / Outside AU",
];

type Status = "idle" | "submitting" | "success" | "error" | "unavailable";

type FormState = {
  fullName: string;
  school: string;
  role: string;
  studentCount: string;
  state: string;
  workflow: string;
  email: string;
  phone: string;
  company: string; // honeypot
};

const EMPTY: FormState = {
  fullName: "",
  school: "",
  role: "",
  studentCount: "",
  state: "",
  workflow: "",
  email: "",
  phone: "",
  company: "",
};

function isValidEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

function validate(form: FormState): Partial<Record<keyof FormState, string>> {
  const errors: Partial<Record<keyof FormState, string>> = {};
  if (!form.fullName.trim()) errors.fullName = "Required";
  if (!form.school.trim()) errors.school = "Required";
  if (!form.role) errors.role = "Required";
  if (!form.studentCount) errors.studentCount = "Required";
  if (!form.state) errors.state = "Required";
  if (form.workflow.trim().length < 5)
    errors.workflow = "A short sentence helps us prepare the demo";
  if (!isValidEmail(form.email)) errors.email = "Enter a valid email";
  return errors;
}

export function DemoModal() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  // Open via global event
  useEffect(() => {
    const handler = () => {
      triggerRef.current = (document.activeElement as HTMLElement) || null;
      setOpen(true);
    };
    window.addEventListener(OPEN_EVENT, handler);
    return () => window.removeEventListener(OPEN_EVENT, handler);
  }, []);

  // Reset on close
  useEffect(() => {
    if (open) return undefined;
    const t = setTimeout(() => {
      setStatus("idle");
      setForm(EMPTY);
      setErrors({});
      setErrorMsg(null);
    }, 200);
    return () => clearTimeout(t);
  }, [open]);

  // Body scroll lock + focus management + ESC
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimer = setTimeout(() => {
      firstFieldRef.current?.focus();
    }, 50);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = prev;
      clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKey);
      triggerRef.current?.focus?.();
    };
  }, [open]);

  const update = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((f) => ({ ...f, [key]: value }));
      setErrors((e) => {
        if (!e[key]) return e;
        const { [key]: _omit, ...rest } = e;
        return rest;
      });
    },
    [],
  );

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "submitting") return;
    setErrorMsg(null);

    const v = validate(form);
    if (Object.keys(v).length > 0) {
      setErrors(v);
      return;
    }

    setStatus("submitting");
    try {
      const res = await fetch("/api/offloadr-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        // 5xx / 503 — function unavailable. Offer mailto fallback so the
        // user is never dead-ended.
        if (res.status >= 500) {
          setStatus("unavailable");
          return;
        }
        const data = await res.json().catch(() => ({}) as Record<string, unknown>);
        const msg =
          typeof data?.error === "string"
            ? (data.error as string)
            : "We couldn't send your request. Please try again shortly.";
        setErrorMsg(msg);
        setStatus("error");
        return;
      }
      setStatus("success");
    } catch {
      setStatus("unavailable");
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-modal-title"
      className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-6 sm:py-10 animate-[fadeIn_180ms_ease-out]"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div
        aria-hidden
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />

      <div className="relative w-full max-w-lg max-h-[calc(100vh-3rem)] overflow-y-auto rounded-2xl border border-white/[0.08] bg-zinc-950 shadow-[0_30px_120px_-20px_rgba(0,0,0,0.9)] animate-[slideUp_220ms_cubic-bezier(0.22,1,0.36,1)]">
        <button
          ref={closeBtnRef}
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="absolute right-4 top-4 h-8 w-8 grid place-items-center rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.05] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50"
        >
          <X className="h-4 w-4" />
        </button>

        {status === "success" ? (
          <SuccessPanel onClose={() => setOpen(false)} />
        ) : status === "unavailable" ? (
          <UnavailablePanel
            mailtoHref={buildMailtoFallback(form)}
            onClose={() => setOpen(false)}
          />
        ) : (
          <form onSubmit={onSubmit} className="p-7 sm:p-9 space-y-6" noValidate>
            <header className="space-y-2 pr-8">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
                Book a school demo
              </div>
              <h2
                id="demo-modal-title"
                className="text-2xl font-semibold text-zinc-50 tracking-tight leading-snug"
              >
                Tell us about your school. We'll organise a walkthrough.
              </h2>
              <p className="text-sm text-zinc-400 leading-relaxed">
                A short demo, an honest answer on whether Offloadr fits, and a
                guided setup if it does. No sales call.
              </p>
            </header>

            {/* Honeypot — hidden from real users and screen readers */}
            <div aria-hidden className="hidden">
              <label>
                Company
                <input
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={form.company}
                  onChange={(e) => update("company", e.target.value)}
                />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field
                label="Full name"
                error={errors.fullName}
                input={
                  <input
                    ref={firstFieldRef}
                    type="text"
                    autoComplete="name"
                    value={form.fullName}
                    onChange={(e) => update("fullName", e.target.value)}
                    className={inputCls(!!errors.fullName)}
                  />
                }
              />
              <Field
                label="School or organisation"
                error={errors.school}
                input={
                  <input
                    type="text"
                    autoComplete="organization"
                    value={form.school}
                    onChange={(e) => update("school", e.target.value)}
                    className={inputCls(!!errors.school)}
                  />
                }
              />
              <Field
                label="Your role"
                error={errors.role}
                input={
                  <Select
                    value={form.role}
                    onChange={(v) => update("role", v)}
                    options={ROLE_OPTIONS}
                    placeholder="Select role"
                    invalid={!!errors.role}
                  />
                }
              />
              <Field
                label="Approx. student count"
                error={errors.studentCount}
                input={
                  <Select
                    value={form.studentCount}
                    onChange={(v) => update("studentCount", v)}
                    options={STUDENT_COUNT_OPTIONS}
                    placeholder="Select range"
                    invalid={!!errors.studentCount}
                  />
                }
              />
              <Field
                label="State"
                error={errors.state}
                input={
                  <Select
                    value={form.state}
                    onChange={(v) => update("state", v)}
                    options={STATE_OPTIONS}
                    placeholder="Select state"
                    invalid={!!errors.state}
                  />
                }
              />
              <Field
                label="Email"
                error={errors.email}
                input={
                  <input
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                    className={inputCls(!!errors.email)}
                  />
                }
              />
            </div>

            <Field
              label="Current media workflow"
              hint="A sentence is plenty — e.g. 'Year 7–10 record on iPads, teachers edit on iMovie at home.'"
              error={errors.workflow}
              input={
                <textarea
                  value={form.workflow}
                  onChange={(e) => update("workflow", e.target.value)}
                  rows={3}
                  className={inputCls(!!errors.workflow) + " resize-none"}
                />
              }
            />

            <Field
              label="Phone"
              optional
              error={errors.phone}
              input={
                <input
                  type="tel"
                  autoComplete="tel"
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  className={inputCls(false)}
                />
              }
            />

            {errorMsg && (
              <div className="flex items-start gap-2.5 rounded-lg border border-rose-500/20 bg-rose-500/5 px-3.5 py-2.5 text-sm text-rose-200">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-11 px-5 rounded-lg border border-zinc-800 text-sm font-semibold text-zinc-300 hover:bg-zinc-900 hover:border-zinc-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={status === "submitting"}
                className="h-11 px-6 rounded-lg bg-white text-sm font-semibold text-zinc-950 hover:bg-zinc-200 disabled:opacity-60 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50 inline-flex items-center justify-center gap-2"
              >
                {status === "submitting" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  "Request demo"
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(8px) scale(0.985) } to { opacity: 1; transform: translateY(0) scale(1) } }
      `}</style>
    </div>
  );
}

function UnavailablePanel({
  mailtoHref,
  onClose,
}: {
  mailtoHref: string;
  onClose: () => void;
}) {
  return (
    <div className="p-9 sm:p-11 space-y-6">
      <div className="space-y-2.5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
          Demo request
        </div>
        <h3 className="text-xl font-semibold text-zinc-50 tracking-tight">
          Our demo form is temporarily offline.
        </h3>
        <p className="text-sm text-zinc-300 leading-relaxed">
          Send the details you just entered straight to our team — opens in
          your email app, pre-filled. We'll come back to you the same way.
        </p>
      </div>

      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="h-11 px-5 rounded-lg border border-zinc-800 text-sm font-semibold text-zinc-300 hover:bg-zinc-900 hover:border-zinc-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50"
        >
          Cancel
        </button>
        <a
          href={mailtoHref}
          className="h-11 px-6 rounded-lg bg-white text-sm font-semibold text-zinc-950 hover:bg-zinc-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50 inline-flex items-center justify-center gap-2"
        >
          <Mail className="h-4 w-4" />
          Email demo@useoffloadr.com
        </a>
      </div>
    </div>
  );
}

function SuccessPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="p-9 sm:p-12 text-center space-y-6">
      <div className="mx-auto h-14 w-14 rounded-full bg-emerald-500/10 ring-1 ring-emerald-400/30 grid place-items-center">
        <Check className="h-6 w-6 text-emerald-300" />
      </div>
      <div className="space-y-2.5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-300">
          Request received
        </div>
        <h3 className="text-xl font-semibold text-zinc-50 tracking-tight">
          Thanks.
        </h3>
        <p className="text-sm text-zinc-300 leading-relaxed max-w-sm mx-auto">
          We'll contact you shortly to organise an Offloadr school walkthrough.
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="h-11 px-6 rounded-lg border border-zinc-800 text-sm font-semibold text-zinc-200 hover:bg-zinc-900 hover:border-zinc-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50"
      >
        Close
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Field primitives                                                           */
/* -------------------------------------------------------------------------- */

function inputCls(invalid: boolean) {
  return [
    "w-full rounded-lg bg-zinc-900/60 border px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500",
    "transition-colors focus:outline-none focus-visible:outline-none",
    invalid
      ? "border-rose-500/40 focus:border-rose-400 focus:ring-2 focus:ring-rose-500/20"
      : "border-zinc-800 focus:border-zinc-600 focus:ring-2 focus:ring-indigo-400/20",
  ].join(" ");
}

function Field({
  label,
  error,
  hint,
  optional,
  input,
}: {
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  input: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-medium text-zinc-300">{label}</span>
        {optional && (
          <span className="text-[11px] text-zinc-500">Optional</span>
        )}
      </div>
      {input}
      {hint && !error && (
        <div className="text-[11px] text-zinc-500 leading-relaxed">{hint}</div>
      )}
      {error && (
        <div className="text-[11px] text-rose-300 font-medium">{error}</div>
      )}
    </label>
  );
}

function Select({
  value,
  onChange,
  options,
  placeholder,
  invalid,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
  invalid: boolean;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls(invalid) + " appearance-none pr-9 cursor-pointer"}
      >
        <option value="" disabled className="text-zinc-500 bg-zinc-950">
          {placeholder}
        </option>
        {options.map((o) => (
          <option key={o} value={o} className="bg-zinc-950 text-zinc-100">
            {o}
          </option>
        ))}
      </select>
      <svg
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  );
}
