import { randomInt } from "node:crypto";

/**
 * Unambiguous alphabet: 0/O, 1/I/l, and lowercase removed so a kid
 * reading a code off a whiteboard can't typo their way into the
 * wrong project. 31 symbols x 6 chars = ~887M combinations.
 */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const DEFAULT_LENGTH = 6;

export function generateStudentUploadCode(length: number = DEFAULT_LENGTH): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[randomInt(0, ALPHABET.length)];
  }
  return out;
}

/**
 * Normalises a code received from an untrusted source: trims, drops
 * spaces and dashes, uppercases. Returns null if the result doesn't
 * fit the expected shape. Codes are case-insensitive on the wire so
 * a student can type lower-case without losing access.
 */
export function normalizeStudentUploadCode(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const cleaned = input.replace(/[\s-]+/g, "").toUpperCase();
  if (cleaned.length < 4 || cleaned.length > 16) return null;
  for (const ch of cleaned) {
    if (!ALPHABET.includes(ch)) return null;
  }
  return cleaned;
}
