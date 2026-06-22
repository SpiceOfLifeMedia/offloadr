import { Router, type IRouter } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import {
  db,
  organizationsTable,
  studentAccountsTable,
  studentSessionsTable,
} from "@workspace/db";
import { parseBody } from "../lib/validate";
import {
  STUDENT_COOKIE_NAME,
  STUDENT_SESSION_ABSOLUTE_MS,
  clearStudentSessionCookie,
  destroyOtherStudentSessions,
  destroyStudentSessionFromCookie,
  generateStudentSessionToken,
  hashStudentSessionToken,
  requireStudent,
  setStudentSessionCookie,
} from "../lib/student-auth";
import { hashIp } from "../lib/ipHash";
import { logActivityRich, logStudentAuthEvent } from "../lib/activity";
import {
  studentChangePasswordRateLimiter,
  studentLoginIpRateLimiter,
  studentLoginUsernameRateLimiter,
} from "../lib/rateLimit";

const router: IRouter = Router();

// DB-backed per-username lockout. The HTTP rate limiter is the outer
// edge defense; this is the inner one that holds even if an attacker
// rotates IPs.
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

// A real bcrypt hash of an unguessable random string. Used to keep the
// timing of "user not found" close to the timing of "wrong password"
// so an attacker can't enumerate valid usernames by response time.
// The hash itself never validates anything — bcrypt.compare against it
// will always return false.
const DUMMY_BCRYPT_HASH =
  "$2b$12$CmTzPb6.JeJ5T6Z0VrJZWuKj9rRkkP1q7XK/QYa6FzNJ5z7r8gZqK";

// Login requires an organisation discriminator. Without it, two students
// in different schools who happen to share a username (e.g. ava.t6 at
// School A and ava.t6 at School B) are ambiguous to the server. The
// schema's UNIQUE (organization_id, username) intentionally allows the
// collision; the login flow MUST resolve which org first.
const loginSchema = z.object({
  organizationSlug: z
    .string()
    .trim()
    .min(1, "School code is required")
    .max(80)
    .transform((s) => s.toLowerCase()),
  username: z
    .string()
    .trim()
    .min(1, "Username is required")
    .max(80)
    .transform((s) => s.toLowerCase()),
  password: z.string().min(1, "Password is required").max(200),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(200),
});

