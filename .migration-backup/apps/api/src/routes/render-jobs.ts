import { Router, type IRouter } from "express";
import { z } from "zod";
import { db, projectsTable, renderJobsTable, timelinesTable, mediaFilesTable } from "@workspace/db";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { requireAuth, requireOrganization, getUserId, getOrganizationId } from "../lib/auth";
import { canManageProjects, requireRole } from "../lib/permissions";
import { logActivity } from "../lib/activity";
import { parseBody } from "../lib/validate";
import { getProvider, listProviders, type ProviderName } from "../providers";
import { getStorageDriver } from "../lib/storage/index";
import { sendRenderCompleteNotification } from "../lib/renderCompleteNotifier";
import {
  mirrorRenderOutputToStorage,
  readMirroredStoragePath,
  readMirrorError,
  signMirroredRenderUrl,
} from "../lib/renderMirror";
import {
  registerRenderJobRefresher,
  scheduleRenderJobPoll,
} from "../lib/renderJobPoller";

/**
 * Map the internal render_job status to a small, stable set of
 * user-facing lifecycle steps.
 *
 * The teacher UI displays a four-step indicator (Uploading → Preparing
 * → Rendering → Ready). Putting the mapping on the server keeps the
 * UI dumb and lets us evolve the underlying status values without
 * breaking the visual flow.
 *
 *   submitted/queued        → "preparing"  (Shotstack accepted job, fetching clips)
 *   processing              → "rendering"  (Shotstack compositing the timeline)
 *   complete                → "ready"
 *   failed / not_configured → "failed"
 */
type LifecycleStep = "preparing" | "rendering" | "ready" | "failed";

function deriveLifecycle(status: string): LifecycleStep {
  switch (status) {
    case "complete":
      return "ready";
    case "failed":
    case "not_configured":
      return "failed";
    case "processing":
      return "rendering";
    default:
      return "preparing";
  }
}

/**
 * Decorate a render_job row for API responses:
 *   - if we have a mirrored R2 copy, replace `finalExportUrl` with a
 *     freshly-signed 1h GET URL so the link survives page refresh /
 *     re-login long after the Shotstack hosted URL expires.
 *   - attach derived lifecycle + mirror-status fields the UI consumes
 *     verbatim.
 *
 * Pure read-side transformation; never writes to the DB.
 */
async function decorateRenderJobForResponse(
  job: typeof renderJobsTable.$inferSelect,
): Promise<Record<string, unknown>> {
  const mirroredPath = readMirroredStoragePath(job.rawPayload);
  let finalExportUrl = job.finalExportUrl;
  let mirrorError = readMirrorError(job.rawPayload);
  if (mirroredPath) {
    const signed = await signMirroredRenderUrl(mirroredPath);
    if (signed) {
      finalExportUrl = signed;
    } else {
      // Mirror succeeded earlier but signing failed now (e.g. R2 creds
      // rotated, bucket policy change). Do NOT silently fall back to
      // the stale Shotstack URL — it's almost certainly expired by the
      // time anyone hits this path. Surface the failure so the UI can
      // tell the teacher what to do.
      finalExportUrl = null;
      mirrorError = mirrorError ?? "Permanent video link is temporarily unavailable. Please retry shortly.";
    }
  }
  return {
    ...job,
    finalExportUrl,
    lifecycle: deriveLifecycle(job.status),
    isMirrored: Boolean(mirroredPath),
    mirrorError,
  };
}

/**
 * Notify on render completion, with idempotency baked in.
 *
 * Concurrency model: the refresh poll and the Shotstack webhook both
 * race here as soon as the job flips to `complete`. To guarantee one
 * email per job we **atomically claim** the `_notifiedAt` marker via a
 * conditional UPDATE that only succeeds when the marker is NULL. Only
 * the request that wins the claim sends the email. If the send itself
 * fails we roll the marker back so a later trigger can retry.
 *
 * The marker lives in `rawPayload._notifiedAt`. Callers that write
 * `rawPayload` from provider data MUST merge in the existing marker
 * (see refresh + webhook handlers below) so this claim isn't reset.
 */
