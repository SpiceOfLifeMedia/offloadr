import { Router, type IRouter } from "express";
import { HeadBucketCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { pingDatabase } from "@workspace/db";
import { getStorageDriver } from "../lib/storage/index";
import { getSchemaCheckResult } from "../lib/schema-check-state";

const router: IRouter = Router();

/**
 * Pilot-grade healthz. Returns the components the deployment depends on so
 * a probe can tell *which* dependency broke, not just that "something" did.
 *
 * - `status`: top-level "ok" / "degraded" — preserved for any consumer that
 *   only reads this field (the OpenAPI contract still says `{status}`).
 * - `storage`: which driver is configured (`fs` / `s3`) and whether it
 *   passes its self-check at request time.
 * - `db`: whether a short-timeout SELECT 1 succeeded against the configured
 *   `DATABASE_URL` and the (non-secret) host portion.
 *
 * Returns 200 even when degraded — uptime monitors that page on non-200
 * should look at the `status` field. Returns 503 only if storage is wholly
 * unconfigured (i.e. boot would have failed; this catches a runtime drift).
 */

router.get("/live", (_req, res) => {
  res.status(200).json({ status: "alive" });
});

router.get("/healthz", async (_req, res): Promise<void> => {
  let storageStatus: { driver: string; ready: boolean; error?: string };
  try {
    const drv = getStorageDriver();
    drv.assertConfigured();
    storageStatus = { driver: drv.name, ready: true };
  } catch (err) {
    storageStatus = {
      driver: process.env["STORAGE_DRIVER"] ?? "unknown",
      ready: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const dbPing = await pingDatabase(2000);
  const schemaCheck = getSchemaCheckResult();
  const schemaOk = schemaCheck === null ? true : schemaCheck.ok;
  const dbStatus = dbPing.ok
    ? {
        reachable: true,
        host: dbPing.host,
        schemaOk,
        ...(schemaCheck && !schemaCheck.ok
          ? {
              missingColumns: schemaCheck.missing.slice(0, 50),
              missingColumnCount: schemaCheck.missing.length,
              ...(schemaCheck.error ? { schemaCheckError: schemaCheck.error } : {}),
            }
          : {}),
      }
    : { reachable: false, host: dbPing.host, errorClass: dbPing.errorClass, schemaOk };

  const ok = storageStatus.ready && dbPing.ok && schemaOk;
  res.status(ok ? 200 : 503).json({
    status: ok ? "ok" : "degraded",
    storage: storageStatus,
    db: dbStatus,
  });
});

/**
 * R2 connectivity probe. Lives behind /api/_debug/r2-ping. Builds a one-shot
 * S3 client from the live env, runs HeadBucket then a 1-key ListObjectsV2
 * against the configured bucket, and returns sanitised diagnostics + the
 * exact failure metadata. No secrets are returned.
 *
 * Open endpoint by design: it only ever exposes endpoint host, bucket name,
 * region, path-style flag, credential lengths/format, and SDK error fields.
 * That's the same surface the upload error path already exposes.
 */
router.get("/_debug/r2-ping", async (_req, res): Promise<void> => {
  const readEnv = (name: string): string | undefined => {
    const raw = process.env[name];
    if (raw === undefined) return undefined;
    const t = raw.trim();
    return t.length === 0 ? undefined : t;
  };
  const region = readEnv("STORAGE_S3_REGION");
  const bucket = readEnv("STORAGE_S3_BUCKET");
  const accessKeyId = readEnv("STORAGE_S3_ACCESS_KEY_ID");
  const secretAccessKey = readEnv("STORAGE_S3_SECRET_ACCESS_KEY");
  const endpoint = readEnv("STORAGE_S3_ENDPOINT");
  const forcePathStyleRaw = readEnv("STORAGE_S3_FORCE_PATH_STYLE");
  const forcePathStyle = forcePathStyleRaw === "true" || forcePathStyleRaw === "1";

  const missing: string[] = [];
  if (!region) missing.push("STORAGE_S3_REGION");
  if (!bucket) missing.push("STORAGE_S3_BUCKET");
  if (!accessKeyId) missing.push("STORAGE_S3_ACCESS_KEY_ID");
  if (!secretAccessKey) missing.push("STORAGE_S3_SECRET_ACCESS_KEY");
  if (!endpoint) missing.push("STORAGE_S3_ENDPOINT");

  let endpointHost: string | null = null;
  let accountIdLabel: string | null = null;
  let accountIdLength: number | null = null;
  let accountIdLooksHex: boolean | null = null;
  if (endpoint) {
    try {
      endpointHost = new URL(endpoint).host;
      accountIdLabel = endpointHost.split(".")[0] ?? null;
      if (accountIdLabel) {
        accountIdLength = accountIdLabel.length;
        accountIdLooksHex = /^[0-9a-f]+$/i.test(accountIdLabel);
      }
    } catch {
      endpointHost = "<unparseable>";
    }
  }

  const hex = /^[0-9a-f]+$/i;
  const config = {
    endpointHost,
    bucket: bucket ?? null,
    region: region ?? null,
    forcePathStyle,
    accountIdLabel,
    accountIdLength,
    accountIdLooksHex,
    accountIdIsCanonical32Hex:
      accountIdLength === 32 && accountIdLooksHex === true,
    accessKeyIdLength: accessKeyId?.length ?? 0,
    accessKeyIdLooksHex: accessKeyId ? hex.test(accessKeyId) : false,
    secretAccessKeyLength: secretAccessKey?.length ?? 0,
    secretAccessKeyLooksHex: secretAccessKey ? hex.test(secretAccessKey) : false,
  };

  if (missing.length > 0) {
    res.status(503).json({
      status: "misconfigured",
      missing,
      config,
    });
    return;
  }

  const probeClient = new S3Client({
    region: region!,
    endpoint: endpoint!,
    forcePathStyle,
    credentials: {
      accessKeyId: accessKeyId!,
      secretAccessKey: secretAccessKey!,
    },
  });

  const runProbe = async (label: string, fn: () => Promise<unknown>) => {
    const startedAt = Date.now();
    try {
      const out = await fn();
      return { label, ok: true, ms: Date.now() - startedAt, sample: out };
    } catch (err) {
      const e = err as { name?: string; code?: string; $fault?: string; $metadata?: { httpStatusCode?: number }; cause?: { code?: string; message?: string }; message?: string } | null;
      return {
        label,
        ok: false,
        ms: Date.now() - startedAt,
        errName: e?.name ?? null,
        errCode: e?.code ?? e?.cause?.code ?? null,
        errFault: e?.$fault ?? null,
        httpStatus: e?.$metadata?.httpStatusCode ?? null,
        message: e?.message ?? null,
        causeMessage: e?.cause?.message ?? null,
      };
    }
  };

  const headBucket = await runProbe("HeadBucket", () =>
    probeClient.send(new HeadBucketCommand({ Bucket: bucket! })),
  );
  const listV2 = await runProbe("ListObjectsV2", () =>
    probeClient.send(new ListObjectsV2Command({ Bucket: bucket!, MaxKeys: 1 })),
  );

  res.status(200).json({
    status: headBucket.ok && listV2.ok ? "ok" : "failed",
    config,
    probes: [headBucket, listV2],
  });
});

export default router;
