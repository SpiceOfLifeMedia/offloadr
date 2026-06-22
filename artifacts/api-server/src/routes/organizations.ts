import { Router, type IRouter } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import { db, organizationsTable, organizationMembershipsTable, usersTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { requireAuth, requireOrganization, getUserId, getOrganizationId } from "../lib/auth";
import { parseBody } from "../lib/validate";
import { canManageMembers, canManageOrganization, loadMembership } from "../lib/permissions";
import { passwordResetRateLimiter } from "../lib/rateLimit";
import {
  DriveAccessError,
  DriveNotConfiguredError,
  ensureRootFolder,
  getServiceAccountEmail,
  isDriveConfigured,
  verifySharedDriveAccess,
} from "../lib/googleDrive";

const router: IRouter = Router();

const updateOrgSchema = z
  .object({
    displayName: z.union([z.string().trim().max(255), z.null()]).optional(),
    logoUrl: z.union([z.string().trim().max(2048), z.null()]).optional(),
  })
  .strict();

const connectDriveSchema = z.object({
  sharedDriveId: z
    .string()
    .trim()
    .min(8, "Shared Drive ID looks too short")
    .max(128),
});

function serializeOrganization(org: typeof organizationsTable.$inferSelect): Record<string, unknown> {
  // Field name `school` is preserved in the response payload because the
  // frontend UI copy reads as "School". Internally we call it organization.
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    displayName: org.displayName,
    logoUrl: org.logoUrl,
    status: org.status,
    planTier: org.planTier,
    storageMode: org.storageMode,
    driveConnected: Boolean(org.driveSharedDriveId && org.driveRootFolderId),
    driveSharedDriveId: org.driveSharedDriveId,
    driveRootFolderId: org.driveRootFolderId,
    driveConnectedAt: org.driveConnectedAt,
    createdAt: org.createdAt,
    updatedAt: org.updatedAt,
  };
}

async function ensureCanManage(
  userId: number,
  organizationId: number,
): Promise<boolean> {
  const m = await loadMembership(userId, organizationId);
  return m ? canManageOrganization(m) : false;
}