async function maybeNotifyRenderComplete(
  jobAfterUpdate: typeof renderJobsTable.$inferSelect,
  projectId: number,
  projectName: string,
): Promise<void> {
  if (jobAfterUpdate.status !== "complete") return;

  // Prefer the R2-mirrored URL for the email. The Shotstack-hosted
  // `finalExportUrl` expires within ~24h and would 404 by the time
  // a teacher checks their inbox the next morning. If mirroring
  // hasn't completed (failure, fs driver, race), fall back to the
  // raw provider URL so the email still ships — better an
  // ephemeral link than no link.
  const mirroredPath = readMirroredStoragePath(jobAfterUpdate.rawPayload);
  let finalUrl: string | null = null;
  if (mirroredPath) {
    finalUrl = await signMirroredRenderUrl(mirroredPath, 7 * 24 * 60 * 60); // 7d — survives a weekend
  }
  if (!finalUrl) {
    finalUrl = jobAfterUpdate.finalExportUrl ?? jobAfterUpdate.previewUrl;
  }
  if (!finalUrl) return;

  // Atomic claim. Postgres jsonb_set on a COALESCEd empty object so
  // the path always exists. The WHERE clause guarantees only one
  // racing transaction can flip the marker from NULL → timestamp.
  const nowIso = new Date().toISOString();
  const claimed = await db
    .update(renderJobsTable)
    .set({
      rawPayload: sql`jsonb_set(coalesce(${renderJobsTable.rawPayload}, '{}'::jsonb), '{_notifiedAt}', to_jsonb(${nowIso}::text))`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(renderJobsTable.id, jobAfterUpdate.id),
        eq(renderJobsTable.status, "complete"),
        sql`(${renderJobsTable.rawPayload} -> '_notifiedAt') IS NULL`,
      ),
    )
    .returning({ id: renderJobsTable.id });

  if (claimed.length === 0) return; // someone else already claimed → they will send

  const [{ count }] = await db
    .select({ count: sqlCount() })
    .from(mediaFilesTable)
    .where(
      and(
        eq(mediaFilesTable.projectId, projectId),
        eq(mediaFilesTable.fileType, "video"),
        eq(mediaFilesTable.uploadStatus, "uploaded"),
      ),
    );

  const sent = await sendRenderCompleteNotification({
    projectId,
    projectName,
    fileCount: Number(count ?? 0),
    finalVideoUrl: finalUrl,
  });

  if (!sent) {
    // Send failed (Resend down, missing API key, transient network) —
    // roll back the claim so a later refresh/webhook can retry rather
    // than silently swallowing the notification forever.
    await db
      .update(renderJobsTable)
      .set({
        rawPayload: sql`(${renderJobsTable.rawPayload}) - '_notifiedAt'`,
        updatedAt: new Date(),
      })
      .where(eq(renderJobsTable.id, jobAfterUpdate.id));
  }
}

/**
 * Operational markers managed outside the provider payload (atomic
 * claims for notification dedupe + mirror state). These must survive
 * every refresh/webhook overwrite of rawPayload.
 *
 * If we add a new `_xxx` marker, list it here so it's preserved by
 * `buildRawPayloadMergeSQL` below.
 */
const OPERATIONAL_MARKER_KEYS = [
  "_notifiedAt",
  "_mirroredStoragePath",
  "_mirrorStartedAt",
  "_mirrorError",
] as const;

/**
 * Build a SQL expression that overwrites `rawPayload` with the new
 * provider payload while preserving operational markers from the
 * CURRENT row (read inside the UPDATE, not from a stale pre-read).
 *
 * This closes a real lost-update race: previously the refresh path
 * read the row, called the provider, then UPDATEd with a JS-merged
 * rawPayload built from that stale snapshot. If a concurrent worker
 * (webhook, second poll, browser-driven refresh) had written
 * `_notifiedAt` or `_mirroredStoragePath` in between, those markers
 * were silently clobbered → duplicate emails / duplicate R2 uploads.
 *
 * Using `jsonb_strip_nulls(jsonb_build_object(...))` skips any marker
 * that is currently null in the DB, so we don't pollute the JSON with
 * `null` entries for markers that haven't been claimed yet.
 */
