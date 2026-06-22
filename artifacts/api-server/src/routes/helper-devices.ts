import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import {
  db,
  helperDevicesTable,
  helperPairingCodesTable,
  helperEventsTable,
  organizationMembershipsTable,
  usersTable,
} from "@workspace/db";
import { and, desc, eq, sql, gt, isNull, lt, inArray } from "drizzle-orm";
import {
  requireAuth,
  requireOrganization,
  getUserId,
  getOrganizationId,
} from "../lib/auth";
import { canManageHelperDevices, requireRole } from "../lib/permissions";
import { parseBody } from "../lib/validate";
import {
  generateHelperPairingCode,
  normalizeHelperPairingCode,
} from "../lib/helperPairingCode";
import { generateDeviceToken } from "../lib/helperToken";
import { requireHelperDevice, getHelperDevice } from "../lib/helperAuth";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Admin endpoints — user session auth, admin-only.
// ---------------------------------------------------------------------------

const PAIRING_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes

const createPairingCodeSchema = z
  .object({
    deviceLabel: z.string().trim().min(1).max(120),
  })
  .strict();

const PAIRING_CODE_GEN_ATTEMPTS = 5;

async function generateUniquePairingCode(): Promise<string> {
  // 31^8 = ~8.5e11 — collisions are essentially impossible at our scale,
  // but loop anyway so a freak collision degrades to a retry instead of
  // a 500.
  for (let i = 0; i < PAIRING_CODE_GEN_ATTEMPTS; i++) {
    const candidate = generateHelperPairingCode();
    const [existing] = await db
      .select({ id: helperPairingCodesTable.id })
      .from(helperPairingCodesTable)
      .where(eq(helperPairingCodesTable.code, candidate))
      .limit(1);
    if (!existing) return candidate;
  }
  throw new Error("Failed to generate a unique pairing code after multiple attempts");
}

/**
 * POST /helper-devices/pairing-codes
 * Admin-only. Mints a short-lived single-use pairing code that the
 * operator types into the Helper's first-run prompt.
 */
router.post(
  "/helper-devices/pairing-codes",
  requireAuth,
  requireOrganization,
  requireRole(canManageHelperDevices),
  async (req: Request, res: Response) => {
    const parsed = parseBody(req, res, createPairingCodeSchema);
    if (!parsed) return;
    const userId = getUserId(req)!;
    const organizationId = getOrganizationId(req)!;

    const code = await generateUniquePairingCode();
    const expiresAt = new Date(Date.now() + PAIRING_CODE_TTL_MS);

    const [row] = await db
      .insert(helperPairingCodesTable)
      .values({
        organizationId,
        code,
        deviceLabel: parsed.deviceLabel,
        createdByUserId: userId,
        expiresAt,
      })
      .returning();

    if (!row) {
      res.status(500).json({ error: "Server Error", message: "Failed to create pairing code" });
      return;
    }

    req.log.info(
      {
        action: "helper_pairing_code.created",
        organizationId,
        userId,
        pairingCodeId: row.id,
        deviceLabel: parsed.deviceLabel,
      },
      "helper pairing code created",
    );

    res.status(201).json({
      code: row.code,
      deviceLabel: parsed.deviceLabel,
      expiresAt: row.expiresAt.toISOString(),
    });
  },
);

/**
 * GET /helper-devices
 * Admin-only. List paired devices in the active org.
 */
