import crypto from "crypto";

/**
 * Short-lived signed grant that authorizes a single student-upload
 * session for a specific code.
 *
 * Resolve(code) mints a grant; upload(code, file) requires the grant
 * and verifies it server-side. The grant binds the upload to the
 * exact `codeId` resolved at issue time, so a stale grant can't be
 * reused against a different code, and clients can't fabricate one
 * without `SESSION_SECRET`.
 */
const GRANT_TTL_SECONDS = 30 * 60;

/**
 * `SESSION_SECRET` is required in every environment for student upload
 * grants. The Express session middleware (see `src/app.ts`) tolerates a
 * generated dev fallback when `NODE_ENV !== "production"`, but we
 * intentionally do NOT mirror that here: a per-process random secret
 * would invalidate every issued grant on each restart, and a hard-coded
 * dev secret would let anyone with the source forge grants. The
 * deployed Fly app already injects `SESSION_SECRET`, and local dev
 * picks it up from Replit Secrets, so a missing value indicates a
 * genuine misconfiguration that should fail loudly.
 */
function getSecret(): string {
  const s = process.env["SESSION_SECRET"];
  if (!s || s.length < 16) {
    throw new Error(
      "SESSION_SECRET must be set (>=16 chars) to issue student upload grants. " +
        "Set it via Replit Secrets in development or `flyctl secrets set` in production.",
    );
  }
  return s;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function fromB64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export interface UploadGrantPayload {
  codeId: number;
  exp: number;
}

export function signUploadGrant(codeId: number): { token: string; expiresAt: string } {
  const exp = Math.floor(Date.now() / 1000) + GRANT_TTL_SECONDS;
  const payload: UploadGrantPayload = { codeId, exp };
  const body = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const mac = crypto.createHmac("sha256", getSecret()).update(body).digest();
  const sig = b64url(mac);
  return {
    token: `${body}.${sig}`,
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}

export function verifyUploadGrant(
  token: unknown,
  expectedCodeId: number,
): { ok: true } | { ok: false; reason: string } {
  if (typeof token !== "string" || token.length === 0) {
    return { ok: false, reason: "missing" };
  }
  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, reason: "malformed" };
  const [body, sig] = parts as [string, string];
  let expectedMac: Buffer;
  try {
    expectedMac = crypto.createHmac("sha256", getSecret()).update(body).digest();
  } catch {
    return { ok: false, reason: "server_misconfigured" };
  }
  let providedMac: Buffer;
  try {
    providedMac = fromB64url(sig);
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (
    providedMac.length !== expectedMac.length ||
    !crypto.timingSafeEqual(providedMac, expectedMac)
  ) {
    return { ok: false, reason: "bad_signature" };
  }
  let payload: UploadGrantPayload;
  try {
    payload = JSON.parse(fromB64url(body).toString("utf8")) as UploadGrantPayload;
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (typeof payload.codeId !== "number" || typeof payload.exp !== "number") {
    return { ok: false, reason: "malformed" };
  }
  if (payload.codeId !== expectedCodeId) {
    return { ok: false, reason: "code_mismatch" };
  }
  if (Math.floor(Date.now() / 1000) >= payload.exp) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true };
}