function buildRawPayloadMergeSQL(next: Record<string, unknown> | undefined) {
  const nextJson = JSON.stringify(next ?? {});
  // Postgres: jsonb concatenation `||` — right side wins on key collision.
  // We put the new provider payload on the LEFT and the preserved
  // markers on the RIGHT, so any marker present in the live DB row
  // overrides whatever the provider may have included (Shotstack will
  // never set `_notifiedAt`, but defence in depth is cheap).
  return sql`
    (${nextJson}::jsonb)
    || COALESCE(
      jsonb_strip_nulls(
        jsonb_build_object(
          ${OPERATIONAL_MARKER_KEYS[0]}, ${renderJobsTable.rawPayload} -> ${OPERATIONAL_MARKER_KEYS[0]},
          ${OPERATIONAL_MARKER_KEYS[1]}, ${renderJobsTable.rawPayload} -> ${OPERATIONAL_MARKER_KEYS[1]},
          ${OPERATIONAL_MARKER_KEYS[2]}, ${renderJobsTable.rawPayload} -> ${OPERATIONAL_MARKER_KEYS[2]},
          ${OPERATIONAL_MARKER_KEYS[3]}, ${renderJobsTable.rawPayload} -> ${OPERATIONAL_MARKER_KEYS[3]}
        )
      ),
      '{}'::jsonb
    )
  `;
}

function sqlCount() {
  return sql<number>`count(*)::int`;
}

const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1h: long enough for Shotstack to fetch, short enough that leaks expire fast.

/**
 * Build the Shotstack-shaped payload for a Smart Draft submission.
 * Pulls uploaded video files for the project, generates one short-lived
 * signed GET URL per file, and packages them in upload order.
 *
 * Returns { payload, error }. When `error` is set, the route should
 * persist a `failed` render_job with that message rather than calling
 * the provider — the provider needs real URLs to do anything useful.
 */
async function buildSmartDraftPayload(
  projectId: number,
  projectName: string,
  classGroup: string | null,
): Promise<{ payload: Record<string, unknown> | null; error: string | null }> {
  const files = await db
    .select()
    .from(mediaFilesTable)
    .where(
      and(
        eq(mediaFilesTable.projectId, projectId),
        eq(mediaFilesTable.fileType, "video"),
        eq(mediaFilesTable.uploadStatus, "uploaded"),
      ),
    )
    .orderBy(asc(mediaFilesTable.createdAt));

  if (files.length === 0) {
    return { payload: null, error: "No uploaded video clips found for this project yet." };
  }

  const driver = getStorageDriver();
  const clips: Array<{
    url: string;
    mimeType: string;
    duration: number | null;
    studentName?: string | null;
  }> = [];

  for (const f of files) {
    if (!f.storagePath) {
      return {
        payload: null,
        error: `File ${f.id} (${f.originalFileName}) has no storage path — cannot generate render URL.`,
      };
    }
    const url = await driver.getSignedDownloadUrl(f.storagePath, SIGNED_URL_TTL_SECONDS);
    if (!url) {
      return {
        payload: null,
        error:
          `Storage driver "${driver.name}" cannot generate a public render URL. ` +
          `Smart Draft renders require an S3/R2 storage backend in production.`,
      };
    }
    clips.push({
      url,
      mimeType: "video/mp4",
      duration: typeof f.duration === "number" ? f.duration : null,
      studentName: f.studentUploaderName,
    });
  }

  return {
    payload: {
      projectName,
      classGroup,
      clips,
    },
    error: null,
  };
}

