import { Request, Response, NextFunction } from "express";
import { db, organizationMembershipsTable } from "@workspace/db";
import { and, asc, desc, eq } from "drizzle-orm";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (typeof req.session.userId !== "number") {
    res.status(401).json({ error: "Unauthorized", message: "You must be logged in" });
    return;
  }
  next();
}

export function getUserId(req: Request): number | null {
  const id = req.session.userId;
  return typeof id === "number" ? id : null;
}

export function getOrganizationId(req: Request): number | null {
  const id = req.session.organizationId;
  return typeof id === "number" ? id : null;
}

/**
 * Resolve the caller's active organization. If the session already has
 * `organizationId`, re-verify membership against the DB (defends against
 * stale sessions). Otherwise pick the user's owner membership if any,
 * else their oldest membership, and persist it on the session.
 *
 * The "active org" is server-resolved — never trust an `organizationId`
 * supplied by the client in the body, query string, or URL.
 */
export async function requireOrganization(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const userId = req.session.userId;
  if (typeof userId !== "number") {
    res.status(401).json({ error: "Unauthorized", message: "You must be logged in" });
    return;
  }

  let organizationId = req.session.organizationId;

  if (typeof organizationId !== "number") {
    // Prefer the org the user owns; deterministically tiebreak by oldest
    // membership so the same user always lands in the same org.
    const memberships = await db
      .select({
        organizationId: organizationMembershipsTable.organizationId,
        isOwner: organizationMembershipsTable.isOwner,
        createdAt: organizationMembershipsTable.createdAt,
      })
      .from(organizationMembershipsTable)
      .where(eq(organizationMembershipsTable.userId, userId))
      .orderBy(
        desc(organizationMembershipsTable.isOwner),
        asc(organizationMembershipsTable.createdAt),
        asc(organizationMembershipsTable.id),
      );

    const fallback = memberships[0];
    if (!fallback) {
      res.status(403).json({ error: "Forbidden", message: "User is not a member of any organization" });
      return;
    }
    organizationId = fallback.organizationId;
    req.session.organizationId = organizationId;
  } else {
    const [membership] = await db
      .select({ id: organizationMembershipsTable.id })
      .from(organizationMembershipsTable)
      .where(
        and(
          eq(organizationMembershipsTable.userId, userId),
          eq(organizationMembershipsTable.organizationId, organizationId),
        ),
      )
      .limit(1);
    if (!membership) {
      res.status(403).json({ error: "Forbidden", message: "You are not a member of this organization" });
      return;
    }
  }

  next();
}
