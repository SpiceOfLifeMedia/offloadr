/**
 * Render-output mirror.
 *
 * Why this exists: Shotstack hosts rendered MP4s on a short-lived CDN URL
 * (stage = ~24h, prod = also ephemeral). If we persist that URL into
 * render_jobs.finalExportUrl and rely on it, the teacher's video will
 * 404 a day after the demo. Worse, re-login / page refresh would not
 * help — the URL is dead at the source.
 *
 * Mirror flow:
 *   1. Render flips to `complete` with a Shotstack `url`.
 *   2. We stream that URL down and back up to our own R2 bucket under
 *      `renders/{projectId}/{jobId}.mp4` (no buffering — straight pipe).
 *   3. We persist the R2 storage path into `rawPayload._mirroredStoragePath`.
 *   4. Every subsequent list/read of the render_job re-signs a fresh
 *      1h R2 GET URL and returns THAT as finalExportUrl, not the
 *      now-stale Shotstack URL.
 *
 * Failure handling: if mirroring fails (network, R2 outage, etc.) we
 * record the error in `rawPayload._mirrorError` and leave the Shotstack
 * URL in place as a fallback. The next refresh poll re-attempts the
 * mirror because the storage path is still unset.
 */

import { Readable } from "node:stream";
import { db, renderJobsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { getStorageDriver } from "./storage/index";
import { logger } from "./logger";

const RENDER_MIRROR_PREFIX = "renders";

/**
 * Build the R2 storage key for a mirrored render output.
 *
 * Keep this stable: re-running the mirror for the same job overwrites
 * the same key, so a successful retry replaces a failed attempt
 * cleanly without orphan objects.
 */
function buildMirrorKey(projectId: number, jobId: number): string {
  return `${RENDER_MIRROR_PREFIX}/${projectId}/${jobId}.mp4`;
}

/**
 * Mirror a Shotstack-hosted MP4 into our R2 bucket and persist the
 * resulting storage path onto the render_job row.
 *
 * Returns the storage key on success, or null on failure. Failure is
 * non-fatal to the caller — the Shotstack URL remains usable until it
 * expires, and a later refresh will retry the mirror.
 */
export async function mirrorRenderOutputToStorage(opts: {
  projectId: number;
  jobId: number;
  sourceUrl: string;
}): Promise<string | null> {
  const { projectId, jobId, sourceUrl } = opts;
  const key = buildMirrorKey(projectId, jobId);

  // Defensive: avoid mirroring our own R2 signed URLs back into R2 in
  // case a future caller hands us an already-mirrored URL.
  if (sourceUrl.includes(`/${RENDER_MIRROR_PREFIX}/${projectId}/${jobId}.mp4`)) {
    return key;
  }

  // SSRF guard. `sourceUrl` originates from a third-party provider
  // response; never trust it to be a Shotstack CDN URL without checking.
  // A compromised provider (or a forged webhook that slipped past the
  // signature check) could otherwise make us fetch internal metadata
  // endpoints (e.g. 169.254.169.254 IMDS) and upload the result to R2.
  if (!isAllowedRenderOutputUrl(sourceUrl)) {
    await recordMirrorError(jobId, `Refusing to mirror non-Shotstack URL: ${redactUrl(sourceUrl)}`);
    return null;
  }

  // Atomic single-flight claim: only one concurrent caller (refresh
  // poll vs webhook) gets to perform the heavy stream-upload. Uses a
  // conditional UPDATE that succeeds only if neither the storage path
  // nor an in-flight claim is already present in rawPayload. Stale
  // claims older than 10 minutes are treated as abandoned so a crashed
  // mirror eventually retries.
  const claim = await db
    .update(renderJobsTable)
    .set({
      rawPayload: sql`
        jsonb_set(
          coalesce(${renderJobsTable.rawPayload}, '{}'::jsonb),
          '{_mirrorStartedAt}',
          to_jsonb(now()::text)
        )
      `,
      updatedAt: new Date(),
    })
    .where(
      sql`${renderJobsTable.id} = ${jobId}
        AND (${renderJobsTable.rawPayload} ->> '_mirroredStoragePath') IS NULL
        AND (
          (${renderJobsTable.rawPayload} ->> '_mirrorStartedAt') IS NULL
          OR (${renderJobsTable.rawPayload} ->> '_mirrorStartedAt')::timestamptz < now() - interval '10 minutes'
        )`,
    )
    .returning({ id: renderJobsTable.id });
  if (claim.length === 0) {
    // Another request is already mirroring (or already finished).
    return null;
  }

  let driver;
  try {
    driver = getStorageDriver();
  } catch (err) {
    await recordMirrorError(jobId, `Storage driver not configured: ${stringifyError(err)}`);
    return null;
  }

  if (driver.name !== "s3") {
    // Local fs / unknown driver — nothing to mirror to. Leave the
    // Shotstack URL alone; record the situation once.
    await recordMirrorError(
      jobId,
      `Storage driver "${driver.name}" cannot mirror render output. ` +
        `Set STORAGE_DRIVER=s3 in production to persist final MP4s.`,
    );
    return null;
  }

  try {
    const res = await fetch(sourceUrl);
    if (!res.ok || !res.body) {
      await recordMirrorError(
        jobId,
        `Source fetch failed: HTTP ${res.status} ${res.statusText}`,
      );
      return null;
    }

    const contentType = res.headers.get("content-type") ?? "video/mp4";

    // res.body is a WHATWG ReadableStream. Convert to a Node Readable
    // so the AWS SDK Upload helper can stream-pipe to R2 without
    // buffering the whole MP4 in memory (renders can easily be 100+ MB).
    const nodeStream = Readable.fromWeb(res.body as unknown as import("node:stream/web").ReadableStream);

    await driver.upload(key, nodeStream, contentType);

    // Persist the storage key onto the row. Use a JSON merge so we
    // never clobber other markers (`_notifiedAt` etc.) that may have
    // landed in the meantime. Also clear the in-flight claim marker.
    await db
      .update(renderJobsTable)
      .set({
        rawPayload: sql`
          jsonb_set(
            (coalesce(${renderJobsTable.rawPayload}, '{}'::jsonb)) - '_mirrorError' - '_mirrorStartedAt',
            '{_mirroredStoragePath}',
            to_jsonb(${key}::text)
          )
        `,
        updatedAt: new Date(),
      })
      .where(eq(renderJobsTable.id, jobId));

    logger.info?.({ jobId, projectId, key }, "Render output mirrored to R2");
    return key;
  } catch (err) {
    await recordMirrorError(jobId, stringifyError(err));
    return null;
  }
}

/**
 * Allowlist Shotstack-owned hosts for mirror source URLs.
 *
 * Shotstack serves rendered outputs from `*.shotstack.io` (and the
 * legacy `shotstack-api-*` CDN buckets). Anything else — including
 * internal IPs, cloud metadata endpoints, or arbitrary attacker-
 * controlled hosts — must not be fetched by our server.
 */
function isAllowedRenderOutputUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase();
  return (
    host === "shotstack.io" ||
    host.endsWith(".shotstack.io") ||
    host.endsWith(".shotstack-cdn.com") ||
    host.endsWith(".amazonaws.com") // Shotstack rendered outputs are served from S3-backed buckets
  );
}