/**
 * Shared refresh pipeline used by the HTTP refresh route AND the
 * background poller in lib/renderJobPoller.ts. Loads the job by id
 * (no auth scope — internal callers only; the HTTP route does its
 * own org check before delegating to this), calls the provider's
 * checkStatus, updates the DB, mirrors the MP4 to R2 on first
 * completion, and fires the notification email.
 *
 * Idempotency: identical to the per-request behaviour. Mirror and
 * notify both use atomic DB claims in their own modules, so this
 * function is safe to call concurrently with the HTTP route, the
 * webhook handler, and any number of background polls.
 *
 * Returns the post-refresh job row, or null if the job no longer
 * exists, has no external id yet, or is already terminal.
 */
async function runRenderJobRefresh(
  jobId: number,
): Promise<typeof renderJobsTable.$inferSelect | null> {
  const [job] = await db
    .select()
    .from(renderJobsTable)
    .where(eq(renderJobsTable.id, jobId));
  if (!job) return null;
  if (job.status === "complete" || job.status === "failed" || job.status === "not_configured") {
    return job;
  }
  if (!job.externalJobId) return job;

  const provider = getProvider(job.provider);
  const status = await provider.checkStatus(job.externalJobId);
  const [updated] = await db
    .update(renderJobsTable)
    .set({
      status:
        status.status === "complete"
          ? "complete"
          : status.status === "failed"
            ? "failed"
            : status.status === "not_configured"
              ? "not_configured"
              : status.status === "queued"
                ? "queued"
                : "processing",
      previewUrl: status.previewUrl ?? job.previewUrl,
      finalExportUrl: status.finalExportUrl ?? job.finalExportUrl,
      errorMessage: status.errorMessage ?? null,
      rawPayload: buildRawPayloadMergeSQL(
        status.rawPayload as Record<string, unknown> | undefined,
      ),
      updatedAt: new Date(),
    })
    .where(eq(renderJobsTable.id, job.id))
    .returning();
  if (!updated) return null;

  // Mirror BEFORE notify so the emailed link points at our permanent
  // R2 copy via the next read's re-signed URL, not Shotstack's CDN.
  let afterMirror = updated;
  if (
    updated.status === "complete" &&
    !readMirroredStoragePath(updated.rawPayload) &&
    (updated.finalExportUrl ?? updated.previewUrl)
  ) {
    await mirrorRenderOutputToStorage({
      projectId: updated.projectId,
      jobId: updated.id,
      sourceUrl: (updated.finalExportUrl ?? updated.previewUrl)!,
    });
    const [reloaded] = await db
      .select()
      .from(renderJobsTable)
      .where(eq(renderJobsTable.id, updated.id));
    if (reloaded) afterMirror = reloaded;
  }

  // Look up project name for the email subject. Cheap single-row read.
  const [proj] = await db
    .select({ projectName: projectsTable.projectName })
    .from(projectsTable)
    .where(eq(projectsTable.id, afterMirror.projectId))
    .limit(1);
  if (proj) {
    await maybeNotifyRenderComplete(afterMirror, afterMirror.projectId, proj.projectName);
  }

  return afterMirror;
}

// Wire the shared refresh into the background poller. Done at module
// load so the first scheduled tick has it ready.
registerRenderJobRefresher(async (jobId) => {
  const row = await runRenderJobRefresh(jobId);
  return row ? { status: row.status } : null;
});

const router: IRouter = Router();

const providerNameSchema = z.enum(["descript", "shotstack", "vizard", "creatomate", "remotion", "stub"]);

const smartDraftSchema = z.object({
  provider: providerNameSchema.optional(),
});

const finalRenderSchema = z.object({
  provider: providerNameSchema.optional(),
});

async function loadProject(req: import("express").Request) {
  const organizationId = getOrganizationId(req)!;
  const raw = Array.isArray(req.params["id"]) ? req.params["id"][0] : req.params["id"];
  const id = parseInt(raw ?? "", 10);
  if (!Number.isFinite(id)) return { id: NaN, project: undefined };
  const [project] = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.id, id), eq(projectsTable.organizationId, organizationId)));
  return { id, project };
}

// List configured providers + their current state. Frontend uses this to decide
// what to render in the "Smart Draft" panel.
router.get("/providers", requireAuth, requireOrganization, async (_req, res): Promise<void> => {
  res.json({ providers: listProviders() });
});

