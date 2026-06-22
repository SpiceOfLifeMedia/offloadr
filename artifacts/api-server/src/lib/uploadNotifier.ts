import { logger } from "./logger.js";

// We deliberately do NOT use the `resend` SDK here. In this workspace
// the SDK (v4.8.0) consistently returns 401 "API key is invalid" for
// keys that pass the same auth via raw fetch + Bearer header (curl
// proves it). Going through fetch directly removes the SDK as a moving
// part and uses the exact request shape Resend's REST docs publish.

/**
 * Fire-and-forget upload notification email.
 *
 * Sent after a file has been:
 *   1. Successfully written to object storage (R2),
 *   2. Successfully recorded in the `media_files` table.
 *
 * Delivery is best-effort: any failure (missing config, Resend down, DNS
 * not verified) is logged but never bubbles back to the upload caller —
 * the upload request must always succeed regardless of email state.
 *
 * Required env (set on Fly, never committed):
 *   - RESEND_API_KEY            Resend API key. If unset, the notifier
 *                               logs once per call and returns. No crash.
 *   - UPLOAD_NOTIFICATION_EMAIL Recipient. Default: info@edumediasystems.com.au
 *   - UPLOAD_NOTIFICATION_FROM  Sender. Default: notifications@edumediasystems.com.au
 *                               MUST be on a Resend-verified domain or the
 *                               provider will reject the send.
 *   - APP_BASE_URL              Used to build the "Open Project" link.
 *                               Default: https://offloadr-pilot.fly.dev/offloadr
 */

export interface UploadNotificationFile {
  originalFileName: string;
  fileSizeBytes: number;
  // Internal id used to build the download link.
  fileId: number;
}

export interface UploadNotificationInput {
  projectId: number;
  projectName: string;
  uploaderName: string;
  uploaderKind: "teacher" | "student";
  files: UploadNotificationFile[];
  // Defaults to now() if omitted.
  uploadedAt?: Date;
}

const DEFAULT_RECIPIENT = "info@edumediasystems.com.au";
// edumediasystems.com.au is verified in Resend (eu-west-1 — SPF + DKIM
// records present on the domain; confirmed via GET https://api.resend.com/domains
// returning status: "verified"). We send from `notifications@…` on
// that domain across all environments and rely on the subject prefix
// to distinguish DEV/PILOT from PROD inbound. If Resend ever rejects
// the verified-domain send (token scoped to a different team, domain
// briefly out of compliance, etc.) the sender-fallback logic in
// `sendUploadNotification` retries via Resend's sandbox sender
// `onboarding@resend.dev` so DEV testing never silently breaks.
const DEFAULT_FROM_PROD = "Offloadr <notifications@edumediasystems.com.au>";
const DEFAULT_FROM_PILOT = "Offloadr (PILOT) <notifications@edumediasystems.com.au>";
const DEFAULT_FROM_DEV = "Offloadr (DEV) <notifications@edumediasystems.com.au>";
const FALLBACK_FROM_DEV = "Offloadr (DEV) <onboarding@resend.dev>";
const DEFAULT_BASE_URL = "https://offloadr-pilot.fly.dev/offloadr";

export type OffloadrEnv = "dev" | "pilot" | "production";

/**
 * Server-side environment detection. Reads only process.env — never
 * trust a frontend-supplied env. Set OFFLOADR_ENV explicitly on Fly /
 * production to flip the label; otherwise derive from NODE_ENV:
 *   - NODE_ENV !== "production"  → "dev"
 *   - NODE_ENV === "production"  → "pilot"  (today's prod IS the pilot)
 * When the pilot graduates, set OFFLOADR_ENV=production on Fly.
 */
export function detectOffloadrEnv(): OffloadrEnv {
  const explicit = (process.env["OFFLOADR_ENV"] ?? "").toLowerCase();
  if (explicit === "dev" || explicit === "pilot" || explicit === "production") {
    return explicit;
  }
  return process.env["NODE_ENV"] === "production" ? "pilot" : "dev";
}

function defaultFrom(): string {
  switch (detectOffloadrEnv()) {
    case "production":
      return DEFAULT_FROM_PROD;
    case "pilot":
      return DEFAULT_FROM_PILOT;
    case "dev":
    default:
      return DEFAULT_FROM_DEV;
  }
}

function subjectPrefix(): string {
  switch (detectOffloadrEnv()) {
    case "production":
      return "";
    case "pilot":
      return "[PILOT] ";
    case "dev":
    default:
      return "[DEV] ";
  }
}

