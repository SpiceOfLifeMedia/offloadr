import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TransferStatus =
  | "queued"
  | "uploading"
  | "verifying"
  | "done"
  | "failed"
  | "cancelled";

export interface TransferProgress {
  bytes: number;
  totalBytes: number;
  speed: number;
  eta: number | null;
  percentage: number;
}

export interface Transfer {
  id: string;
  /** Original filename from the upload */
  filename: string;
  /** File size in bytes at upload time */
  size: number;
  /** Absolute path of the file on the server */
  localPath: string;
  /** User-supplied destination folder path on Google Drive */
  destination: string;
  status: TransferStatus;
  progress?: TransferProgress;
  startedAt: string;
  finishedAt?: string;
  error?: string;
  /** Google Drive web view link after successful upload */
  driveLink?: string;
  /** If true, local file is deleted after verified upload */
  cleanupAfterUpload: boolean;
}

// ---------------------------------------------------------------------------
// In-process store (process-lifetime — lost on restart; fine for v1)
// ---------------------------------------------------------------------------

const store = new Map<string, Transfer>();

export function createTransfer(args: {
  filename: string;
  size: number;
  localPath: string;
  destination: string;
  cleanupAfterUpload?: boolean;
}): Transfer {
  const transfer: Transfer = {
    id: randomUUID(),
    filename: args.filename,
    size: args.size,
    localPath: args.localPath,
    destination: args.destination,
    status: "queued",
    startedAt: new Date().toISOString(),
    cleanupAfterUpload: args.cleanupAfterUpload ?? false,
  };
  store.set(transfer.id, transfer);
  return transfer;
}

export function getTransfer(id: string): Transfer | undefined {
  return store.get(id);
}

export function listTransfers(): Transfer[] {
  return Array.from(store.values()).sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  );
}

export function setStatus(id: string, status: TransferStatus): void {
  const t = store.get(id);
  if (!t) return;
  t.status = status;
  if (status === "done" || status === "failed" || status === "cancelled") {
    t.finishedAt = new Date().toISOString();
  }
}

export function setProgress(id: string, progress: TransferProgress): void {
  const t = store.get(id);
  if (t) t.progress = progress;
}

export function setError(id: string, error: string): void {
  const t = store.get(id);
  if (t) t.error = error;
}

export function setDriveLink(id: string, link: string): void {
  const t = store.get(id);
  if (t) t.driveLink = link;
}

/** Expose a safe public view — strips the server-side localPath */
export function toPublicTransfer(t: Transfer): Omit<Transfer, "localPath"> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { localPath: _lp, ...pub } = t;
  return pub;
}