// Submit a Smart Draft job (default provider = descript; falls back to stub
// when descript isn't configured so the UX flow still works end-to-end).
router.post("/projects/:id/smart-draft", requireAuth, requireOrganization, requireRole(canManageProjects), async (req, res): Promise<void> => {
  try {
  const userId = getUserId(req)!;
  const { id, project } = await loadProject(req);
  if (!project) {
    res.status(404).json({ error: "Not Found", message: "Project not found" });
    return;
  }
  const body = parseBody(req, res, smartDraftSchema);
  if (!body) return;

  // Default to shotstack now that the real adapter is wired. Stub
  // fallback remains available via ?fallback=stub for offline dev.
  const chosen: ProviderName = body.provider ?? "shotstack";
  const primary = getProvider(chosen);
  const useStubFallback = !primary.isConfigured() && req.query["fallback"] === "stub";
  const provider = useStubFallback ? getProvider("stub") : primary;

  // Build the payload eagerly so missing prerequisites (no clips, no
  // signed URLs) surface as a clean failed render_job row instead of
  // a provider-side error message the operator has to decode.
  const { payload, error: payloadError } = await buildSmartDraftPayload(
    id,
    project.projectName,
    project.classGroup ?? null,
  );

  // A provider throw (Shotstack rejecting the payload, network error,
  // signed-URL generation failure inside the adapter) used to bubble
  // up as a generic 500 with no actionable info for the teacher.
  // Convert thrown errors into a failed render_job row so the UI can
  // surface the real reason instead of "Something went wrong".
  let result: Awaited<ReturnType<typeof provider.submitJob>>;
  if (payloadError || !payload) {
    result = { status: "failed", message: payloadError ?? "Failed to build Smart Draft payload." };
  } else {
    try {
      result = await provider.submitJob({
        projectId: id,
        kind: "smart_draft",
        payload,
      });
    } catch (err) {
      const e = err as Error;
      req.log?.error?.(
        { err: { name: e?.name, message: e?.message, stack: e?.stack }, projectId: id, provider: provider.name },
        "smart-draft provider.submitJob threw",
      );
      result = {
        status: "failed",
        message: `${provider.name} render submission failed: ${e?.message ?? String(err)}`,
      };
    }
  }

  const [job] = await db
    .insert(renderJobsTable)
    .values({
      projectId: id,
      provider: provider.name,
      kind: "smart_draft",
      status: result.status === "submitted" ? "submitted" : result.status === "not_configured" ? "not_configured" : "failed",
      externalJobId: result.externalJobId ?? null,
      errorMessage: result.status === "not_configured" || result.status === "failed" ? (result.message ?? null) : null,
      rawPayload: (result.rawPayload ?? {}) as Record<string, unknown>,
    })
    .returning();

  await logActivity(id, "smart_draft_requested", `Smart Draft requested via ${provider.name} (${result.status})`, userId);
  req.log?.info?.({ projectId: id, provider: provider.name, status: result.status }, "Smart Draft job created");
  // Kick off the server-side background poller so completion no longer
  // depends on the teacher keeping the browser open.
  if (job.status === "submitted" || job.status === "queued" || job.status === "processing") {
    scheduleRenderJobPoll(job.id);
  }
  res.status(201).json(job);
  } catch (err) {
    // Catches upstream throws (loadProject DB error, buildSmartDraftPayload
    // throwing inside the storage driver while signing R2 URLs, etc.).
    // Log with full context so Fly logs name the real cause, and return
    // a structured 500 so the UI shows something more useful than the
    // generic "Something went wrong" the global handler emits.
    const e = err as Error;
    req.log?.error?.(
      { err: { name: e?.name, message: e?.message, stack: e?.stack }, route: "/projects/:id/smart-draft" },
      "smart-draft handler threw",
    );
    res.status(500).json({
      error: "Internal Server Error",
      code: "smart_draft_failed",
      message: `Smart Draft failed: ${e?.message ?? String(err)}`,
    });
  }
});

