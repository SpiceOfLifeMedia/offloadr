import { Readable } from "node:stream";
import {
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Upload } from "@aws-sdk/lib-storage";
import { NotConfiguredError, NotFoundError, type StorageDriver, type StorageObject } from "./types";

interface S3Config {
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
}

// Strip surrounding whitespace (incl. \r, \n, trailing spaces) from every
// secret value before it ever reaches the AWS SDK. Pasting a credential
// into the Fly secrets panel commonly captures a trailing newline; that
// newline ends up inside the SigV4 Authorization header value, and Node's
// undici then refuses to send the request with:
//   "Invalid character in header content [\"authorization\"]"
// The 227MB upload finishes streaming to the API, then dies on the PUT
// to R2 — looks like a runtime crash, is actually a one-byte typo in a
// secret. Trim defensively so this can't happen again.
function readEnv(name: string): string | undefined {
  const raw = process.env[name];
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function readConfig(): S3Config {
  const region = readEnv("STORAGE_S3_REGION");
  const bucket = readEnv("STORAGE_S3_BUCKET");
  const accessKeyId = readEnv("STORAGE_S3_ACCESS_KEY_ID");
  const secretAccessKey = readEnv("STORAGE_S3_SECRET_ACCESS_KEY");
  const endpoint = readEnv("STORAGE_S3_ENDPOINT");
  const forcePathStyleRaw = readEnv("STORAGE_S3_FORCE_PATH_STYLE");

  const missing: string[] = [];
  if (!region) missing.push("STORAGE_S3_REGION");
  if (!bucket) missing.push("STORAGE_S3_BUCKET");
  if (!accessKeyId) missing.push("STORAGE_S3_ACCESS_KEY_ID");
  if (!secretAccessKey) missing.push("STORAGE_S3_SECRET_ACCESS_KEY");
  if (missing.length > 0) {
    throw new NotConfiguredError(
      `S3 storage driver is missing required env vars: ${missing.join(", ")}. ` +
        `Set STORAGE_DRIVER=fs to use local filesystem instead, or provide the missing values.`,
    );
  }

  // Cloudflare R2 account IDs are exactly 32 lowercase hex chars. The
  // endpoint must be https://<account_id>.r2.cloudflarestorage.com.
  // If the leftmost subdomain label is anything else, every S3 call will
  // fail at the TLS layer with handshake_failure (alert 40) because
  // Cloudflare's edge can't route the SNI to a real account.
  //
  // We log a warning rather than throwing because hard-failing boot here
  // also takes down /api/healthz and /api/_debug/r2-ping, which are the
  // exact tools an operator needs to *diagnose* this misconfiguration.
  // The probe endpoint will surface the same finding more visibly.
  if (endpoint) {
    try {
      const host = new URL(endpoint).host;
      if (/cloudflarestorage\.com$/i.test(host)) {
        const acct = host.split(".")[0] ?? "";
        if (!/^[0-9a-f]{32}$/i.test(acct)) {
          // eslint-disable-next-line no-console
          console.warn(
            `[storage/s3] STORAGE_S3_ENDPOINT account-id subdomain looks wrong: expected 32 lowercase hex chars, got "${acct}" (length ${acct.length}). All uploads will fail with TLS handshake_failure until this is fixed. Curl /api/_debug/r2-ping for details.`,
          );
        }
      }
    } catch {
      // URL parse failure handled by existing validation paths.
    }
  }

  return {
    region: region!,
    bucket: bucket!,
    accessKeyId: accessKeyId!,
    secretAccessKey: secretAccessKey!,
    endpoint: endpoint || undefined,
    forcePathStyle: forcePathStyleRaw === "true" || forcePathStyleRaw === "1",
  };
}

function isNotFound(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: string; Code?: string; $metadata?: { httpStatusCode?: number } };
  if (e.name === "NoSuchKey" || e.name === "NotFound") return true;
  if (e.Code === "NoSuchKey" || e.Code === "NotFound") return true;
  if (e.$metadata?.httpStatusCode === 404) return true;
  return false;
}

export class S3StorageDriver implements StorageDriver {
  readonly name = "s3";
  private readonly cfg: S3Config;
  private readonly s3: S3Client;

  constructor() {
    // Validate configuration eagerly so misconfiguration surfaces at construction
    // time (and at boot via assertConfigured), not on the first user request.
    this.cfg = readConfig();
    this.s3 = new S3Client({
      region: this.cfg.region,
      endpoint: this.cfg.endpoint,
      forcePathStyle: this.cfg.forcePathStyle,
      credentials: {
        accessKeyId: this.cfg.accessKeyId,
        secretAccessKey: this.cfg.secretAccessKey,
      },
    });
  }

  assertConfigured(): void {
    // Already validated in the constructor; re-running readConfig keeps the
    // contract of "throw NotConfiguredError if env is incomplete" if env was
    // mutated after construction.
    readConfig();
  }

  private config(): S3Config {
    return this.cfg;
  }

  private client(): S3Client {
    return this.s3;
  }

