import { useEffect, useState } from "react";
import { X, AlertTriangle } from "lucide-react";

const STORAGE_KEY = "offloadr-pilot-banner-dismissed-v1";

/**
 * Pilot disclaimer banner. Shown above the main app shell on first load
 * for every user, dismissible per-browser via localStorage. Bumping the
 * version suffix in STORAGE_KEY re-shows the banner to everyone.
 *
 * Wording is intentionally clear: this is a CONTROLLED PILOT, not a
 * department-wide rollout, and not a compliance-certified production
 * platform. Schools using it during the pilot need to understand they are
 * an early tester, not a paying customer with SLAs.
 */
export function PilotBanner() {
  const [dismissed, setDismissed] = useState<boolean>(true);

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      // localStorage unavailable (private mode, etc.) — show the banner.
      setDismissed(false);
    }
  }, []);

  if (dismissed) return null;

  const handleDismiss = (): void => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore — at worst the banner re-shows next reload.
    }
    setDismissed(true);
  };

  return (
    <div className="border-b border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
      <div className="mx-auto flex max-w-screen-2xl items-start gap-3 px-4 py-2 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div className="flex-1 leading-snug">
          <span className="font-semibold">Controlled pilot.</span>{" "}
          Offloadr is in a controlled trial with a small number of schools. It is{" "}
          <span className="font-semibold">not</span> yet a department-wide rollout, and{" "}
          <span className="font-semibold">not</span> a compliance-certified production platform.
          Treat any data you upload as testing data — keep your own copies of anything important.
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss pilot disclaimer"
          className="shrink-0 rounded p-1 hover:bg-amber-100 dark:hover:bg-amber-900"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