let warnedMissingKey = false;

function getApiKey(): string | null {
  const rawKey = process.env["RESEND_API_KEY"];
  // Defensive trim: pasted secrets often carry a trailing newline or
  // wrapping quotes.
  const key = rawKey?.trim().replace(/^["']|["']$/g, "");
  if (!key) {
    if (!warnedMissingKey) {
      logger.warn(
        "[uploadNotifier] RESEND_API_KEY not set — upload notification emails are disabled. " +
          "Set it on Fly with `flyctl secrets set RESEND_API_KEY=... -a offloadr-pilot` to enable.",
      );
      warnedMissingKey = true;
    }
    return null;
  }
  return key;
}

interface ResendSendResult {
  ok: boolean;
  status: number;
  emailId: string | null;
  error: unknown;
}

async function resendSend(
  apiKey: string,
  payload: { from: string; to: string; subject: string; text: string; html: string },
): Promise<ResendSendResult> {
  // 10s hard cap so a Resend/network stall can never wedge the
  // notifier; fire-and-forget callers still won't block the upload,
  // but the dev test endpoint awaits this and would otherwise hang.
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
    if (!res.ok) {
      return { ok: false, status: res.status, emailId: null, error: body };
    }
    const emailId =
      body && typeof body === "object" && "id" in body && typeof (body as { id: unknown }).id === "string"
        ? (body as { id: string }).id
        : null;
    return { ok: true, status: res.status, emailId, error: null };
  } finally {
    clearTimeout(timer);
  }
}

function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes}B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIdx = 0;
  while (value >= 1024 && unitIdx < units.length - 1) {
    value /= 1024;
    unitIdx++;
  }
  const formatted = value >= 100 ? value.toFixed(0) : value.toFixed(1);
  return `${formatted}${units[unitIdx]}`;
}

function formatTimestamp(d: Date): string {
  // Render as "20 May 2026 — 11:15AM" in Australia/Adelaide local time so
  // recipients in AU see a meaningful clock regardless of the Fly machine's
  // own timezone.
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

function buildSubject(input: UploadNotificationInput): string {
  return `${subjectPrefix()}New Offloadr Upload — ${input.projectName}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface RenderedBodies {
  text: string;
  html: string;
}

function renderBody(input: UploadNotificationInput, baseUrl: string): RenderedBodies {
  const projectUrl = `${baseUrl.replace(/\/$/, "")}/projects/${input.projectId}`;
  const apiBase = (process.env["API_MOUNT_PATH"] ?? "/api").replace(/\/$/, "");
  const origin = baseUrl.replace(/\/$/, "").replace(/\/offloadr$/, "");
  const uploadedAt = formatTimestamp(input.uploadedAt ?? new Date());

  const fileLinesText = input.files
    .map((f) => `${f.originalFileName} — ${formatSize(f.fileSizeBytes)}`)
    .join("\n");

  const text = [
    "A new upload has been received in Offloadr.",
    "",
    "Project:",
    input.projectName,
    "",
    "Uploader:",
    `${input.uploaderName}${input.uploaderKind === "student" ? " (student)" : ""}`,
    "",
    "Files:",
    fileLinesText,
    "",
    "Uploaded:",
    uploadedAt,
    "",
    "Open Project:",
    projectUrl,
    "",
    "Download links:",
    ...input.files.map(
      (f) => `${f.originalFileName}: ${origin}${apiBase}/files/${f.fileId}/download`,
    ),
  ].join("\n");

  const fileLinesHtml = input.files
    .map(
      (f) =>
        `<li><strong>${escapeHtml(f.originalFileName)}</strong> — ${escapeHtml(
          formatSize(f.fileSizeBytes),
        )} <span style="color:#666">[<a href="${escapeHtml(
          `${origin}${apiBase}/files/${f.fileId}/download`,
        )}">download</a>]</span></li>`,
    )
    .join("");

  const html = `
<div style="font-family: -apple-system, system-ui, sans-serif; max-width: 560px; color: #222; line-height: 1.5;">
  <h2 style="margin: 0 0 16px;">New upload in Offloadr</h2>
  <p style="margin: 0 0 16px;">A new upload has been received.</p>
  <table style="border-collapse: collapse;">
    <tr><td style="padding: 4px 12px 4px 0; color: #666;">Project</td><td style="padding: 4px 0;"><strong>${escapeHtml(input.projectName)}</strong></td></tr>
    <tr><td style="padding: 4px 12px 4px 0; color: #666;">Uploader</td><td style="padding: 4px 0;">${escapeHtml(input.uploaderName)}${input.uploaderKind === "student" ? ' <span style="color:#999;">(student)</span>' : ""}</td></tr>
    <tr><td style="padding: 4px 12px 4px 0; color: #666; vertical-align: top;">Files</td><td style="padding: 4px 0;"><ul style="margin: 0; padding-left: 18px;">${fileLinesHtml}</ul></td></tr>
    <tr><td style="padding: 4px 12px 4px 0; color: #666;">Uploaded</td><td style="padding: 4px 0;">${escapeHtml(uploadedAt)}</td></tr>
  </table>
  <p style="margin: 20px 0 0;">
    <a href="${escapeHtml(projectUrl)}" style="display: inline-block; padding: 10px 18px; background: #111; color: #fff; text-decoration: none; border-radius: 6px;">Open project</a>
  </p>
</div>`.trim();

  return { text, html };
}

