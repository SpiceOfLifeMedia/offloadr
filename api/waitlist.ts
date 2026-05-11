import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { Resend } from "resend";

const Body = z.object({
  email: z.string().trim().email().max(254),
  role: z.string().trim().max(200).optional(),
});

type Lead = z.infer<typeof Body>;

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

function buildHtml(lead: Lead) {
  const accent = "#3b82f6";
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;padding:40px 16px;"><tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#18181b;border:1px solid rgba(255,255,255,0.08);border-radius:8px;">
      <tr><td style="background:${accent};height:3px;font-size:0;line-height:0;border-top-left-radius:8px;border-top-right-radius:8px;">&nbsp;</td></tr>
      <tr><td style="padding:32px;">
        <p style="margin:0 0 6px;font-size:11px;letter-spacing:3px;color:${accent};text-transform:uppercase;font-weight:700;">Offloadr beta signup</p>
        <p style="margin:0 0 24px;font-size:22px;font-weight:700;color:#fafafa;line-height:1.2;">New beta lead</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid rgba(255,255,255,0.08);border-radius:6px;">
          <tr><td style="padding:14px 18px;border-bottom:1px solid rgba(255,255,255,0.06);">
            <p style="margin:0 0 4px;font-size:11px;letter-spacing:2px;color:rgba(255,255,255,0.5);text-transform:uppercase;">Email</p>
            <p style="margin:0;font-size:15px;"><a href="mailto:${escapeHtml(lead.email)}" style="color:${accent};text-decoration:none;">${escapeHtml(lead.email)}</a></p>
          </td></tr>
          ${lead.role ? `<tr><td style="padding:14px 18px;">
            <p style="margin:0 0 4px;font-size:11px;letter-spacing:2px;color:rgba(255,255,255,0.5);text-transform:uppercase;">Studio / school / agency</p>
            <p style="margin:0;font-size:15px;color:#fafafa;">${escapeHtml(lead.role)}</p>
          </td></tr>` : ""}
        </table>
        <p style="margin:20px 0 0;font-size:13px;color:rgba(255,255,255,0.55);line-height:1.6;">Hit <strong style="color:#fafafa;">Reply</strong> to write back to ${escapeHtml(lead.email)} directly.</p>
      </td></tr>
      <tr><td style="padding:16px 32px 24px;border-top:1px solid rgba(255,255,255,0.06);">
        <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.35);">Sent automatically from useoffloader.com</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

function buildText(lead: Lead) {
  const lines = [
    "New Offloadr beta signup",
    "",
    `Email: ${lead.email}`,
  ];
  if (lead.role) lines.push(`Studio/school/agency: ${lead.role}`);
  lines.push("", `Reply to this email to write back to ${lead.email} directly.`);
  return lines.join("\n");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }
  const lead = parsed.data;

  if (isDuplicate(lead.email)) {
    return res.status(200).json({ ok: true, deduped: true });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.OFFLOADR_LEAD_TO_EMAIL;
  const from = process.env.OFFLOADR_LEAD_FROM_EMAIL;

  if (!apiKey || !to || !from) {
    console.error("waitlist: missing env vars", {
      hasKey: !!apiKey,
      hasTo: !!to,
      hasFrom: !!from,
    });
    return res
      .status(500)
      .json({ error: "Waitlist is temporarily unavailable. Please try again shortly." });
  }

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from,
      to,
      replyTo: lead.email,
      subject: `[Offloadr beta] ${lead.email}${lead.role ? ` — ${lead.role}` : ""}`,
      text: buildText(lead),
      html: buildHtml(lead),
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("waitlist: resend error", err);
    return res
      .status(502)
      .json({ error: "Couldn't reach our mail provider. Please try again shortly." });
  }
}
