import rateLimit, { ipKeyGenerator, type RateLimitRequestHandler } from "express-rate-limit";
import type { Request } from "express";

/**
 * Rate limiters for auth-adjacent endpoints. Pilot-grade — generous enough
 * not to lock real users out of legitimate retries, tight enough to make a
 * brute-force attempt from a single IP/account immediately unproductive.
 *
 * All limiters key on IP + (where applicable) submitted email so a single
 * IP behind NAT can't lock out an account by hammering the wrong password,
 * and a single attacker can't bypass the limit by rotating emails.
 *
 * Disable in test contexts by setting `DISABLE_RATE_LIMIT=1` so the cross-
 * tenant isolation script can run without tripping limits.
 */

const DISABLED = process.env["DISABLE_RATE_LIMIT"] === "1";

function emailFromBody(req: Request): string {
  const body = req.body as { email?: unknown } | undefined;
  if (body && typeof body.email === "string") {
    return body.email.toLowerCase().trim();
  }
  return "";
}

function ipKey(req: Request): string {
  // Use the rate-limiter's IPv6-safe helper so :: addresses don't all collapse to one bucket.
  return ipKeyGenerator(req.ip ?? "unknown");
}

function noopMiddleware(): RateLimitRequestHandler {
  // Returned only when DISABLE_RATE_LIMIT=1 (tests / tenancy isolation script).
  // Cast keeps the call sites type-clean.
  const handler = ((_req: unknown, _res: unknown, next: () => void) => next()) as unknown;
  return handler as RateLimitRequestHandler;
}

/**
 * Login limiter (IP-only ceiling) — 100 attempts per IP per 15 minutes.
 * Defends against credential-stuffing where one attacker rotates emails
 * from a single IP. Sized generously so a school behind one NAT IP can
 * still log a normal day's worth of users in.
 */
export const loginIpRateLimiter: RateLimitRequestHandler = DISABLED
  ? noopMiddleware()
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 100,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      keyGenerator: (req) => `loginIp:${ipKey(req as Request)}`,
      message: {
        error: "Too Many Requests",
        message: "Too many login attempts from this address. Try again in 15 minutes.",
      },
    });

/**
 * Login limiter — 10 attempts per IP+email per 15 minutes. A real user who
 * fat-fingers their password a couple of times stays well under; a script
 * trying common passwords gets shut down quickly.
 */
export const loginRateLimiter: RateLimitRequestHandler = DISABLED
  ? noopMiddleware()
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 10,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      keyGenerator: (req) => `login:${ipKey(req as Request)}:${emailFromBody(req as Request)}`,
      message: {
        error: "Too Many Requests",
        message:
          "Too many login attempts. Wait 15 minutes before trying again, or contact your school admin to reset your password.",
      },
    });

/**
 * Registration limiter — 5 new accounts per IP per hour. A school onboarding
 * a few teachers stays under; a script signing up garbage accounts hits the
 * wall fast.
 */
export const registerRateLimiter: RateLimitRequestHandler = DISABLED
  ? noopMiddleware()
  : rateLimit({
      windowMs: 60 * 60 * 1000,
      limit: 5,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      keyGenerator: (req) => `register:${ipKey(req as Request)}`,
      message: {
        error: "Too Many Requests",
        message: "Too many sign-ups from this address. Try again in an hour.",
      },
    });

/**
 * Student code resolve limiter — 60 lookups per IP per minute. Defends the
 * public `/student-upload/codes/:code` endpoint from a script that wants
 * to enumerate codes by brute force. With a 6-char alphabet of 31 symbols
 * that's ~887M combinations; this limiter makes any meaningful sweep
 * impossible while still letting a classroom of 30 students legitimately
 * type the same code in rapid succession.
 */
export const studentCodeResolveLimiter: RateLimitRequestHandler = DISABLED
  ? noopMiddleware()
  : rateLimit({
      windowMs: 60 * 1000,
      limit: 60,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      keyGenerator: (req) => `studentCodeResolve:${ipKey(req as Request)}`,
      message: {
        error: "Too Many Requests",
        message: "Too many code lookups. Wait a minute and try again.",
      },
    });

/**
 * Student upload limiter — 30 uploads per IP+code per 15 minutes. Caps the
 * blast radius of someone abusing a leaked code while leaving plenty of
 * room for a real student to retry a stalled upload.
 */
