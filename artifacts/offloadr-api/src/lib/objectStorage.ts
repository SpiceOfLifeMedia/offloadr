import { Storage, type File as GcsFile } from "@google-cloud/storage";
import { Readable, Writable } from "stream";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

export const objectStorageClient: Storage = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ObjectStorageNotConfiguredError";
    Object.setPrototypeOf(this, ObjectStorageNotConfiguredError.prototype);
  }
}

interface ResolvedObjectLocation {
  bucketName: string;
  objectName: string;
}

function getPrivateObjectDirRaw(): string {
  const dir = process.env["PRIVATE_OBJECT_DIR"];
  if (!dir) {
    throw new ObjectStorageNotConfiguredError(
      "PRIVATE_OBJECT_DIR is not set. Provision Replit Object Storage so " +
        "uploads can persist across redeploys.",
    );
  }
  return dir;
}

export function assertObjectStorageConfigured(): void {
  getPrivateObjectDirRaw();
}

function resolveStorageKey(storageKey: string): ResolvedObjectLocation {
  const dir = getPrivateObjectDirRaw();
  const normalized = (dir.startsWith("/") ? dir.slice(1) : dir).replace(/\/$/, "");
  const parts = normalized.split("/").filter((s) => s.length > 0);
  if (parts.length < 1) {
    throw new ObjectStorageNotConfiguredError(
      "PRIVATE_OBJECT_DIR must include a bucket name (e.g. <bucket>/<prefix>).",
    );
  }
  const bucketName = parts[0]!;
  const prefix = parts.slice(1).join("/");
  const objectName = prefix ? `${prefix}/${storageKey}` : storageKey;
  return { bucketName, objectName };
}

function gcsFileFor(storageKey: string): GcsFile {
  const { bucketName, objectName } = resolveStorageKey(storageKey);
  return objectStorageClient.bucket(bucketName).file(objectName);
}

export function createStorageWriteStream(
  storageKey: string,
  contentType: string,
): Writable {
  return gcsFileFor(storageKey).createWriteStream({
    contentType,
    resumable: true,
    metadata: { contentType },
  });
}

export async function deleteFromStorage(storageKey: string): Promise<void> {
  await gcsFileFor(storageKey).delete({ ignoreNotFound: true });
}

export async function getStorageFile(storageKey: string): Promise<GcsFile> {
  const file = gcsFileFor(storageKey);
  const [exists] = await file.exists();
  if (!exists) {
    throw new ObjectNotFoundError();
  }
  return file;
}

export function streamStorageFile(file: GcsFile): Readable {
  return file.createReadStream();
}
