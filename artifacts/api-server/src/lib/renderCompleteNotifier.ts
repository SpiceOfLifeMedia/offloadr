import { logger } from "./logger.js";

// We deliberately do NOT use the `resend` SDK here. See the long-form
// comment in ./uploadNotifier.ts — the SDK v4.8.0 returns spurious 401
// "API key is invalid" responses for keys that succeed via raw fetch
// against the same REST endpoint. Going through fetch directly removes
// that failure mode.

/**
 * Fire-and-forget render-complete notification email.
 *
 * Sent the first time a render_job for a project transitions to
 * `complete` and Shotstack returns a real `finalExportUrl`. Idempotency
 * is the caller's responsibility — pass `_notifiedAt` into rawPayload
 * after a successful send so retries/webhooks don't double-email.
 *
 * Required env (set on Fly, never committed):
 *   - RESEND_API_KEY            Resend API key. If unset, the notifier
 *                               logs once per process and returns.
 *   - RENDER_NOTIFICATION_EMAIL Recipient. Default: info@edumediasystems.com.au
 *   - RENDER_NOTIFICATION_FROM  Sender. Default: notifications@edumediasystems.com.au
 *                               MUST be on a Resend-verified domain.
 *   - APP_BASE_URL              Used to build the project link.
 *                               Default: https://offloadr-pilot.fly.dev/offloadr
 */

export interface RenderCompleteNotificationInput {
  projectId: number;
  projectName: string;
  fileCount: number;
  finalVideoUrl: string;
  completedAt?: Date;
}

const DEFAULT_RECIPIENT = "info@edumediasystems.com.au";
const DEFAULT_FROM_PROD = "Offloadr <notifications@edumediasystems.com.au>";
const DEFAULT_FROM_PILOT = "Offloadr (PILOT) <notifications@edumediasystems.com.au>";
const DEFAULT_FROM_DEV = "Offloadr (DEV) <notifications@edumediasystems.com.au>";
const FALLBACK_FROM_DEV = "Offloadr (DEV) <onboarding@resend.dev>";
const DEFAULT_BASE_URL = "https://offloadr-pilot.fly.dev/offloadr";

type EnvLabel = "dev" | "pilot" | "production";

function detectEnv(): EnvLabel {
  const explicit = (process.env["OFFLOADR_ENV"] ?? "").toLowerCase();
  if (explicit === "dev" || explicit === "pilot" || explicit === "production") {
    return explicit;
  }
  return process.env["NODE_ENV"] === "production" ? "pilot" : "dev";
}

function defaultFrom(): string {
  switch (detectEnv()) {
    case "production":
      return DEFAULT_FROM_PROD;
    case "pilot":
      return DEFAULT_FROM_PILOT;
    default:
      return DEFAULT_FROM_DEV;
  }
}

function subjectPrefix(): string {
  switch (detectEnv()) {
    case "production":
      return "";
    case "pilot":
      return "[PILOT] ";
    default:
      return "[DEV] ";
  }
}

let warnedMissingKey = false;