/**
 * Send an upload-success email. Fire-and-forget — never throws to the
 * caller. Call as `void sendUploadNotification(...)` from a route handler.
 */
export async function sendUploadNotification(
  input: UploadNotificationInput,
): Promise<void> {
  try {
    const apiKey = getApiKey();
    if (!apiKey) return;

    const to = process.env["UPLOAD_NOTIFICATION_EMAIL"] ?? DEFAULT_RECIPIENT;
    const from = process.env["UPLOAD_NOTIFICATION_FROM"] ?? defaultFrom();
    const baseUrl = process.env["APP_BASE_URL"] ?? DEFAULT_BASE_URL;
    const envLabel = detectOffloadrEnv();

    const subject = buildSubject(input);
    const { text, html } = renderBody(input, baseUrl);

    logger.info(
      {
        to,
        from,
        subject,
        env: envLabel,
        projectId: input.projectId,
        projectName: input.projectName,
        uploaderName: input.uploaderName,
        uploaderKind: input.uploaderKind,
        fileCount: input.files.length,
      },
      "[uploadNotifier] attempting send",
    );

    let result = await resendSend(apiKey, { from, to, subject, text, html });
    let finalFrom = from;

    // Sender fallback (DEV only). If Resend rejected the send AND the
    // failure looks sender-related (403 / 422 are the codes Resend
    // returns for `validation_error` on the `from` field — typically
    // "The from address is not verified") AND we're in DEV AND we
    // haven't already tried the sandbox sender, retry once with
    // `onboarding@resend.dev`. Never used in PILOT or PRODUCTION —
    // there a sender failure must surface, not be papered over.
    if (
      !result.ok &&
      envLabel === "dev" &&
      (result.status === 403 || result.status === 422) &&
      !from.includes("onboarding@resend.dev")
    ) {
      logger.warn(
        {
          httpStatus: result.status,
          err: result.error,
          originalFrom: from,
          fallbackFrom: FALLBACK_FROM_DEV,
          projectId: input.projectId,
        },
        "[uploadNotifier] DEV sender fallback triggered",
      );
      finalFrom = FALLBACK_FROM_DEV;
      result = await resendSend(apiKey, {
        from: FALLBACK_FROM_DEV,
        to,
        subject,
        text,
        html,
      });
    }

    if (!result.ok) {
      logger.error(
        {
          err: result.error,
          httpStatus: result.status,
          to,
          from: finalFrom,
          env: envLabel,
          projectId: input.projectId,
          projectName: input.projectName,
          uploaderName: input.uploaderName,
          uploaderKind: input.uploaderKind,
          fileCount: input.files.length,
        },
        "[uploadNotifier] resend rejected the send",
      );
      return;
    }

    logger.info(
      {
        emailId: result.emailId,
        to,
        from: finalFrom,
        env: envLabel,
        usedFallback: finalFrom !== from,
        projectId: input.projectId,
        projectName: input.projectName,
        uploaderName: input.uploaderName,
        uploaderKind: input.uploaderKind,
        fileCount: input.files.length,
      },
      "[uploadNotifier] upload notification sent",
    );
  } catch (err) {
    logger.error(
      {
        err,
        projectId: input.projectId,
        uploaderKind: input.uploaderKind,
        fileCount: input.files.length,
      },
      "[uploadNotifier] failed to send upload notification (swallowed — upload itself unaffected)",
    );
  }
}
