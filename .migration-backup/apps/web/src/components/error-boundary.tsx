import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * Minimal error boundary. Without this, any thrown render-time error
 * unmounts the whole React tree and the user sees a blank (often
 * black, against the dark theme) page with no clue what went wrong.
 *
 * Catches the error, logs it to the console with a clear prefix so
 * support can find it fast, and shows a human-readable card with the
 * message and a reload button.
 */
interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error("[Offloadr ErrorBoundary] Render crashed:", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground">
        <div className="max-w-lg w-full rounded-lg border border-destructive/40 bg-destructive/5 p-6 space-y-4">
          <h1 className="text-lg font-semibold text-destructive">Something went wrong on this page</h1>
          <p className="text-sm text-muted-foreground">
            The page crashed before it could render. Reloading often fixes it. If
            it keeps happening, send the message below to support so we can
            fix the root cause.
          </p>
          <pre className="text-xs whitespace-pre-wrap break-words rounded bg-muted p-3 max-h-48 overflow-auto">
            {this.state.error.message}
          </pre>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Reload page
            </button>
            <a
              href={import.meta.env.BASE_URL + "dashboard"}
              className="rounded border px-3 py-1.5 text-sm font-medium hover:bg-accent"
            >
              Back to dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }
}
