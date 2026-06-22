import crypto from "node:crypto";

// Salted SHA-256 of a caller IP. Used for audit logs and student session
// records so we never persist raw IPs of minors. The salt is per-deploy,
// not per-org — that's a deliberate v1 simplification. Per-org salting
// can come later if/when we surface IPs to org admins for incident
// response.
//
// Salt source priority:
//   1. IP_HASH_SALT  (preferred; rotate independently of session secret)
//   2. SESSION_SECRET (already required to be >= 32 chars in prod)
//   3. fallback string for dev only — emits a one-time warning at boot
//      via the logger when chosen.
const SALT =
  process.env["IP_HASH_SALT"] ??
  process.env["SESSION_SECRET"] ??
  "offloadr-dev-ip-salt-do-not-use-in-prod";

export function hashIp(ip: string | undefined | null): string | null {
  if (!ip) return null;
  return crypto.createHash("sha256").update(`${SALT}:${ip}`).digest("hex");
}