router.get(
  "/helper-devices",
  requireAuth,
  requireOrganization,
  requireRole(canManageHelperDevices),
  async (req: Request, res: Response) => {
    const organizationId = getOrganizationId(req)!;
    const rows = await db
      .select({
        id: helperDevicesTable.id,
        deviceLabel: helperDevicesTable.deviceLabel,
        status: helperDevicesTable.status,
        hostname: helperDevicesTable.hostname,
        osVersion: helperDevicesTable.osVersion,
        helperVersion: helperDevicesTable.helperVersion,
        pairedAt: helperDevicesTable.pairedAt,
        pairedByUserId: helperDevicesTable.pairedByUserId,
        pairedByEmail: usersTable.email,
        lastHeartbeatAt: helperDevicesTable.lastHeartbeatAt,
        lastUptimeSec: helperDevicesTable.lastUptimeSec,
        revokedAt: helperDevicesTable.revokedAt,
      })
      .from(helperDevicesTable)
      .leftJoin(usersTable, eq(helperDevicesTable.pairedByUserId, usersTable.id))
      .where(eq(helperDevicesTable.organizationId, organizationId))
      .orderBy(desc(helperDevicesTable.pairedAt));

    res.json({
      devices: rows.map((r) => ({
        ...r,
        pairedAt: r.pairedAt.toISOString(),
        lastHeartbeatAt: r.lastHeartbeatAt?.toISOString() ?? null,
        revokedAt: r.revokedAt?.toISOString() ?? null,
      })),
    });
  },
);

/**
 * GET /helper-devices/:id/events
 * Admin-only. Most recent events for a device, capped.
 */
router.get(
  "/helper-devices/:id/events",
  requireAuth,
  requireOrganization,
  requireRole(canManageHelperDevices),
  async (req: Request, res: Response) => {
    const organizationId = getOrganizationId(req)!;
    const deviceId = Number(req.params["id"]);
    if (!Number.isInteger(deviceId) || deviceId <= 0) {
      res.status(400).json({ error: "Bad Request", message: "Invalid device id" });
      return;
    }
    const limitRaw = Number(req.query["limit"] ?? 50);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, Math.floor(limitRaw)), 200) : 50;

    const [device] = await db
      .select({ id: helperDevicesTable.id })
      .from(helperDevicesTable)
      .where(
        and(
          eq(helperDevicesTable.id, deviceId),
          eq(helperDevicesTable.organizationId, organizationId),
        ),
      )
      .limit(1);
    if (!device) {
      res.status(404).json({ error: "Not Found", message: "Device not found" });
      return;
    }

    const rows = await db
      .select({
        id: helperEventsTable.id,
        eventId: helperEventsTable.eventId,
        kind: helperEventsTable.kind,
        payload: helperEventsTable.payload,
        sourceLabel: helperEventsTable.sourceLabel,
        ts: helperEventsTable.ts,
        receivedAt: helperEventsTable.receivedAt,
      })
      .from(helperEventsTable)
      .where(eq(helperEventsTable.deviceId, deviceId))
      .orderBy(desc(helperEventsTable.ts))
      .limit(limit);

    res.json({
      events: rows.map((r) => ({
        ...r,
        id: String(r.id),
        ts: r.ts.toISOString(),
        receivedAt: r.receivedAt.toISOString(),
      })),
    });
  },
);

/**
 * POST /helper-devices/:id/revoke
 * Admin-only. Marks the device revoked. Future requests bearing its
 * token will be rejected with 401 by `requireHelperDevice`.
 */
router.post(
  "/helper-devices/:id/revoke",
  requireAuth,
  requireOrganization,
  requireRole(canManageHelperDevices),
  async (req: Request, res: Response) => {
    const organizationId = getOrganizationId(req)!;
    const userId = getUserId(req)!;
    const deviceId = Number(req.params["id"]);
    if (!Number.isInteger(deviceId) || deviceId <= 0) {
      res.status(400).json({ error: "Bad Request", message: "Invalid device id" });
      return;
    }

    const [updated] = await db
      .update(helperDevicesTable)
      .set({
        status: "revoked",
        revokedAt: new Date(),
        revokedByUserId: userId,
      })
      .where(
        and(
          eq(helperDevicesTable.id, deviceId),
          eq(helperDevicesTable.organizationId, organizationId),
          eq(helperDevicesTable.status, "active"),
        ),
      )
      .returning({ id: helperDevicesTable.id });

    if (!updated) {
      res.status(404).json({
        error: "Not Found",
        message: "Device not found or already revoked",
      });
      return;
    }

    req.log.info({ action: "helper_device.revoked" }, "helper device action");

    res.json({ id: deviceId, status: "revoked" });
  },
);

