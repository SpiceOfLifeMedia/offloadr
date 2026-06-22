import type { Request, Response, NextFunction } from "express";
import { db, organizationMembershipsTable, type OrganizationMembership } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { getOrganizationId, getUserId } from "./auth";

/**
 * Permissions helper layer (V1).
 *
 * Single source of truth for "can this membership do X?" decisions.
 * Routes should never compare `role` strings inline — always go through
 * one of these intent-based predicates so that when the role matrix
 * expands (V2: owner/teacher/editor/etc), only this file changes.
 *
 * V1 role matrix:
 *   admin    — full org control. Can manage org settings, projects,
 *              memberships, sessions. Required role for org-level
 *              destructive actions.
 *   producer — can create/manage their own projects, run recording
 *              sessions, see Producer Mode for projects in their org.
 *   student  — read-only Producer Mode for sessions they're attached
 *              to as a participant. No project mutation.
 *
 * The `is_owner` flag is a marker, not a role. It identifies the admin
 * who created the org. Used only for actions that must remain with a
 * single individual (e.g. delete-the-org). Do not introduce a fourth
 * role for it.
 */

export interface MembershipLike {
  role: "admin" | "producer" | "student";
  isOwner: boolean;
}

export function canManageOrganization(m: MembershipLike): boolean {
  return m.role === "admin";
}

export function canDeleteOrganization(m: MembershipLike): boolean {
  return m.role === "admin" && m.isOwner;
}

export function canManageProjects(m: MembershipLike): boolean {
  return m.role === "admin" || m.role === "producer";
}

export function canRunSessions(m: MembershipLike): boolean {
  return m.role === "admin" || m.role === "producer";
}

export function canViewProducerMode(m: MembershipLike): boolean {
  return m.role === "admin" || m.role === "producer" || m.role === "student";
}

export function canManageMembers(m: MembershipLike): boolean {
  return m.role === "admin";
}

/**
 * Pairing and managing Mac Mini Helper devices. V1: admin only.
 * Producers can run sessions against an already-paired device, but
 * only an admin can introduce a new long-lived credential into the
 * org — the same way only an admin manages members.
 */
export function canManageHelperDevices(m: MembershipLike): boolean {
  return m.role === "admin";
}

/**
 * Load the caller's membership in the active org. Returns null if the
 * user is not a member. Routes should call this once per request and
 * pass the result to the helpers above.
 */
export async function loadMembership(
  userId: number,
  organizationId: number,
): Promise<MembershipLike | null> {
  const [row] = await db
    .select({
      role: organizationMembershipsTable.role,
      isOwner: organizationMembershipsTable.isOwner,
    })
    .from(organizationMembershipsTable)
    .where(
      and(
        eq(organizationMembershipsTable.userId, userId),
        eq(organizationMembershipsTable.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (!row) return null;
  return { role: row.role, isOwner: row.isOwner };
}

export type { OrganizationMembership };

/**
 * Express middleware factory: enforces a role-based predicate against the
 * caller's active-org membership. MUST be used downstream of `requireAuth`
 * and `requireOrganization` so that `req.session.userId` and
 * `req.session.organizationId` are guaranteed to be set.
 *
 * Usage:
 *   router.post(
 *     "/projects",
 *     requireAuth,
 *     requireOrganization,
 *     requireRole(canManageProjects),
 *     async (req, res) => { ... },
 *   );
 *
 * Adds one indexed lookup per request. If hot, cache `req` membership
 * across middlewares — for V1 this single query is fine.
 */
export function requireRole(check: (m: MembershipLike) => boolean) {
  return async function requireRoleMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const userId = getUserId(req);
    const organizationId = getOrganizationId(req);
    if (typeof userId !== "number" || typeof organizationId !== "number") {
      // Should never happen if requireAuth + requireOrganization ran first.
      res.status(401).json({ error: "Unauthorized", message: "Authentication required" });
      return;
    }
    const membership = await loadMembership(userId, organizationId);
    if (!membership) {
      res.status(403).json({ error: "Forbidden", message: "You are not a member of this organization" });
      return;
    }
    if (!check(membership)) {
      res.status(403).json({
        error: "Forbidden",
        message: "Your role does not allow this action",
      });
      return;
    }
    next();
  };
}