/**
 * One-button school demo endpoint.
 *
 * UPLOAD FOOTAGE → click → AUTOMATIC FINAL VIDEO → teacher gets link.
 *
 * Differences vs `/render`:
 *   - No approval gate. The whole point is one click.
 *   - Hard 503 if SHOTSTACK_API_KEY is missing. We do NOT persist a
 *     `not_configured` render_job row — that just clutters the UI and
 *     fakes progress. The teacher gets a clear setup error instead.
 *   - Returns 422 if there are no uploaded video clips yet.
 *
 * On success, the polling refresh + Shotstack webhook will flip the job
 * to `complete` with a real MP4 URL, and the render-complete notifier
 * will email info@edumediasystems.com.au exactly once.
 */
router.post(
  "/projects/:id/create-final-video",
  requireAuth,
  requireOrganization,
  requireRole(canManageProjects),
  async (req, res): Promise<void> => {
    const userId = getUserId(req)!;
    const { id, project } = await loadProject(req);
    if (!project) {
      res.status(404).json({ error: "Not Found", message: "Project not found" });
      return;
    }

    const provider = getProvider("shotstack");
    if (!provider.isConfigured()) {
      res.status(503).json({
        error: "Service Unavailable",
        code: "shotstack_not_configured",
        message:
          "Final video rendering is not configured. SHOTSTACK_API_KEY must be set on the Offloadr API before this button will work.",
      });
      return;
    }

    const { payload, error: payloadError } = await buildSmartDraftPayload(
      id,
      project.projectName,
      project.classGroup ?? null,
    );

    if (payloadError || !payload) {
      res.status(422).json({
        error: "Unprocessable Entity",
        code: "no_clips",
        message: payloadError ?? "Failed to build final video payload.",
      });
      return;
    }

    const result = await provider.submitJob({
      projectId: id,
      kind: "final_render",
      payload,
    });

    if (result.status === "not_configured") {
      // Defensive — should be unreachable because we checked above, but
      // means the adapter lost its config mid-request. Don't persist.
      res.status(503).json({
        error: "Service Unavailable",
        code: "shotstack_not_configured",
        message: result.message ?? "Shotstack adapter became unavailable.",
      });
      return;
    }

    if (result.status === "failed") {
      res.status(502).json({
        error: "Bad Gateway",
        code: "shotstack_submit_failed",
        message: result.message ?? "Shotstack rejected the render submission.",
      });
      return;
    }

    const [job] = await db
      .insert(renderJobsTable)
      .values({
        projectId: id,
        provider: provider.name,
        kind: "final_render",
        status: "submitted",
        externalJobId: result.externalJobId ?? null,
        errorMessage: null,
        rawPayload: (result.rawPayload ?? {}) as Record<string, unknown>,
      })
      .returning();

    await logActivity(
      id,
      "final_render_requested",
      `Create Final Video clicked — Shotstack render submitted (${result.externalJobId ?? "no-id"})`,
      userId,
    );
    req.log?.info?.(
      { projectId: id, externalJobId: result.externalJobId, clipCount: payload["clips"] ? (payload["clips"] as unknown[]).length : 0 },
      "Create Final Video — Shotstack render submitted",
    );
    // Background poller — teacher can close the tab and still get the email.
    scheduleRenderJobPoll(job.id);
    res.status(201).json(job);
  },
);