// ---------------------------------------------------------------------------
// Helper-facing endpoints — bearer device auth, no user session.
// ---------------------------------------------------------------------------

const pairSchema = z
  .object({
    pairingCode: z.string().min(1).max(32),
    hostname: z.string().trim().max(255).optional(),
    osVersion: z.string().trim().max(64).optional(),
    helperVersion: z.string().trim().max(32).optional(),
    // Helper may suggest a label, but the admin's label captured at
    // pairing-code creation time always wins. This is what's shown
    // to the admin before they read out the code, so silently
    // overriding it server-side would be misleading.
    deviceLabel: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

/**
 * POST /helper/pair
 * Public (no session). The pairing code is the only thing standing
 * between this endpoint and a hostile network, so it's:
 *   - short-lived (10 minutes)
 *   - single-use (consumed_at set inside a transaction)
 *   - scoped to a single org
 */
router.post("/helper/pair", async (req: Request, res: Response) => {
  const parsed = parseBody(req, res, pairSchema);
  if (!parsed) return;

  const code = normalizeHelperPairingCode(parsed.pairingCode);
  if (!code) {
    res.status(400).json({
      error: "Bad Request",
      message: "Pairing code is malformed",
    });
    return;
  }

  const now = new Date();
  const result = await db.transaction(async (tx) => {
    const [pc] = await tx
      .select()
      .from(helperPairingCodesTable)
      .where(eq(helperPairingCodesTable.code, code))
      .for("update")
      .limit(1);

    if (!pc) return { kind: "not_found" as const };
    if (pc.consumedAt) return { kind: "already_used" as const };
    if (pc.expiresAt.getTime() <= now.getTime()) {
      return { kind: "expired" as const };
    }

    const token = generateDeviceToken();
    const [device] = await tx
      .insert(helperDevicesTable)
      .values({
        organizationId: pc.organizationId,
        // Admin's label wins. Helper-supplied label is intentionally
        // ignored — the admin saw and confirmed this label in the UI.
        deviceLabel: pc.deviceLabel,
        apiKeyHash: token.hash,
        hostname: parsed.hostname,
        osVersion: parsed.osVersion,
        helperVersion: parsed.helperVersion,
        pairedByUserId: pc.createdByUserId,
      })
      .returning();

    if (!device) return { kind: "server_error" as const };

    await tx
      .update(helperPairingCodesTable)
      .set({ consumedAt: now, consumedDeviceId: device.id })
      .where(eq(helperPairingCodesTable.id, pc.id));

    return {
      kind: "ok" as const,
      device,
      plaintextToken: token.plaintext,
    };
  });

  if (result.kind === "not_found" || result.kind === "expired" || result.kind === "already_used") {
    // Don't disclose which of the three failure modes happened — same
    // reason we don't disclose "wrong password" vs "unknown user" on login.
    res.status(400).json({
      error: "Bad Request",
      message: "This pairing code is not valid. Ask an admin to generate a new one.",
    });
    return;
  }
  if (result.kind === "server_error") {
    res.status(500).json({ error: "Server Error", message: "Failed to pair device" });
    return;
  }

  req.log.info(
    {
      action: "helper_device.paired",
      organizationId: result.device.organizationId,
      deviceId: result.device.id,
      deviceLabel: result.device.deviceLabel,
    },
    "helper device paired",
  );

  res.status(201).json({
    deviceId: result.device.id,
    organizationId: result.device.organizationId,
    deviceLabel: result.device.deviceLabel,
    // Only returned once. Helper stores in Keychain; we never see it again.
    apiKey: result.plaintextToken,
  });
});

const heartbeatSchema = z
  .object({
    helperVersion: z.string().trim().max(32).optional(),
    uptimeSec: z.number().int().min(0).max(60 * 60 * 24 * 365).optional(),
  })
  .strict();

/**
 * POST /helper/heartbeat
 * Lightweight liveness ping. Updates last_heartbeat_at + version.
 * Frequency: every 30s in production. Rate is enforced by the
 * helper, not by us — a hostile token can't really abuse this without
 * us revoking it.
 */
router.post(
  "/helper/heartbeat",
  requireHelperDevice,
  async (req: Request, res: Response) => {
    const parsed = parseBody(req, res, heartbeatSchema);
    if (!parsed) return;
    const { deviceId } = getHelperDevice(res);

    await db
      .update(helperDevicesTable)
      .set({
        lastHeartbeatAt: new Date(),
        lastUptimeSec: parsed.uptimeSec ?? null,
        ...(parsed.helperVersion ? { helperVersion: parsed.helperVersion } : {}),
      })
      .where(eq(helperDevicesTable.id, deviceId));

    res.json({
      serverTime: new Date().toISOString(),
      configRevision: 1, // V1: static. Real config service comes later.
    });
  },
);

const RESERVED_EVENT_KINDS = new Set([
  "helper.started",
  "helper.stopped",
  "helper.config.changed",
  "recording.detected",
  "recording.stable",
  "recording.uploading",
  "recording.uploaded",
  "recording.verified",
  "recording.failed",
  "storage.low",
  "storage.ok",
  "device.disk.read_only",
  "camera.connected",
  "camera.disconnected",
  "audio.activity",
  "audio.silent",
  "producer.safe_to_close",
]);

const eventSchema = z
  .object({
    eventId: z.string().trim().min(1).max(64),
    kind: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .refine((k) => RESERVED_EVENT_KINDS.has(k), {
        message: "Unknown event kind. Update the API before emitting it.",
      }),
    ts: z.string().datetime({ offset: true }),
    payload: z.record(z.string(), z.unknown()).optional().default({}),
    sourceLabel: z.string().trim().max(120).optional(),
  })
  .strict();

const eventsBatchSchema = z
  .object({
    events: z.array(eventSchema).min(1).max(50),
  })
  .strict();

/**
 * POST /helper/events
 * Batched, idempotent telemetry sink. The Helper drains its local
 * SQLite outbox here. Duplicates (same `eventId`) are silently
 * skipped — exactly-once at the producer, at-least-once on the wire.
 */
router.post(
  "/helper/events",
  requireHelperDevice,
  async (req: Request, res: Response) => {
    const parsed = parseBody(req, res, eventsBatchSchema);
    if (!parsed) return;
    const { deviceId, organizationId } = getHelperDevice(res);

    // Detect which eventIds we've already accepted for THIS device
    // (idempotency is per-device, not global) so the response can
    // tell the client to drop them from its outbox.
    const incomingIds = parsed.events.map((e) => e.eventId);
    const existing = await db
      .select({ eventId: helperEventsTable.eventId })
      .from(helperEventsTable)
      .where(
        and(
          eq(helperEventsTable.deviceId, deviceId),
          inArray(helperEventsTable.eventId, incomingIds),
        ),
      );
    const known = new Set(existing.map((r) => r.eventId));

    const toInsert = parsed.events
      .filter((e) => !known.has(e.eventId))
      .map((e) => ({
        deviceId,
        organizationId,
        eventId: e.eventId,
        kind: e.kind,
        payload: (e.payload ?? {}) as Record<string, unknown>,
        sourceLabel: e.sourceLabel,
        ts: new Date(e.ts),
      }));

    if (toInsert.length > 0) {
      await db
        .insert(helperEventsTable)
        .values(toInsert)
        // Composite unique index on (device_id, event_id).
        .onConflictDoNothing({
          target: [helperEventsTable.deviceId, helperEventsTable.eventId],
        });
    }

    // Heartbeat-on-events: any event implies the device is alive,
    // so we don't need a separate heartbeat ping for low-traffic devices.
    await db
      .update(helperDevicesTable)
      .set({ lastHeartbeatAt: new Date() })
      .where(eq(helperDevicesTable.id, deviceId));

    res.status(202).json({
      acceptedEventIds: incomingIds,
      newCount: toInsert.length,
      duplicateCount: incomingIds.length - toInsert.length,
    });
  },
);

// Suppress unused-import warnings for helpers reserved for V1.1
void organizationMembershipsTable;
void sql;
void gt;
void isNull;
void lt;

export default router;
