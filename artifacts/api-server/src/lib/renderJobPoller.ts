/**
 * Server-side background poller for in-flight render jobs.
 *
 * Why this exists: render completion previously depended entirely on
 * the teacher's browser polling /render-jobs/:jobId/refresh. If the
 * teacher closed the tab before Shotstack finished, the job sat at
 * `submitted` forever, the MP4 never mirrored to R2, and the
 * notification email never fired.
 *
 * This poller runs on the API server, scheduled the moment a render
 * job is created. It calls the same `runRenderJobRefresh(jobId)`
 * pipeline the HTTP route uses, so all the existing idempotency
 * guarantees (atomic mirror claim, atomic _notifiedAt claim) carry
 * over unchanged. Multiple concurrent triggers (frontend refresh,
 * webhook, this poller) are safe — they race to claim and only one
 * wins per side-effect.
 *
 * Cross-instance dedupe: not needed for the current Fly config
 * (min_machines_running=0, single primary). If we ever scale out,
 * every poll just becomes an extra Shotstack GET — the DB-level
 * atomic claims in renderMirror and maybeNotifyRenderComplete
 * already prevent duplicate mirrors / duplicate emails.
 *
 * Resumption on boot: `resumeRenderJobPollsOnBoot()` queries the DB
 * for any non-terminal jobs and re-schedules them. This covers
 * crashes, deploys, and Fly auto-stop/auto-start cycles.
 */

import { db, renderJobsTable } from "@workspace/db";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { logger } from "./logger";

/**
 * Callback signature: receives a job id, runs the same refresh
 * pipeline the HTTP route does, returns the updated status string
 * (or "missing" if the job vanished).
 *
 * Injected from routes/render-jobs.ts to avoid a circular import.
 */
export type RunRefreshFn = (jobId: number) => Promise<{ status: string } | null>;

let runRefresh: RunRefreshFn | null = null;

/**
 * Wire the refresh function once at startup. Called from
 * routes/render-jobs.ts so this module doesn't need to import
 * routes (which would be a cycle).
 */
export function registerRenderJobRefresher(fn: RunRefreshFn): void {
  runRefresh = fn;
}

/** Terminal job statuses — once a job reaches one, stop polling. */
const TERMINAL_STATUSES = new Set(["complete", "failed", "not_configured"]);

/** Non-terminal statuses that warrant a background poll. */
const IN_FLIGHT_STATUSES = ["submitted", "queued", "processing"] as const;

/**
 * Polling schedule. Most Shotstack renders for a single-clip school
 * news report finish in 25-90s. We poll fast at first, then back off.
 *
 *   t = 10s, 20s, 30s, 45s, 60s, 90s, 120s, 180s, 240s, 360s, 540s, 900s
 *
 * Beyond ~15 minutes we give up — a real failure would have surfaced
 * by then, and Shotstack itself times renders out around that mark.
 */
const POLL_DELAYS_MS = [
  10_000, 10_000, 10_000, 15_000, 15_000, 30_000, 30_000, 60_000, 60_000, 120_000, 180_000, 360_000,
];

const MAX_POLL_DURATION_MS = 15 * 60_000;

interface ActivePoll {
  jobId: number;
  startedAt: number;
  attempt: number;
  timer: NodeJS.Timeout;
}

const active = new Map<number, ActivePoll>();

/**
 * Schedule (or re-arm) a background poll for one render job. Safe to
 * call multiple times for the same job — the existing schedule is
 * cancelled and replaced so we never have two timers racing for the
 * same job in this process.
 *
 * Caller should invoke this immediately after inserting a new
 * render_jobs row with a non-terminal status. Returns silently if the
 * job is already terminal — no point polling.
 */
export function scheduleRenderJobPoll(jobId: number, opts?: { initialDelayMs?: number }): void {
  if (!Number.isFinite(jobId) || jobId <= 0) return;
  const existing = active.get(jobId);
  if (existing) clearTimeout(existing.timer);

  const initialDelay = opts?.initialDelayMs ?? POLL_DELAYS_MS[0]!;
  const startedAt = Date.now();
  scheduleNext(jobId, startedAt, 0, initialDelay);
}