router.post(
  "/student/auth/login",
  studentLoginIpRateLimiter,
  studentLoginUsernameRateLimiter,
  async (req, res): Promise<void> => {
    const body = parseBody(req, res, loginSchema);
    if (!body) return;

    const ipHash = hashIp(req.ip);

    // Resolve the org first. We deliberately treat "unknown org" and
    // "unknown username" with the same generic error + the same bcrypt
    // burn so an attacker cannot enumerate valid school slugs.
    const [organization] = await db
      .select({ id: organizationsTable.id, status: organizationsTable.status })
      .from(organizationsTable)
      .where(eq(organizationsTable.slug, body.organizationSlug))
      .limit(1);

    const respondGenericFailure = (): void => {
      res.status(401).json({
        error: "Unauthorized",
        message:
          "Invalid school code, username, or password. Ask your teacher if you're stuck.",
      });
    };

    if (!organization || organization.status !== "active") {
      // Burn bcrypt work so timing of unknown-org vs wrong-password is
      // indistinguishable. Also log so admins can spot enumeration.
      await bcrypt.compare(body.password, DUMMY_BCRYPT_HASH);
      req.log.info(
        {
          event: "student_login_failed",
          reason: "unknown_or_inactive_org",
          organizationSlug: body.organizationSlug,
        },
        "Student login failed",
      );
      // No org → audit at org_id=null so forensics can spot slug-enum
      // sweeps. Normalised slug goes in the message; actor_kind=system.
      await logActivityRich({
        action: "student_login_failed",
        message: `Login failed — unknown or inactive organization slug "${body.organizationSlug}"`,
        actorKind: "system",
        organizationId: null,
        ipHash,
      });
      respondGenericFailure();
      return;
    }

    // Tenant-scoped student lookup. Note the AND on organization_id —
    // this is the fix the architect flagged as CRITICAL in Stage 2.
    const [student] = await db
      .select()
      .from(studentAccountsTable)
      .where(
        and(
          eq(studentAccountsTable.organizationId, organization.id),
          eq(studentAccountsTable.username, body.username),
        ),
      )
      .limit(1);

    const now = new Date();

    if (!student || student.status !== "active") {
      await bcrypt.compare(body.password, DUMMY_BCRYPT_HASH);
      req.log.info(
        {
          event: "student_login_failed",
          reason: "no_such_or_inactive_student",
          organizationId: organization.id,
        },
        "Student login failed",
      );
      await logStudentAuthEvent({
        action: "student_login_failed",
        message: `Login failed for "${body.username}" — unknown or inactive student`,
        organizationId: organization.id,
        ipHash,
      });
      respondGenericFailure();
      return;
    }

    if (student.lockedUntil && student.lockedUntil.getTime() > now.getTime()) {
      await bcrypt.compare(body.password, DUMMY_BCRYPT_HASH);
      req.log.info(
        { event: "student_login_locked", studentId: student.id },
        "Locked student attempted login",
      );
      await logStudentAuthEvent({
        action: "student_login_locked_attempt",
        message: `Login attempted on locked account "${student.username}"`,
        organizationId: organization.id,
        studentAccountId: student.id,
        ipHash,
      });
      respondGenericFailure();
      return;
    }

    const ok = await bcrypt.compare(body.password, student.passwordHash);
    if (!ok) {
      const newCount = student.failedLoginCount + 1;
      const shouldLock = newCount >= LOCKOUT_THRESHOLD;
      await db
        .update(studentAccountsTable)
        .set({
          failedLoginCount: shouldLock ? 0 : newCount,
          lockedUntil: shouldLock
            ? new Date(now.getTime() + LOCKOUT_DURATION_MS)
            : student.lockedUntil,
        })
        .where(eq(studentAccountsTable.id, student.id));
      if (shouldLock) {
        req.log.warn(
          { event: "student_login_locked_now", studentId: student.id },
          "Student account auto-locked after repeated failures",
        );
        await logStudentAuthEvent({
          action: "student_account_locked",
          message: `Account "${student.username}" auto-locked after ${LOCKOUT_THRESHOLD} failed attempts`,
          organizationId: organization.id,
          studentAccountId: student.id,
          ipHash,
        });
      } else {
        req.log.info(
          {
            event: "student_login_bad_password",
            studentId: student.id,
            failedLoginCount: newCount,
          },
          "Student login failed",
        );
        await logStudentAuthEvent({
          action: "student_login_failed",
          message: `Login failed for "${student.username}" — bad password (${newCount}/${LOCKOUT_THRESHOLD})`,
          organizationId: organization.id,
          studentAccountId: student.id,
          ipHash,
        });
      }
      respondGenericFailure();
      return;
    }

    // Success — clear counters, issue a fresh session.
    const { raw, hashed } = generateStudentSessionToken();
    const expiresAt = new Date(now.getTime() + STUDENT_SESSION_ABSOLUTE_MS);

    await db
      .update(studentAccountsTable)
      .set({
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: now,
      })
      .where(eq(studentAccountsTable.id, student.id));

    const uaHeader = req.headers["user-agent"];
    const userAgent =
      typeof uaHeader === "string" ? uaHeader.slice(0, 500) : null;

    await db.insert(studentSessionsTable).values({
      id: hashed,
      studentAccountId: student.id,
      organizationId: student.organizationId,
      createdAt: now,
      lastSeenAt: now,
      expiresAt,
      ipHash,
      userAgent,
    });

    setStudentSessionCookie(res, raw, expiresAt);
    req.log.info(
      {
        event: "student_login_ok",
        studentId: student.id,
        organizationId: student.organizationId,
      },
      "Student login",
    );
    await logStudentAuthEvent({
      action: "student_login_ok",
      message: `Student "${student.username}" logged in`,
      organizationId: student.organizationId,
      studentAccountId: student.id,
      ipHash,
    });
    res.json({
      id: student.id,
      username: student.username,
      displayName: student.displayName,
      passwordMustChange: student.passwordMustChange,
      organizationId: student.organizationId,
      organizationSlug: student.organizationSlug,
      organizationName: student.organizationName,
      // sessionToken is used by the mobile app (React Native) to store the
      // session manually — browsers use the Set-Cookie header automatically.
      sessionToken: (req as any).sessionID ?? "",
    });
  },
);

