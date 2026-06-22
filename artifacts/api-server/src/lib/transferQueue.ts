import { logger } from "./logger";
import { getTransfer, setStatus } from "./statusService";
import { runTransferPipeline } from "./rcloneService";

// ---------------------------------------------------------------------------
// Concurrency-controlled transfer queue
// ---------------------------------------------------------------------------

const MAX_CONCURRENT = parseInt(process.env["TRANSFER_CONCURRENCY"] ?? "2", 10);

let active = 0;
const pending: string[] = []; // transfer IDs waiting to run

/**
 * Add a transfer to the queue. Starts immediately if a slot is free.
 */
export function enqueue(transferId: string): void {
  pending.push(transferId);
  logger.info({ transferId, queueDepth: pending.length, active }, "Transfer enqueued");
  processNext();
}

function processNext(): void {
  while (active < MAX_CONCURRENT && pending.length > 0) {
    const transferId = pending.shift()!;
    runOne(transferId);
  }
}

function runOne(transferId: string): void {
  const transfer = getTransfer(transferId);
  if (!transfer) {
    logger.warn({ transferId }, "Transfer not found when dequeued — skipping");
    processNext();
    return;
  }

  if (transfer.status === "cancelled") {
    logger.info({ transferId }, "Transfer was cancelled before starting — skipping");
    processNext();
    return;
  }

  active++;
  logger.info({ transferId, active, queued: pending.length }, "Transfer started");

  runTransferPipeline({
    transferId: transfer.id,
    localFile: transfer.localPath,
    destFolder: transfer.destination,
    fileSize: transfer.size,
    cleanupAfterUpload: transfer.cleanupAfterUpload,
  })
    .catch((err) => {
      logger.error({ transferId, err }, "Transfer pipeline threw unexpectedly");
      setStatus(transferId, "failed");
    })
    .finally(() => {
      active--;
      logger.info({ transferId, active, queued: pending.length }, "Transfer slot freed");
      processNext();
    });
}

export function getQueueStats(): { active: number; queued: number; maxConcurrent: number } {
  return { active, queued: pending.length, maxConcurrent: MAX_CONCURRENT };
}
