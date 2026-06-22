import { randomInt } from "node:crypto";

/**
 * Pairing codes for Mac Mini Helper devices. Same unambiguous
 * alphabet as student upload codes so producers reading a code off
 * a screen don't typo their way into a different organisation.
 *
 *   31 symbols ^ 8 chars = ~8.5e11 combinations
 *
 * Pairing codes are short-lived (default 10 minutes) and single-use,
 * so we don't need a giant search space — we just need enough
 * entropy that a code can't be guessed within its TTL.
 */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const DEFAULT_LENGTH = 8;

export function generateHelperPairingCode(length: number = DEFAULT_LENGTH): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[randomInt(0, ALPHABET.length)];
  }
  return out;
}

export function normalizeHelperPairingCode(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const cleaned = input.replace(/[\s-]+/g, "").toUpperCase();
  if (cleaned.length < 6 || cleaned.length > 16) return null;
  for (const ch of cleaned) {
    if (!ALPHABET.includes(ch)) return null;
  }
  return cleaned;
}