// Submit a final render job (default provider = shotstack). Requires the
// project to be approved — never let an un-reviewed project ship.
router.post("/projects/:id/render", requireAuth, requireOrganization, requireRole(canManageProjects), async (req, res): Promise<void> => {
  const userId = getUserId(req)!;
  const { id, project } = await loadProject(req);
  if (!project) {
    res.status(404).json({ error: "Not Found", message: "Project not found" });
    return;
  }
  if (project.submissionStatus !== "approved") {
    res.status(409).json({ error: "Conflict", message: "Project must be approved before rendering" });
    return;
  }
  const body = parseBody(req, res, finalRenderSchema);
  if (!body) return;

  const chosen: ProviderName = body.provider ?? "shotstack";
  const provider = getProvider(chosen);

  // Final render reuses the Smart Draft payload shape — same composer,
  // same source clips. If we add a "high-quality" output preset later
  // it goes inside the composer, not by branching payload shape.
  const { payload, error: payloadError } = await buildSmartDraftPayload(
    id,
    project.projectName,
    project.classGroup ?? null,
  );

  const result = payloadError || !payload
    ? { status: "failed" as const, message: payloadError ?? "Failed to build render payload." }
    : await provider.submitJob({
        projectId: id,
        kind: "final_render",
        payload,
      });

  const [job] = await db
    .insert(renderJobsTable)
    .values({
      projectId: id,
      provider: provider.name,
      kind: "final_render",
      status: result.status === "submitted" ? "submitted" : result.status === "not_configured" ? "not_configured" : "failed",
      externalJobId: result.externalJobId ?? null,
      errorMessage: result.status === "not_configured" || result.status === "failed" ? (result.message ?? null) : null,
      rawPayload: (result.rawPayload ?? {}) as Record<string, unknown>,
    })
    .returning();

  await logActivity(id, "final_render_requested", `Final render requested via ${provider.name} (${result.status})`, userId);
  req.log?.info?.({ projectId: id, provider: provider.name, status: result.status }, "Final render job created");
  if (job.status === "submitted" || job.status === "queued" || job.status === "processing") {
    scheduleRenderJobPoll(job.id);
  }
  res.status(201).json(job);
});

// Refresh a single render job by re-querying the provider's status API.
// The frontend polls this every few seconds while a Smart Draft is
// rendering so the teacher dashboard updates without needing a public
// webhook. Scoped by org via loadProject() so cross-tenant refresh is
// impossible even if a job id is guessed.
router.post(
  "/projects/:id/render-jobs/:jobId/refresh",
  requireAuth,
  requireOrganization,
  async (req, res): Promise<void> => {
    const { id, project } = await loadProject(req);
    if (!project) {
      res.status(404).json({ error: "Not Found", message: "Project not found" });
      return;
    }
    const jobIdRaw = Array.isArray(req.params["jobId"]) ? req.params["jobId"][0] : req.params["jobId"];
    const jobId = parseInt(jobIdRaw ?? "", 10);
    if (!Number.isFinite(jobId)) {
      res.status(400).json({ error: "Bad Request", message: "Invalid jobId" });
      return;
    }
    // Org-scope check: confirm the job belongs to this project before
    // delegating to the unscoped shared refresh function.
    const [scopedJob] = await db
      .select({ id: renderJobsTable.id })
      .from(renderJobsTable)
      .where(and(eq(renderJobsTable.id, jobId), eq(renderJobsTable.projectId, id)));
    if (!scopedJob) {
      res.status(404).json({ error: "Not Found", message: "Render job not found" });
      return;
    }

    const refreshed = await runRenderJobRefresh(jobId);
    if (!refreshed) {
      res.status(404).json({ error: "Not Found", message: "Render job not found" });
      return;
    }
    req.log?.info?.({ jobId, status: refreshed.status }, "Render job refreshed");
    res.json(await decorateRenderJobForResponse(refreshed));
  },
);

router.get("/projects/:id/render-jobs", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  const { id, project } = await loadProject(req);
  if (!project) {
    res.status(404).json({ error: "Not Found", message: "Project not found" });
    return;
  }
  const jobs = await db
    .select()
    .from(renderJobsTable)
    .where(eq(renderJobsTable.projectId, id))
    .orderBy(desc(renderJobsTable.createdAt));
  // Re-sign every mirrored URL fresh on each list so refreshing the
  // page or re-logging in never returns a dead link.
  const decorated = await Promise.all(jobs.map(decorateRenderJobForResponse));
  res.json(decorated);
});

router.get("/projects/:id/timeline", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  const { id, project } = await loadProject(req);
  if (!project) {
    res.status(404).json({ error: "Not Found", message: "Project not found" });
    return;
  }
  const [timeline] = await db
    .select()
    .from(timelinesTable)
    .where(eq(timelinesTable.projectId, id))
    .orderBy(desc(timelinesTable.updatedAt))
    .limit(1);
  res.json(timeline ?? null);
});