function redactUrl(raw: string): string {
  try {
    const u = new URL(raw);
    return `${u.protocol}//${u.hostname}${u.pathname}`;
  } catch {
    return "<unparseable>";
  }
}

async function recordMirrorError(jobId: number, message: string): Promise<void> {
  try {
    await db
      .update(renderJobsTable)
      .set({
        rawPayload: sql`
          jsonb_set(
            (coalesce(${renderJobsTable.rawPayload}, '{}'::jsonb)) - '_mirrorStartedAt',
            '{_mirrorError}',
            to_jsonb(${message}::text)
          )
        `,
        updatedAt: new Date(),
      })
      .where(eq(renderJobsTable.id, jobId));
  } catch {
    // Best-effort: if we can't even record the error, we still don't
    // want to throw up through the request path. The next refresh
    // will retry the mirror regardless.
  }
  logger.warn?.({ jobId, message }, "Render output mirror failed");
}

function stringifyError(err: unknown): string {
  if (err instanceof Error) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

/**
 * Extract the mirrored storage path from a render_job's rawPayload,
 * or null if it hasn't been mirrored yet.
 */
export function readMirroredStoragePath(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const v = (raw as Record<string, unknown>)["_mirroredStoragePath"];
  return typeof v === "string" && v.length > 0 ? v : null;
}

/**
 * Extract the most recent mirror failure message, if any.
 */
export function readMirrorError(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const v = (raw as Record<string, unknown>)["_mirrorError"];
  return typeof v === "string" && v.length > 0 ? v : null;
}

/**
 * Re-sign a fresh, short-lived GET URL for a mirrored render output.
 * Returns null if the storage driver can't presign (fs driver), in
 * which case the caller should fall back to the stored URL.
 */
export async function signMirroredRenderUrl(
  storagePath: string,
  ttlSeconds = 60 * 60,
): Promise<string | null> {
  try {
    const driver = getStorageDriver();
    return await driver.getSignedDownloadUrl(storagePath, ttlSeconds);
  } catch {
    return null;
  }
}
