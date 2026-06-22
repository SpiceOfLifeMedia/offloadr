import type { Readable } from "node:stream";

export class NotFoundError extends Error {
  constructor(key: string) {
    super(`Storage object not found: ${key}`);
    this.name = "NotFoundError";
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

export class NotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotConfiguredError";
    Object.setPrototypeOf(this, NotConfiguredError.prototype);
  }
}

export interface StorageObject {
  stream: Readable;
  contentType: string;
  size?: number;
}

export interface StorageDriver {
  readonly name: string;
  assertConfigured(): void;
  upload(key: string, body: Readable, contentType: string): Promise<void>;
  getObject(key: string): Promise<StorageObject>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  /**
   * Returns a time-limited HTTPS URL that an external service (e.g.
   * Shotstack) can use to fetch the object directly. Returns null when
   * the driver can't generate one — e.g. local filesystem in dev. Callers
   * must handle null by aborting the operation, never by silently
   * substituting a URL the external service can't reach.
   */
  getSignedDownloadUrl(key: string, ttlSeconds: number): Promise<string | null>;
  /**
   * Returns a time-limited presigned PUT URL for a direct browser-to-storage
   * upload. The client PUTs the file body directly to this URL — the API
   * server is NOT in the upload data path.
   *
   * Returns null when the driver can't generate one (e.g. local filesystem
   * in dev). Callers must fall back to the legacy multipart server-side
   * upload when null is returned.
   */
  getSignedUploadUrl(
    key: string,
    contentType: string,
    ttlSeconds: number,
  ): Promise<string | null>;
}
