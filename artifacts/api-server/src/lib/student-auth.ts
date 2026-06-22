import type { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";
import { and, eq, ne } from "drizzle-orm";
import {
  db,
  studentAccountsTable,
  studentSessionsTable,
} from "@workspace/db";

// Student auth is intentionally separate from the teacher/admin
// express-session system. Different cookie name, different middleware,
// different storage table. A student cookie can never authenticate a
// teacher route because teacher routes only call requireAuth (which
// looks at req.session.userId) — and vice versa.

export const STUDENT_COOKIE_NAME = "offloadr_student_sid";
// Idle timeout: a student session that has not been used for this many
// ms is treated as expired on next use. Keeps shared-iPad scenarios
// safe.
export const STUDENT_SESSION_IDLE_MS = 30 * 60 * 1000;
// Absolute lifetime: even with continuous use, a session is invalidated
// this long after issue. Bounds the window of a stolen cookie.
export const STUDENT_SESSION_ABSOLUTE_MS = 8 * 60 * 60 * 1000;

export type StudentContext = {
  studentAccountId: number;
  organizationId: number;
  // SHA-256 hash of the raw token; matches studentSessionsTable.id.
  sessionId: string;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      student?: StudentContext;
    }
  }
}

function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function hashStudentSessionToken(rawToken: string): string {
  return sha256Hex(rawToken);
}

export function generateStudentSessionToken(): {
  raw: string;
  hashed: string;
} {
  const raw = crypto.randomBytes(32).toString("hex"); // 64 hex chars
  return { raw, hashed: sha256Hex(raw) };
}

// Tiny inline cookie parser. We only ever read one specific cookie name
// here, so pulling in cookie-parser as a dep is overkill.
function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  const parts = header.split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    if (trimmed.substring(0, eqIdx) === name) {
      try {
        return decodeURIComponent(trimmed.substring(eqIdx + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function setStudentSessionCookie(
  res: Response,
  rawToken: string,
  absoluteExpiresAt: Date,
): void {
  res.cookie(STUDENT_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "lax",
    path: "/",
    expires: absoluteExpiresAt,
  });
}

export function clearStudentSessionCookie(res: Response): void {
  res.clearCookie(STUDENT_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "lax",
    path: "/",
  });
}

// Best-effort cleanup of any current student session cookie, used by
// /student/auth/logout. Always followed by clearStudentSessionCookie.
export async function destroyStudentSessionFromCookie(
  req: Request,
): Promise<void> {
  const raw = readCookie(req.headers.cookie, STUDENT_COOKIE_NAME);
  if (!raw) return;
  const hashed = sha256Hex(raw);
  await db
    .delete(studentSessionsTable)
    .where(eq(studentSessionsTable.id, hashed));
}

export async function requireStudent(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const raw = readCookie(req.headers.cookie, STUDENT_COOKIE_NAME);
  if (!raw) {
    res.status(401).json({
      error: "Unauthorized",
      message: "You must be logged in as a student.",
    });
    return;
  }
  const hashed = sha256Hex(raw);
  const now = new Date();

  const [session] = await db
    .select({
      id: studentSessionsTable.id,
      studentAccountId: studentSessionsTable.studentAccountId,
      organizationId: studentSessionsTable.organizationId,
      lastSeenAt: studentSessionsTable.lastSeenAt,
      expiresAt: studentSessionsTable.expiresAt,
    })
    .from(studentSessionsTable)
    .where(eq(studentSessionsTable.id, hashed))
    .limit(1);

  if (!session) {
    clearStudentSessionCookie(res);
    res.status(401).json({
      error: "Unauthorized",
      message: "Session not found. Please log in again.",
    });
    return;
  }

  if (session.expiresAt.getTime() <= now.getTime()) {
    await db
      .delete(studentSessionsTable)
      .where(eq(studentSessionsTable.id, hashed));
    clearStudentSessionCookie(res);
    res.status(401).json({
      error: "Unauthorized",
      message: "Session expired. Please log in again.",
    });
    return;
  }

  if (now.getTime() - session.lastSeenAt.getTime() > STUDENT_SESSION_IDLE_MS) {
    await db
      .delete(studentSessionsTable)
      .where(eq(studentSessionsTable.id, hashed));
    clearStudentSessionCookie(res);
    res.status(401).json({
      error: "Unauthorized",
      message: "Session idle timeout. Please log in again.",
    });
    return;
  }

  // Re-verify the account is still active on every request. Cheap, and
  // means a teacher suspending a student takes effect on the student's
  // next request — no need to also walk the session table.
  const [student] = await db
    .select({
      id: studentAccountsTable.id,
      status: studentAccountsTable.status,
    })
    .from(studentAccountsTable)
    .where(eq(studentAccountsTable.id, session.studentAccountId))
    .limit(1);

  if (!student || student.status !== "active") {
    await db
      .delete(studentSessionsTable)
      .where(eq(studentSessionsTable.id, hashed));
    clearStudentSessionCookie(res);
    res.status(401).json({
      error: "Unauthorized",
      message: "Account is not active. Ask your teacher.",
    });
    return;
  }

  await db
    .update(studentSessionsTable)
    .set({ lastSeenAt: now })
    .where(eq(studentSessionsTable.id, hashed));

  req.student = {
    studentAccountId: session.studentAccountId,
    organizationId: session.organizationId,
    sessionId: hashed,
  };
  next();
}

export function getStudent(req: Request): StudentContext | null {
  return req.student ?? null;
}

// Destroy every session for a student EXCEPT a specific one. Called on
// change-password so the current device keeps working but any other
// device that has the old password's session is forced to log in again.
export async function destroyOtherStudentSessions(
  studentAccountId: number,
  keepSessionId: string,
): Promise<void> {
  await db
    .delete(studentSessionsTable)
    .where(
      and(
        eq(studentSessionsTable.studentAccountId, studentAccountId),
        ne(studentSessionsTable.id, keepSessionId),
      ),
    );
}