router.post("/student/auth/logout", async (req, res): Promise<void> => {
  // Capture context BEFORE we destroy the session so the audit row can
  // attribute the logout to the right student/org.
  const ipHash = hashIp(req.ip);
  // Cheap lookup of cookie → session row for audit context. We don't
  // require it; if the cookie is already gone we just clear and return.
  const cookieHeader = req.headers.cookie;
  let auditCtx: { studentAccountId: number; organizationId: number } | null =
    null;
  if (cookieHeader) {
    const match = cookieHeader
      .split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith(`${STUDENT_COOKIE_NAME}=`));
    if (match) {
      const raw = decodeURIComponent(match.substring(STUDENT_COOKIE_NAME.length + 1));
      const hashed = hashStudentSessionToken(raw);
      const [row] = await db
        .select({
          studentAccountId: studentSessionsTable.studentAccountId,
          organizationId: studentSessionsTable.organizationId,
        })
        .from(studentSessionsTable)
        .where(eq(studentSessionsTable.id, hashed))
        .limit(1);
      if (row) auditCtx = row;
    }
  }

  await destroyStudentSessionFromCookie(req);
  clearStudentSessionCookie(res);

  if (auditCtx) {
    await logStudentAuthEvent({
      action: "student_logout",
      message: "Student logged out",
      organizationId: auditCtx.organizationId,
      studentAccountId: auditCtx.studentAccountId,
      ipHash,
    });
  }
  res.json({ message: "Logged out" });
});

router.get("/student/me", requireStudent, async (req, res): Promise<void> => {
  const ctx = req.student!;
  const [student] = await db
    .select()
    .from(studentAccountsTable)
    .where(eq(studentAccountsTable.id, ctx.studentAccountId))
    .limit(1);

  if (!student) {
    res
      .status(401)
      .json({ error: "Unauthorized", message: "Student not found" });
    return;
  }

  res.json({
    id: student.id,
    username: student.username,
    displayName: student.displayName,
    givenName: student.givenName,
    familyName: student.familyName,
    passwordMustChange: student.passwordMustChange,
    organizationId: student.organizationId,
  });
});

router.post(
  "/student/auth/change-password",
  studentChangePasswordRateLimiter,
  requireStudent,
  async (req, res): Promise<void> => {
    const body = parseBody(req, res, changePasswordSchema);
    if (!body) return;
    const ctx = req.student!;
    const ipHash = hashIp(req.ip);

    const [student] = await db
      .select()
      .from(studentAccountsTable)
      .where(eq(studentAccountsTable.id, ctx.studentAccountId))
      .limit(1);
    if (!student) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const ok = await bcrypt.compare(body.currentPassword, student.passwordHash);
    if (!ok) {
      req.log.info(
        { event: "student_change_password_bad_current", studentId: student.id },
        "Student change-password bad current",
      );
      await logStudentAuthEvent({
        action: "student_change_password_failed",
        message: `Change-password failed for "${student.username}" — wrong current password`,
        organizationId: student.organizationId,
        studentAccountId: student.id,
        ipHash,
      });
      res.status(401).json({
        error: "Unauthorized",
        message: "Current password is incorrect.",
      });
      return;
    }

    const sameAsOld = await bcrypt.compare(
      body.newPassword,
      student.passwordHash,
    );
    if (sameAsOld) {
      res.status(400).json({
        error: "Bad Request",
        message:
          "Please choose a new password that's different from your current one.",
      });
      return;
    }

    const newHash = await bcrypt.hash(body.newPassword, 12);
    await db
      .update(studentAccountsTable)
      .set({ passwordHash: newHash, passwordMustChange: false })
      .where(eq(studentAccountsTable.id, student.id));

    // Force a re-login on any OTHER device this student is signed in
    // on, so a stolen session tied to the old password is invalidated.
    await destroyOtherStudentSessions(student.id, ctx.sessionId);

    req.log.info(
      { event: "student_change_password_ok", studentId: student.id },
      "Student changed password",
    );
    await logStudentAuthEvent({
      action: "student_password_changed",
      message: `Student "${student.username}" changed their password; other sessions revoked`,
      organizationId: student.organizationId,
      studentAccountId: student.id,
      ipHash,
    });
    res.json({ message: "Password updated" });
  },
);

export default router;
