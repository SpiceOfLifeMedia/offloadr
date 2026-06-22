import { db, activityLogsTable } from "@workspace/db";

// ---------------------------------------------------------------------------
// Activity / audit log writer.
//
// As of Stage 2.1 the activity_logs table records *who* acted (actor_kind),
// optionally which student account (actor_student_account_id), the org the
// event belongs to (organization_id), and a salted-hash of the caller IP
// (ip_hash). The DB enforces actor_kind NOT NULL; this module is the only
// supported way for application code to insert rows so the contract holds.
//
// Existing project-scoped call sites keep their old positional signature
// and get actor_kind auto-inferred from userId (user vs system). Student
// auth and other org-scoped events go through logStudentAuthEvent() or the
// expanded object form below.
// ---------------------------------------------------------------------------

export type ActivityActorKind = "user" | "student_account" | "system";

export type LogActivityInput = {
  action: string;
  message: string;
  actorKind: ActivityActorKind;
  projectId?: number | null;
  organizationId?: number | null;
  userId?: number | null;
  actorStudentAccountId?: number | null;
  ipHash?: string | null;
};

async function insertActivity(input: LogActivityInput): Promise<void> {
  await db.insert(activityLogsTable).values({
    projectId: input.projectId ?? null,
    organizationId: input.organizationId ?? null,
    userId: input.userId ?? null,
    actorKind: input.actorKind,
    actorStudentAccountId: input.actorStudentAccountId ?? null,
    ipHash: input.ipHash ?? null,
    action: input.action,
    message: input.message,
  });
}

/**
 * Project-scoped activity log. Backwards-compatible with the pre-Stage 2.1
 * positional signature so existing call sites do not have to change. The
 * actor_kind column (required by the DB) is auto-inferred:
 *   - userId present  → 'user'
 *   - userId absent   → 'system'
 *
 * If you have richer context (organization id, hashed IP), prefer
 * logActivityRich() below.
 */
export async function logActivity(
  projectId: number,
  action: string,
  message: string,
  userId?: number,
): Promise<void> {
  await insertActivity({
    projectId,
    action,
    message,
    actorKind: userId ? "user" : "system",
    userId: userId ?? null,
  });
}

/**
 * Full-object form for callers that want to provide organization_id, the
 * caller's hashed IP, or non-user actors. New code should prefer this.
 */
export async function logActivityRich(input: LogActivityInput): Promise<void> {
  await insertActivity(input);
}

/**
 * Audit log for a student-auth event (login, logout, lockout, password
 * change, etc.). These events are not tied to a project, only to an org
 * and a student account. Raw IPs of minors are never stored — callers
 * must pass an already-hashed IP from hashIp(req.ip).
 */
export async function logStudentAuthEvent(input: {
  action: string;
  message: string;
  organizationId: number;
  studentAccountId?: number | null;
  ipHash?: string | null;
}): Promise<void> {
  await insertActivity({
    action: input.action,
    message: input.message,
    actorKind: "student_account",
    organizationId: input.organizationId,
    actorStudentAccountId: input.studentAccountId ?? null,
    ipHash: input.ipHash ?? null,
  });
}