function scheduleNext(jobId: number, startedAt: number, attempt: number, delayMs: number): void {
  const timer = setTimeout(() => {
    void tick(jobId, startedAt, attempt);
  }, delayMs);
  // Don't keep the Node event loop alive just for a poll — if the
  // process is otherwise idle and shutting down, let it exit. The
  // boot resumption path will pick the job back up next start.
  if (typeof timer.unref === "function") timer.unref();
  active.set(jobId, { jobId, startedAt, attempt, timer });
}

async function tick(jobId: number, startedAt: number, attempt: number): Promise<void> {
  active.delete(jobId);

  if (!runRefresh) {
    logger.warn?.({ jobId }, "renderJobPoller tick fired before refresher was registered");
    return;
  }

  const elapsed = Date.now() - startedAt;
  if (elapsed > MAX_POLL_DURATION_MS) {
    logger.warn?.({ jobId, elapsedMs: elapsed, attempt }, "renderJobPoller giving up after max duration");
    return;
  }

  let result: Awaited<ReturnType<RunRefreshFn>>;
  try {
    result = await runRefresh(jobId);
  } catch (err) {
    logger.error?.({ err, jobId, attempt }, "renderJobPoller refresh threw");
    // Retry on next delay slot rather than abandoning — transient
    // errors (Shotstack 5xx, DB hiccup) shouldn't kill the poll.
    const nextDelay = POLL_DELAYS_MS[Math.min(attempt + 1, POLL_DELAYS_MS.length - 1)]!;
    scheduleNext(jobId, startedAt, attempt + 1, nextDelay);
    return;
  }

  if (!result) {
    // Job row no longer exists — nothing to poll.
    return;
  }

  if (TERMINAL_STATUSES.has(result.status)) {
    logger.info?.({ jobId, status: result.status, attempt, elapsedMs: elapsed }, "renderJobPoller reached terminal status");
    return;
  }

  // Still in-flight. Schedule the next tick.
  const nextDelay = POLL_DELAYS_MS[Math.min(attempt + 1, POLL_DELAYS_MS.length - 1)]!;
  scheduleNext(jobId, startedAt, attempt + 1, nextDelay);
}

/**
 * Find every non-terminal render_job in the DB and schedule polls for
 * them. Called once from src/index.ts after the HTTP server starts,
 * so we recover any in-flight renders that were live during a crash,
 * deploy, or Fly auto-stop cycle.
 *
 * Stagger the initial delays slightly so we don't fire a wall of
 * Shotstack GETs at boot.
 */
export async function resumeRenderJobPollsOnBoot(): Promise<void> {
  try {
    const rows = await db
      .select({ id: renderJobsTable.id })
      .from(renderJobsTable)
      .where(
        and(
          inArray(renderJobsTable.status, [...IN_FLIGHT_STATUSES]),
          isNotNull(renderJobsTable.externalJobId),
        ),
      );
    if (rows.length === 0) {
      logger.info?.("renderJobPoller boot scan: no in-flight render jobs to resume");
      return;
    }
    logger.info?.({ count: rows.length }, "renderJobPoller boot scan: resuming in-flight render jobs");
    rows.forEach((r, idx) => {
      // 1s base + 500ms per job — small jitter, capped at the normal first delay.
      const stagger = Math.min(1_000 + idx * 500, POLL_DELAYS_MS[0]!);
      scheduleRenderJobPoll(r.id, { initialDelayMs: stagger });
    });
  } catch (err) {
    // Boot must not fail because of this. If the DB is unreachable
    // the index.ts pingDatabase check already aborts; if it's just
    // this query that fails, the worst case is teachers needing to
    // open the project page to drive the in-browser poll.
    logger.error?.({ err }, "renderJobPoller boot scan failed (continuing without resume)");
  }
}

/**
 * Test/teardown helper — cancel every scheduled timer. Not used by
 * production code, but lets unit tests run without leaked handles.
 */
export function clearAllRenderJobPolls(): void {
  for (const a of active.values()) clearTimeout(a.timer);
  active.clear();
}

/**
 * Snapshot for diagnostics / healthz. Returns the number of jobs
 * currently being polled by this process.
 */
export function getActiveRenderJobPollCount(): number {
  return active.size;
}

/** Re-export an alias so callers don't need to import from drizzle here. */
export { eq };