  // Sanitised diagnostic snapshot. Returns the endpoint hostname (NOT the
  // full URL — that may contain account ids), the bucket name, the region,
  // and whether path-style addressing is enabled. Used to debug TLS / DNS
  // failures without dumping credentials into logs.
  describe(): {
    endpointHost: string | null;
    bucket: string;
    region: string;
    forcePathStyle: boolean;
    accessKeyIdLength: number;
    secretAccessKeyLength: number;
    // Sanity-check signatures so we can confirm the trim actually fired
    // and the secret isn't, say, surrounded by quotes or otherwise mangled.
    // R2 access keys are 32 hex chars; secrets are 64 hex chars. Any value
    // outside those ranges (or non-hex) tells us the Fly secret is wrong
    // without ever logging the secret itself.
    accessKeyIdLooksHex: boolean;
    secretAccessKeyLooksHex: boolean;
  } {
    let endpointHost: string | null = null;
    if (this.cfg.endpoint) {
      try {
        endpointHost = new URL(this.cfg.endpoint).host;
      } catch {
        endpointHost = "<unparseable>";
      }
    }
    const hexOnly = /^[0-9a-f]+$/i;
    return {
      endpointHost,
      bucket: this.cfg.bucket,
      region: this.cfg.region,
      forcePathStyle: this.cfg.forcePathStyle,
      accessKeyIdLength: this.cfg.accessKeyId.length,
      secretAccessKeyLength: this.cfg.secretAccessKey.length,
      accessKeyIdLooksHex: hexOnly.test(this.cfg.accessKeyId),
      secretAccessKeyLooksHex: hexOnly.test(this.cfg.secretAccessKey),
    };
  }

  async upload(key: string, body: Readable, contentType: string): Promise<void> {
    const cfg = this.config();
    const upload = new Upload({
      client: this.client(),
      params: {
        Bucket: cfg.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      },
    });
    await upload.done();
  }

  async getObject(key: string): Promise<StorageObject> {
    const cfg = this.config();
    try {
      const out = await this.client().send(
        new GetObjectCommand({ Bucket: cfg.bucket, Key: key }),
      );
      const body = out.Body;
      if (!body || !(body instanceof Readable)) {
        throw new Error("S3 GetObject returned no readable body");
      }
      return {
        stream: body,
        contentType: out.ContentType || "application/octet-stream",
        size: typeof out.ContentLength === "number" ? out.ContentLength : undefined,
      };
    } catch (err) {
      if (isNotFound(err)) throw new NotFoundError(key);
      throw err;
    }
  }

  async delete(key: string): Promise<void> {
    const cfg = this.config();
    try {
      await this.client().send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key: key }));
    } catch (err) {
      if (isNotFound(err)) return;
      throw err;
    }
  }

  async exists(key: string): Promise<boolean> {
    const cfg = this.config();
    try {
      await this.client().send(new HeadObjectCommand({ Bucket: cfg.bucket, Key: key }));
      return true;
    } catch (err) {
      if (isNotFound(err)) return false;
      throw err;
    }
  }

  // Time-limited HTTPS GET URL that an external service can fetch.
  // R2 supports SigV4 presigned URLs natively — no bucket-public access
  // toggle needed. TTL is capped at 7 days by AWS SigV4 spec; we keep
  // Shotstack-bound URLs short (1 hour) so leaked URLs auto-expire well
  // before they could be reused.
  async getSignedDownloadUrl(key: string, ttlSeconds: number): Promise<string | null> {
    const cfg = this.config();
    const cmd = new GetObjectCommand({ Bucket: cfg.bucket, Key: key });
    // Cast around a transient @smithy/types version skew between
    // @aws-sdk/client-s3 and @aws-sdk/s3-request-presigner. The runtime
    // contract is unchanged — both packages target the same S3 wire API.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return getSignedUrl(this.client() as any, cmd as any, { expiresIn: ttlSeconds });
  }

  // Time-limited HTTPS PUT URL for direct browser-to-R2 uploads.
  //
  // The browser PUTs the file body straight to this URL — the API server
  // is NOT in the upload data path, which means:
  //   • No Vercel Edge body-size limit (was ~4.5 MB on Hobby proxy)
  //   • No Railway request timeout on file data transit
  //   • Ceiling is R2's 5 GB single-PUT limit (use multipart above that)
  //
  // The presigned URL embeds the bucket, key, content-type, and a SigV4
  // signature that expires after `ttlSeconds`. The browser must send
  // Content-Type exactly matching what was signed — a mismatch causes a
  // 403 from R2. After the PUT completes the browser notifies the API
  // via POST /confirm-upload, which calls HeadObject to verify the object
  // landed and then inserts the media_files DB record.
  //
  // Requires the R2 bucket CORS policy to allow PUT from the web origin:
  //   AllowedOrigins: ["https://www.useoffloadr.com"]
  //   AllowedMethods: ["PUT", "HEAD"]
  //   AllowedHeaders: ["Content-Type", "Content-Length"]
  //   ExposeHeaders:  ["ETag"]
  async getSignedUploadUrl(
    key: string,
    contentType: string,
    ttlSeconds: number,
  ): Promise<string | null> {
    const cfg = this.config();
    const cmd = new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      ContentType: contentType,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return getSignedUrl(this.client() as any, cmd as any, { expiresIn: ttlSeconds });
  }
}