export const studentCodeUploadLimiter: RateLimitRequestHandler = DISABLED
  ? noopMiddleware()
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 30,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      keyGenerator: (req) => {
        const raw = (req as Request).params["code"];
        const code = typeof raw === "string" ? raw.toUpperCase() : "unknown";
        return `studentCodeUpload:${ipKey(req as Request)}:${code}`;
      },
      message: {
        error: "Too Many Requests",
        message: "Too many uploads in a short window. Wait 15 minutes and try again.",
      },
    });

/**
 * Student upload IP cap — 60 upload attempts per IP per 15 minutes,
 * regardless of which code is in the URL. Prevents a single attacker
 * from bypassing `studentCodeUploadLimiter` by rotating bogus codes,
 * which would otherwise let them keep opening multipart bodies and
 * exhaust disk/bandwidth on the API host.
 */
export const studentCodeUploadIpLimiter: RateLimitRequestHandler = DISABLED
  ? noopMiddleware()
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 60,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      keyGenerator: (req) => `studentCodeUploadIp:${ipKey(req as Request)}`,
      message: {
        error: "Too Many Requests",
        message: "Too many upload attempts from your network. Wait 15 minutes and try again.",
      },
    });

/**
 * Student login — outer IP ceiling. 100 attempts per IP per 15 min. Sized
 * so a school's NAT IP can log a normal cohort in without tripping.
 */
function studentUsernameFromBody(req: Request): string {
  const body = req.body as { username?: unknown } | undefined;
  if (body && typeof body.username === "string") {
    return body.username.toLowerCase().trim();
  }
  return "";
}

// Stage 2.1: usernames are unique only within an organisation, so the
// per-(IP, username) limiter must also key on the org slug. Otherwise
// ava.t6@SchoolA's typos lock out ava.t6@SchoolB.
function studentOrgSlugFromBody(req: Request): string {
  const body = req.body as { organizationSlug?: unknown } | undefined;
  if (body && typeof body.organizationSlug === "string") {
    return body.organizationSlug.toLowerCase().trim();
  }
  return "";
}

export const studentLoginIpRateLimiter: RateLimitRequestHandler = DISABLED
  ? noopMiddleware()
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 100,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      keyGenerator: (req) => `studentLoginIp:${ipKey(req as Request)}`,
      message: {
        error: "Too Many Requests",
        message:
          "Too many login attempts from this network. Try again in 15 minutes.",
      },
    });

/**
 * Student login — IP+username limiter. 10 attempts per IP per username
 * per 15 min. The DB-backed per-username lockout in
 * student_accounts.locked_until is the real defense; this is the HTTP-
 * edge absorber that drops scripted hammering before it ever touches
 * the DB.
 */
export const studentLoginUsernameRateLimiter: RateLimitRequestHandler = DISABLED
  ? noopMiddleware()
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 10,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      keyGenerator: (req) =>
        `studentLoginUsername:${ipKey(req as Request)}:${studentOrgSlugFromBody(req as Request)}:${studentUsernameFromBody(req as Request)}`,
      message: {
        error: "Too Many Requests",
        message:
          "Too many login attempts. Ask your teacher to reset your password.",
      },
    });

/**
 * Student change-password — 5 attempts per IP per 15 min. Defends against
 * a stolen short-lived session being used to brute-force the current
 * password offline.
 */
export const studentChangePasswordRateLimiter: RateLimitRequestHandler = DISABLED
  ? noopMiddleware()
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 5,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      keyGenerator: (req) => `studentChangePw:${ipKey(req as Request)}`,
      message: {
        error: "Too Many Requests",
        message:
          "Too many password change attempts. Wait 15 minutes and try again.",
      },
    });

/**
 * Password-reset limiter — 10 admin-triggered resets per IP per hour. Stops
 * a compromised admin session from being used to mass-reset every member.
 */
export const passwordResetRateLimiter: RateLimitRequestHandler = DISABLED
  ? noopMiddleware()
  : rateLimit({
      windowMs: 60 * 60 * 1000,
      limit: 10,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      keyGenerator: (req) => `passwordReset:${ipKey(req as Request)}`,
      message: {
        error: "Too Many Requests",
        message: "Too many password resets in a short window. Try again in an hour.",
      },
    });