// Both /organizations/me (canonical) and /schools/me (legacy alias) work
// during the rename. Frontend should migrate to /organizations/me.
function registerOrgRoutes(prefix: "/organizations" | "/schools"): void {
  router.get(`${prefix}/me`, requireAuth, requireOrganization, async (req, res): Promise<void> => {
    const organizationId = getOrganizationId(req)!;
    const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, organizationId));
    if (!org) {
      res.status(404).json({ error: "Not Found", message: "School not found" });
      return;
    }
    res.json({
      school: serializeOrganization(org),
      drive: {
        configuredOnServer: isDriveConfigured(),
        serviceAccountEmail: getServiceAccountEmail(),
      },
    });
  });

  router.patch(`${prefix}/me`, requireAuth, requireOrganization, async (req, res): Promise<void> => {
    const userId = getUserId(req)!;
    const organizationId = getOrganizationId(req)!;

    if (!(await ensureCanManage(userId, organizationId))) {
      res.status(403).json({ error: "Forbidden", message: "Only admins can edit the school" });
      return;
    }

    const body = parseBody(req, res, updateOrgSchema);
    if (!body) return;

    const updates: Partial<typeof organizationsTable.$inferInsert> = { updatedAt: new Date() };
    if ("displayName" in body) updates.displayName = body.displayName ?? null;
    if ("logoUrl" in body) updates.logoUrl = body.logoUrl ?? null;

    const [updated] = await db
      .update(organizationsTable)
      .set(updates)
      .where(eq(organizationsTable.id, organizationId))
      .returning();
    res.json({ school: serializeOrganization(updated) });
  });

  router.post(`${prefix}/me/connect-drive`, requireAuth, requireOrganization, async (req, res): Promise<void> => {
    const userId = getUserId(req)!;
    const organizationId = getOrganizationId(req)!;

    if (!(await ensureCanManage(userId, organizationId))) {
      res.status(403).json({ error: "Forbidden", message: "Only admins can connect Drive" });
      return;
    }

    const body = parseBody(req, res, connectDriveSchema);
    if (!body) return;

    try {
      const drive = await verifySharedDriveAccess(body.sharedDriveId);
      const root = await ensureRootFolder(body.sharedDriveId);

      const [updated] = await db
        .update(organizationsTable)
        .set({
          storageMode: "google_drive",
          driveSharedDriveId: body.sharedDriveId,
          driveRootFolderId: root.folderId,
          driveConnectedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(organizationsTable.id, organizationId))
        .returning();

      res.json({
        school: serializeOrganization(updated),
        driveName: drive.name,
        rootFolderId: root.folderId,
        rootFolderName: root.folderName,
      });
    } catch (err: unknown) {
      if (err instanceof DriveNotConfiguredError) {
        res.status(503).json({ error: "Service Unavailable", message: err.message });
        return;
      }
      if (err instanceof DriveAccessError) {
        res.status(400).json({ error: "Bad Request", message: err.message });
        return;
      }
      req.log.error({ err }, "Unexpected error connecting Drive");
      res.status(500).json({ error: "Internal Server Error", message: "Failed to connect Google Drive" });
    }
  });

  router.post(`${prefix}/me/disconnect-drive`, requireAuth, requireOrganization, async (req, res): Promise<void> => {
    const userId = getUserId(req)!;
    const organizationId = getOrganizationId(req)!;

    if (!(await ensureCanManage(userId, organizationId))) {
      res.status(403).json({ error: "Forbidden", message: "Only admins can disconnect Drive" });
      return;
    }

    const [updated] = await db
      .update(organizationsTable)
      .set({
        storageMode: "object_storage",
        driveSharedDriveId: null,
        driveRootFolderId: null,
        driveConnectedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(organizationsTable.id, organizationId))
      .returning();

    res.json({
      school: serializeOrganization(updated),
      message:
        "Drive disconnected. New uploads will go to Offloadr storage. Files already in your Shared Drive remain in Drive (unmoved); they will not be downloadable through Offloadr until Drive is reconnected.",
    });
  });
}

registerOrgRoutes("/organizations");
registerOrgRoutes("/schools");

const resetPasswordSchema = z.object({
  newPassword: z
    .string()
    .min(8, "New password must be at least 8 characters")
    .max(128, "New password is too long"),
});

/**
 * Pilot-grade account recovery. An org admin can directly set a new
 * password for any other member of the SAME org. The admin then tells the
 * member out-of-band (in person, on Teams, etc.) — no email infrastructure
 * required for the pilot.
 *
 * Constraints, in order of importance:
 *   - Caller must be authenticated and a member of the active org.
 *   - Caller's role must allow member management (admin only in V1).
 *   - Target user must be a member of the SAME org. A 404 is returned if
 *     not, NOT a 403 — we don't want to leak which userIds exist globally.
 *   - Caller cannot reset their own password through this endpoint (use a
 *     normal change-password flow once it exists; using admin-recovery on
 *     yourself just hides changes from audit context).
 *   - Caller cannot reset another OWNER's password. The owner is the one
 *     account that must always be recoverable by its real human, not by a
 *     peer admin.
 *   - Rate-limited per IP to slow down a hijacked admin session.
 */
function registerMemberRoutes(prefix: "/organizations" | "/schools"): void {
  router.get(
    `${prefix}/me/members`,
    requireAuth,
    requireOrganization,
    async (req, res): Promise<void> => {
      const userId = getUserId(req)!;
      const organizationId = getOrganizationId(req)!;
      const m = await loadMembership(userId, organizationId);
      if (!m || !canManageMembers(m)) {
        res.status(403).json({ error: "Forbidden", message: "Only admins can list school members" });
        return;
      }
      const rows = await db
        .select({
          userId: usersTable.id,
          name: usersTable.name,
          email: usersTable.email,
          role: organizationMembershipsTable.role,
          isOwner: organizationMembershipsTable.isOwner,
          createdAt: organizationMembershipsTable.createdAt,
        })
        .from(organizationMembershipsTable)
        .innerJoin(usersTable, eq(organizationMembershipsTable.userId, usersTable.id))
        .where(eq(organizationMembershipsTable.organizationId, organizationId));
      res.json({ members: rows });
    },
  );

  router.post(
    `${prefix}/me/members/:userId/reset-password`,
    passwordResetRateLimiter,
    requireAuth,
    requireOrganization,
    async (req, res): Promise<void> => {
      const callerId = getUserId(req)!;
      const organizationId = getOrganizationId(req)!;
      const callerMembership = await loadMembership(callerId, organizationId);
      if (!callerMembership || !canManageMembers(callerMembership)) {
        res.status(403).json({ error: "Forbidden", message: "Only admins can reset member passwords" });
        return;
      }

      const targetUserIdRaw = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
      const targetUserId = parseInt(targetUserIdRaw, 10);
      if (!Number.isFinite(targetUserId) || targetUserId <= 0) {
        res.status(400).json({ error: "Bad Request", message: "Invalid user id" });
        return;
      }

      if (targetUserId === callerId) {
        res.status(400).json({
          error: "Bad Request",
          message: "Use the regular change-password flow to update your own password.",
        });
        return;
      }

      const body = parseBody(req, res, resetPasswordSchema);
      if (!body) return;

      const targetMembership = await loadMembership(targetUserId, organizationId);
      if (!targetMembership) {
        // Don't leak whether the userId exists globally — a non-member of
        // this org is indistinguishable from a non-existent user.
        res.status(404).json({ error: "Not Found", message: "Member not found in this school" });
        return;
      }

      if (targetMembership.isOwner) {
        res.status(403).json({
          error: "Forbidden",
          message:
            "The school's owner account cannot be recovered by another admin. Contact the owner directly.",
        });
        return;
      }

      // Hash *before* the transaction so the slow bcrypt step doesn't hold
      // a DB transaction open for ~250ms.
      const passwordHash = await bcrypt.hash(body.newPassword, 12);

      // TOCTOU close: re-verify membership and !isOwner *inside* a
      // transaction that performs the update, so a concurrent role flip
      // can't slip past the earlier check. If the membership row no
      // longer satisfies the conditions, the update is skipped.
      const updated = await db.transaction(async (tx) => {
        const [m] = await tx
          .select({ isOwner: organizationMembershipsTable.isOwner })
          .from(organizationMembershipsTable)
          .where(
            and(
              eq(organizationMembershipsTable.userId, targetUserId),
              eq(organizationMembershipsTable.organizationId, organizationId),
            ),
          );
        if (!m || m.isOwner) return false;
        await tx.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, targetUserId));
        return true;
      });
      if (!updated) {
        res.status(409).json({
          error: "Conflict",
          message: "Member's role changed during the reset. Try again.",
        });
        return;
      }

      req.log.info(
        {
          event: "admin_password_reset",
          callerId,
          targetUserId,
          organizationId,
        },
        "Admin reset another member's password",
      );

      res.json({
        message: "Password reset. Tell the member their new password through a trusted channel.",
      });
    },
  );
}

registerMemberRoutes("/organizations");
registerMemberRoutes("/schools");

export default router;
