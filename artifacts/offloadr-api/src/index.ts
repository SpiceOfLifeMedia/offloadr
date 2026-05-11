import app from "./app";
import { logger } from "./lib/logger";
import { assertObjectStorageConfigured } from "./lib/objectStorage";
import { pingDatabase, formatDbPingFailure } from "@workspace/db";

try {
  assertObjectStorageConfigured();
} catch (err) {
  logger.error(
    { err },
    "Object storage is not configured. Provision Replit Object Storage so PRIVATE_OBJECT_DIR is set, otherwise uploads will not persist across redeploys.",
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
});
