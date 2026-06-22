import crypto from "node:crypto";

/**
 * Device API key handling for the Mac Mini Helper.
 *
 * We never persist the plaintext bearer token. At pairing time we
 * generate 32 random bytes, hand the base64url representation to the
 * Helper exactly once (it stores it in Apple Keychain), and persist
 * only the sha256 hex digest in `helper_devices.api_key_hash`.
 *
 * sha256 is fine here — these are 256-bit high-entropy random tokens,
 * not passwords. Constant-time comparison is unnecessary because the
 * lookup is an indexed unique key, but we still avoid logging or
 * echoing the plaintext anywhere.
 */
const TOKEN_BYTES = 32;

export interface GeneratedDeviceToken {
  plaintext: string;
  hash: string;
}

export function generateDeviceToken(): GeneratedDeviceToken {
  const buf = crypto.randomBytes(TOKEN_BYTES);
  const plaintext = buf
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return { plaintext, hash: hashDeviceToken(plaintext) };
}

export function hashDeviceToken(plaintext: string): string {
  return crypto.createHash("sha256").update(plaintext).digest("hex");
}

const BEARER_PREFIX = /^Bearer\s+/i;

export function extractBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  if (!BEARER_PREFIX.test(header)) return null;
  const token = header.replace(BEARER_PREFIX, "").trim();
  return token.length > 0 ? token : null;
}