// Provider webhook. Unauthenticated (validates via the adapter's
// handleWebhook signature check), but rate-limited at the proxy.
// The stub provider webhook does NO signature verification and is therefore
// only mounted in non-production builds — in prod every provider must do real
// signature verification inside handleWebhook before this route trusts it.
router.post("/webhooks/providers/:provider", async (req, res): Promise<void> => {
  const providerName = req.params["provider"];
  const parsed = providerNameSchema.safeParse(providerName);
  if (!parsed.success) {
    res.status(400).json({ error: "Bad Request", message: "Unknown provider" });
    return;
  }
  if (parsed.data === "stub" && process.env["NODE_ENV"] === "production") {
    res.status(404).json({ error: "Not Found", message: "Stub provider webhook is disabled in production" });
    return;
  }
  const provider = getProvider(parsed.data);
  const result = await provider.handleWebhook(req.body, req.headers as Record<string, string | string[] | undefined>);
  if (!result) {
    req.log?.warn?.({ provider: parsed.data }, "Webhook body did not match provider signature");
    res.status(400).json({ error: "Bad Request", message: "Webhook signature/body invalid" });
    return;
  }

  // Update the matching render_job row. Scope by provider so a forged callback
  // on one provider can't mutate a job that belongs to a different provider,
  // even if the attacker happens to know/guess the external job id.
  const [job] = await db
    .select()
    .from(renderJobsTable)
    .where(and(eq(renderJobsTable.externalJobId, result.externalJobId), eq(renderJobsTable.provider, parsed.data)))
    .limit(1);
  if (!job) {
    res.status(404).json({ error: "Not Found", message: "Render job not found for external id + provider" });
    return;
  }

  const [updated] = await db
    .update(renderJobsTable)
    .set({
      status: result.result.status === "complete" ? "complete" : result.result.status === "failed" ? "failed" : "processing",
      previewUrl: result.result.previewUrl ?? job.previewUrl,
      finalExportUrl: result.result.finalExportUrl ?? job.finalExportUrl,
      errorMessage: result.result.errorMessage ?? null,
      rawPayload: buildRawPayloadMergeSQL(
        result.result.rawPayload as Record<string, unknown> | undefined,
      ),
      updatedAt: new Date(),
    })
    .where(eq(renderJobsTable.id, job.id))
    .returning();

  req.log?.info?.({ jobId: job.id, status: result.result.status }, "Render job updated from webhook");

  // If the webhook reports a non-terminal status (e.g. Shotstack
  // pinged us on transition to `rendering`), make sure the background
  // poller is armed so we don't depend on a second webhook.
  if (updated.status === "submitted" || updated.status === "queued" || updated.status === "processing") {
    scheduleRenderJobPoll(updated.id);
  }

  // Mirror to R2 before notifying so emailed URLs point at our
  // permanent copy, not the ephemeral Shotstack one.
  let afterMirror = updated;
  if (
    updated.status === "complete" &&
    !readMirroredStoragePath(updated.rawPayload) &&
    (updated.finalExportUrl ?? updated.previewUrl)
  ) {
    await mirrorRenderOutputToStorage({
      projectId: updated.projectId,
      jobId: updated.id,
      sourceUrl: (updated.finalExportUrl ?? updated.previewUrl)!,
    });
    const [reloaded] = await db
      .select()
      .from(renderJobsTable)
      .where(eq(renderJobsTable.id, updated.id));
    if (reloaded) afterMirror = reloaded;
  }

  // Notify on completion. Same idempotency rules as the refresh path.
  const [proj] = await db
    .select({ projectName: projectsTable.projectName })
    .from(projectsTable)
    .where(eq(projectsTable.id, afterMirror.projectId))
    .limit(1);
  if (proj) {
    await maybeNotifyRenderComplete(afterMirror, afterMirror.projectId, proj.projectName);
  }

  res.json({ ok: true });
});

export default router;