function getApiKey(): string | null {
  const rawKey = process.env["RESEND_API_KEY"];
  const key = rawKey?.trim().replace(/^["']|["']$/g, "");
  if (!key) {
    if (!warnedMissingKey) {
      logger.warn(
        "[renderCompleteNotifier] RESEND_API_KEY not set — render-complete emails are disabled. " +
          "Set it on Fly with `flyctl secrets set RESEND_API_KEY=... -a offloadr-pilot` to enable.",
      );
      warnedMissingKey = true;
    }
    return null;
  }
  return key;
}

async function resendSend(
  apiKey: string,
  payload: { from: string; to: string; subject: string; text: string; html: string },
): Promise<{ ok: boolean; status: number; emailId: string | null; error: unknown }> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 10_000);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: ac.signal,
    });
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    if (!res.ok) return { ok: false, status: res.status, emailId: null, error: body };
    const emailId =
      body && typeof body === "object" && "id" in body && typeof (body as { id: unknown }).id === "string"
        ? (body as { id: string }).id
        : null;
    return { ok: true, status: res.status, emailId, error: null };
  } finally {
    clearTimeout(timer);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatTimestamp(d: Date): string {
  const datePart = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Adelaide",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
  const timePart = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Adelaide",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(d)
    .replace(/\s+/g, "")
    .toUpperCase();
  return `${datePart} — ${timePart}`;
}

/**
 * Send a render-complete email. Fire-and-forget — never throws to the
 * caller. Returns true if Resend accepted the send (caller should then
 * persist `_notifiedAt` to dedupe), false otherwise.
 */
export async function sendRenderCompleteNotification(
  input: RenderCompleteNotificationInput,
): Promise<boolean> {
  try {
    const apiKey = getApiKey();
    if (!apiKey) return false;

    const to = process.env["RENDER_NOTIFICATION_EMAIL"] ?? DEFAULT_RECIPIENT;
    const from = process.env["RENDER_NOTIFICATION_FROM"] ?? defaultFrom();
    const baseUrl = (process.env["APP_BASE_URL"] ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    const projectUrl = `${baseUrl}/projects/${input.projectId}`;
    const completedAt = formatTimestamp(input.completedAt ?? new Date());

    const subject = `${subjectPrefix()}Offloadr final video ready — ${input.projectName}`;

    const text = [
      "An Offloadr final video has finished rendering.",
      "",
      "Project:",
      input.projectName,
      "",
      "Clips used:",
      String(input.fileCount),
      "",
      "Final video:",
      input.finalVideoUrl,
      "",
      "Open project:",
      projectUrl,
      "",
      "Completed:",
      completedAt,
    ].join("\n");

    const html = `
<div style="font-family: -apple-system, system-ui, sans-serif; max-width: 560px; color: #222; line-height: 1.5;">
  <h2 style="margin: 0 0 16px;">Final video ready</h2>
  <p style="margin: 0 0 16px;">An Offloadr final video has finished rendering and is ready to share.</p>
  <table style="border-collapse: collapse;">
    <tr><td style="padding: 4px 12px 4px 0; color: #666;">Project</td><td style="padding: 4px 0;"><strong>${escapeHtml(input.projectName)}</strong></td></tr>
    <tr><td style="padding: 4px 12px 4px 0; color: #666;">Clips used</td><td style="padding: 4px 0;">${input.fileCount}</td></tr>
    <tr><td style="padding: 4px 12px 4px 0; color: #666;">Completed</td><td style="padding: 4px 0;">${escapeHtml(completedAt)}</td></tr>
  </table>
  <p style="margin: 20px 0 8px;">
    <a href="${escapeHtml(input.finalVideoUrl)}" style="display: inline-block; padding: 10px 18px; background: #111; color: #fff; text-decoration: none; border-radius: 6px;">Watch / download final video</a>
  </p>
  <p style="margin: 8px 0 0;">
    <a href="${escapeHtml(projectUrl)}" style="color: #0a66c2;">Open project in Offloadr →</a>
  </p>
</div>`.trim();

    logger.info(
      { to, from, subject, projectId: input.projectId, projectName: input.projectName, fileCount: input.fileCount },
      "[renderCompleteNotifier] attempting send",
    );

    const result = await resendSend(apiKey, { from, to, subject, text, html });

    if (!result.ok) {
      logger.error(
        { err: result.error, httpStatus: result.status, to, from, projectId: input.projectId },
        "[renderCompleteNotifier] resend rejected the send",
      );
      return false;
    }

    logger.info(
      {
        emailId: result.emailId,
        to,
        from,
        projectId: input.projectId,
        projectName: input.projectName,
        fileCount: input.fileCount,
      },
      "[renderCompleteNotifier] render-complete notification sent",
    );
    return true;
  } catch (err) {
    logger.error(
      { err, projectId: input.projectId },
      "[renderCompleteNotifier] failed to send render-complete notification (swallowed)",
    );
    return false;
  }
}
