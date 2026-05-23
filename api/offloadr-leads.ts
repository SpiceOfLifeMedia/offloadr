import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { Resend } from "resend";

const Body = z.object({
  fullName: z.string().trim().min(1).max(120),
  school: z.string().trim().min(1).max(200),
  role: z.string().trim().min(1).max(80),
  studentCount: z.string().trim().min(1).max(40),
  state: z.string().trim().min(1).max(60),
  workflow: z.string().trim().min(5).max(2000),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(40).optional().default(""),
  company: z.string().trim().max(200).optional().default(""), // honeypot
});

type Lead = Omit<z.infer<typeof Body>, "company">;

const WINDOW_MS = 24 * 60 * 60 * 1000;
const recent = new Map<string, number>();
function isDuplicate(email: string) {
  const now = Date.now();
  for (const [k, ts] of recent) if (now - ts > WINDOW_MS) recent.delete(k);
  const last = recent.get(email);
  if (last && now - last < WINDOW_MS) return true;
  recent.set(email, now);
  return false;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function row(label: string, value: string) {
  if (!value) return "";
  return `<tr><td style="padding:14px 18px;border-bottom:1px solid rgba(255,255,255,0.06);vertical-align:top;">
    <p style="margin:0 0 4px;font-size:11px;letter-spacing:2px;color:rgba(255,255,255,0.5);text-transform:uppercase;">${escapeHtml(label)}</p>
    <p style="margin:0;font-size:15px;color:#fafafa;white-space:pre-wrap;">${escapeHtml(value)}</p>
  </td></tr>`;
}

function buildHtml(lead: Lead) {
  const accent = "#6366f1";
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;padding:40px 16px;"><tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#18181b;border:1px solid rgba(255,255,255,0.08);border-radius:8px;">
      <tr><td style="background:${accent};height:3px;font-size:0;line-height:0;border-top-left-radius:8px;border-top-right-radius:8px;">&nbsp;</td></tr>
      <tr><td style="padding:32px 32px 20px;">
        <p style="margin:0 0 6px;font-size:11px;letter-spacing:3px;color:${accent};text-transform:uppercase;font-weight:700;">Offloadr school demo request</p>
        <p style="margin:0 0 6px;font-size:22px;font-weight:700;color:#fafafa;line-height:1.2;">${escapeHtml(lead.school)}</p>
        <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.6);">${escapeHtml(lead.fullName)} · ${escapeHtml(lead.role)} · ${escapeHtml(lead.state)}</p>
      </td></tr>
      <tr><td style="padding:0 32px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid rgba(255,255,255,0.08);border-radius:6px;">
          ${row("Email", lead.email)}
          ${row("Phone", lead.phone)}
          ${row("School / organisation", lead.school)}
          ${row("Role", lead.role)}
          ${row("State", lead.state)}
          ${row("Student count", lead.studentCount)}
          ${row("Current media workflow", lead.workflow)}
        </table>
        <p style="margin:20px 0 0;font-size:13px;color:rgba(255,255,255,0.55);line-height:1.6;">Hit <strong style="color:#fafafa;">Reply</strong> to write back to ${escapeHtml(lead.email)} directly.</p>
      </td></tr>
      <tr><td style="padding:24px 32px;border-top:1px solid rgba(255,255,255,0.06);">
        <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.35);">Sent automatically from useoffloadr.com</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

function buildText(lead: Lead) {
  const lines = [
    `Offloadr school demo request`,
    ``,
    `School:           ${lead.school}`,
    `Contact:          ${lead.fullName}`,
    `Role:             ${lead.role}`,
    `State:            ${lead.state}`,
    `Student count:    ${lead.studentCount}`,
    `Email:            ${lead.email}`,
  ];
  if (lead.phone) lines.push(`Phone:            ${lead.phone}`);
  lines.push(``, `Current media workflow:`, lead.workflow, ``, `Reply to this email to write back to ${lead.email} directly.`);
  return lines.join("\n");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return res.status(400).json({
      error: issue?.message ?? "Some required fields are missing.",
    });
  }

  // Honeypot — silently 200 to bots
  if (parsed.data.company && parsed.data.company.trim().length > 0) {
    return res.status(200).json({ ok: true });
  }

  const { company: _omit, ...lead } = parsed.data;
  const emailKey = lead.email.toLowerCase();
  if (isDuplicate(emailKey)) {
    return res.status(200).json({ ok: true, deduped: true });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.OFFLOADR_LEAD_TO_EMAIL;
  const from = process.env.OFFLOADR_LEAD_FROM_EMAIL;

  if (!apiKey || !to || !from) {
    console.error("offloadr-leads: missing env vars", {
      hasKey: !!apiKey,
      hasTo: !!to,
      hasFrom: !!from,
    });
    return res.status(503).json({
      error: "Demo request is temporarily unavailable. Please email demo@useoffloadr.com directly.",
    });
  }

  try {
    const resend = new Resend(apiKey);
    const subject = `[Offloadr demo] ${lead.school} — ${lead.fullName} (${lead.state})`;
    const { error } = await resend.emails.send({
      from,
      to,
      replyTo: lead.email,
      subject,
      text: buildText(lead),
      html: buildHtml(lead),
    });
    if (error) {
      console.error("offloadr-leads: resend error", error);
      return res.status(502).json({
        error: "Couldn't reach our mail provider. Please try again shortly.",
      });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("offloadr-leads: unexpected error", err);
    return res.status(500).json({ error: "Internal error. Please try again shortly." });
  }
}
