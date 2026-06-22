import app, { ensureSessionStoreSchema } from "./app";
import { logger } from "./lib/logger";
import { getStorageDriver } from "./lib/storage/index";
import { pingDatabase, formatDbPingFailure, checkSchemaColumns, pool } from "@workspace/db";
import { setSchemaCheckResult } from "./lib/schema-check-state";
import { resumeRenderJobPollsOnBoot } from "./lib/renderJobPoller";
// The poller's refresh function is registered at module-eval inside
// routes/render-jobs.ts, which app.ts imports via routes/index.ts.
// `import app from "./app"` above therefore guarantees the registration
// has run before resumeRenderJobPollsOnBoot fires its first scheduled
// tick. No explicit side-effect import needed.

try {
  const storage = getStorageDriver();
  storage.assertConfigured();
  const storageDescribe = (storage as unknown as { describe?: () => unknown }).describe?.() ?? null;
  logger.info({ driver: storage.name, config: storageDescribe }, "Storage driver ready");
} catch (err) {
  logger.error(
    { err },
    "Storage driver is not configured. Set STORAGE_DRIVER=fs (default) for local filesystem, or STORAGE_DRIVER=s3 with S3/R2 credentials for production.",
  );
  process.exit(1);
}

const dbPing = await pingDatabase();
if (!dbPing.ok) {
  process.stderr.write(formatDbPingFailure(dbPing) + "\n");
  logger.error(
    { host: dbPing.host, errorClass: dbPing.errorClass },
    "Database unreachable at startup; aborting.",
  );
  process.exit(1);
}
logger.info({ host: dbPing.host }, "Database reachable");

// Boot-time schema drift check. Compares the columns the running code
// expects (derived from the Drizzle schema) against what Postgres actually
// has. Logs a loud error and flips /healthz to degraded if anything is
// missing, so Fly's healthcheck refuses the release instead of a teacher
// finding out via a 500 toast. Does NOT crash the process — a degraded
// app is more useful than a dead one for diagnosing the drift.
try {
  const schemaCheck = await checkSchemaColumns(pool);
  setSchemaCheckResult(schemaCheck);
  if (schemaCheck.ok) {
    logger.info({ checked: schemaCheck.checked }, "Schema columns match expected");
  } else if (schemaCheck.error) {
    logger.error({ error: schemaCheck.error }, "Schema column check failed to run");
  } else {
    logger.error(
      { missing: schemaCheck.missing, count: schemaCheck.missing.length },
      "Schema drift detected: database is missing columns the code expects. Apply pending migrations before serving traffic.",
    );
  }
} catch (err) {
  logger.error({ err }, "Schema check threw unexpectedly");
  setSchemaCheckResult({ ok: false, checked: 0, missing: [], error: String(err) });
}

// Make sure the user_sessions table exists BEFORE we start serving.
// connect-pg-simple's own createTableIfMissing relies on a .sql file
// that esbuild doesn't bundle into dist/, so we own the schema here.
try {
  await ensureSessionStoreSchema();
  logger.info("Session store schema ready");
} catch (err) {
  logger.error({ err }, "Failed to ensure session store schema; aborting.");
  process.exit(1);
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Resume background polling for any render jobs that were in-flight
  // when this process last died/restarted. Fire-and-forget — never let
  // a poll-resumption error stop the server from serving traffic.
  void resumeRenderJobPollsOnBoot();
});
