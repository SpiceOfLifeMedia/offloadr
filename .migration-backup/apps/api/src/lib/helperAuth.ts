import type { Request, Response, NextFunction } from "express";
import { db, helperDevicesTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { extractBearerToken, hashDeviceToken } from "./helperToken";

/**
 * Authenticate a Helper daemon request via the `Authorization: Bearer
 * <deviceApiKey>` header. Resolves the active device + organization
 * onto `res.locals` for downstream handlers.
 *
 * This is deliberately separate from `requireAuth`: the Helper is
 * not a human session, has no cookies, no CSRF surface, and no
 * organisation switching. Mixing it into the user-auth path would
 * pull in concerns it doesn't have.
 */

export interface HelperDeviceContext {
  deviceId: number;
  organizationId: number;
}

export async function requireHelperDevice(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = extractBearerToken(req.header("authorization"));
  if (!token) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Missing or malformed Authorization: Bearer header",
    });
    return;
  }

  const apiKeyHash = hashDeviceToken(token);
  const [device] = await db
    .select({
      id: helperDevicesTable.id,
      organizationId: helperDevicesTable.organizationId,
      status: helperDevicesTable.status,
    })
    .from(helperDevicesTable)
    .where(eq(helperDevicesTable.apiKeyHash, apiKeyHash))
    .limit(1);

  if (!device || device.status !== "active") {
    // Same 401 for "unknown token" and "revoked token" so the wire
    // doesn't leak which one applies — the operator finds out via
    // the local Helper log + the admin Devices page, not via probing.
    res.status(401).json({
      error: "Unauthorized",
      message: "This device is not authorised. Re-pair via the Offloadr admin.",
    });
    return;
  }

  res.locals["helperDevice"] = {
    deviceId: device.id,
    organizationId: device.organizationId,
  } satisfies HelperDeviceContext;
  next();
}

export function getHelperDevice(res: Response): HelperDeviceContext {
  const ctx = res.locals["helperDevice"] as HelperDeviceContext | undefined;
  if (!ctx) {
    throw new Error("getHelperDevice called without requireHelperDevice");
  }
  return ctx;
}
