import { google, type drive_v3 } from "googleapis";
import { Readable } from "stream";

const DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive"];
const ROOT_FOLDER_NAME = "Offloadr Media Projects";

export class DriveNotConfiguredError extends Error {
  constructor() {
    super(
      "Google Drive is not configured on this server. Set GOOGLE_SERVICE_ACCOUNT_KEY to a valid service account JSON.",
    );
    this.name = "DriveNotConfiguredError";
  }
}

export class DriveAccessError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "DriveAccessError";
  }
}

/**
 * Normalize the assortment of error shapes that `googleapis` / `gaxios` can
 * throw. Status may live on `err.response.status`, `err.status`, or `err.code`
 * (which can be a number, an HTTP status string, or a network code like
 * `ENOTFOUND`). Returns `null` if no HTTP status can be derived.
 */
function extractHttpStatus(err: unknown): number | null {
  const e = err as {
    response?: { status?: unknown };
    status?: unknown;
    code?: unknown;
  };
  const candidates = [e?.response?.status, e?.status, e?.code];
  for (const c of candidates) {
    if (typeof c === "number" && c >= 100 && c < 600) return c;
    if (typeof c === "string" && /^\d{3}$/.test(c)) return Number(c);
  }
  return null;
}

function extractMessage(err: unknown): string {
  const e = err as { message?: string };
  return e?.message ?? "unknown error";
}

let cachedClient: drive_v3.Drive | null = null;
let cachedServiceAccountEmail: string | null = null;

function loadServiceAccount(): { email: string; client: drive_v3.Drive } {
  if (cachedClient && cachedServiceAccountEmail) {
    return { email: cachedServiceAccountEmail, client: cachedClient };
  }
  const raw = process.env["GOOGLE_SERVICE_ACCOUNT_KEY"];
  if (!raw || !raw.trim()) {
    throw new DriveNotConfiguredError();
  }
  let parsed: { client_email?: string; private_key?: string };
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new DriveAccessError(
      "GOOGLE_SERVICE_ACCOUNT_KEY is set but is not valid JSON. Paste the full service account JSON key file contents.",
    );
  }
  if (!parsed.client_email || !parsed.private_key) {
    throw new DriveAccessError(
      "GOOGLE_SERVICE_ACCOUNT_KEY JSON is missing client_email or private_key.",
    );
  }
  const auth = new google.auth.JWT({
    email: parsed.client_email,
    key: parsed.private_key,
    scopes: DRIVE_SCOPES,
  });
  cachedClient = google.drive({ version: "v3", auth });
  cachedServiceAccountEmail = parsed.client_email;
  return { email: parsed.client_email, client: cachedClient };
}

export function getServiceAccountEmail(): string | null {
  try {
    return loadServiceAccount().email;
  } catch {
    return null;
  }
}

export function isDriveConfigured(): boolean {
  return getServiceAccountEmail() !== null;
}

/**
 * Verify the service account can see the given Shared Drive and has at least
 * Content Manager rights (so it can create folders/files inside it).
 */
export async function verifySharedDriveAccess(
  sharedDriveId: string,
): Promise<{ name: string }> {
  const { client, email } = loadServiceAccount();
  try {
    const res = await client.drives.get({
      driveId: sharedDriveId,
      fields: "id,name,capabilities(canAddChildren)",
    });
    const data = res.data;
    if (!data.capabilities?.canAddChildren) {
      throw new DriveAccessError(
        `The service account ${email} can see this Shared Drive but does not have permission to add files. Share the Shared Drive with this email as Content Manager.`,
      );
    }
    return { name: data.name ?? "Shared Drive" };
  } catch (err: unknown) {
    if (err instanceof DriveAccessError) throw err;
    const status = extractHttpStatus(err);
    if (status === 404) {
      throw new DriveAccessError(
        `Shared Drive "${sharedDriveId}" not found, or the service account ${email} has not been added to it. Share the Shared Drive with ${email} as Content Manager.`,
        err,
      );
    }
    if (status === 403) {
      throw new DriveAccessError(
        `The service account ${email} is not allowed to access this Shared Drive. Add it as Content Manager.`,
        err,
      );
    }
    if (status === 401) {
      throw new DriveAccessError(
        `Google rejected the service account credentials. The GOOGLE_SERVICE_ACCOUNT_KEY may be malformed or revoked.`,
        err,
      );
    }
    throw new DriveAccessError(
      `Failed to verify Shared Drive access: ${extractMessage(err)}`,
      err,
    );
  }
}

/**
 * Find a folder by name directly inside the given parent. Returns the file id
 * or null. Searches inside Shared Drives.
 */
async function findFolderByName(
  client: drive_v3.Drive,
  parentId: string,
  driveId: string,
  name: string,
): Promise<string | null> {
  const safeName = name.replace(/'/g, "\\'");
  const q = `mimeType='application/vnd.google-apps.folder' and trashed=false and name='${safeName}' and '${parentId}' in parents`;
  const res = await client.files.list({
    q,
    corpora: "drive",
    driveId,
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
    fields: "files(id,name)",
    pageSize: 10,
  });
  const file = res.data.files?.[0];
  return file?.id ?? null;
}

async function createFolder(
  client: drive_v3.Drive,
  parentId: string,
  name: string,
): Promise<string> {
  const res = await client.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    supportsAllDrives: true,
    fields: "id",
  });
  if (!res.data.id) {
    throw new DriveAccessError(`Drive create folder for "${name}" returned no id`);
  }
  return res.data.id;
}

async function ensureFolder(
  client: drive_v3.Drive,
  parentId: string,
  driveId: string,
  name: string,
): Promise<string> {
  const existing = await findFolderByName(client, parentId, driveId, name);
  if (existing) return existing;
  return createFolder(client, parentId, name);
}

/**
 * Ensure the "Offloadr Media Projects" root folder exists at the top of the
 * given Shared Drive. Idempotent: if it already exists, return its id.
 */
export async function ensureRootFolder(
  sharedDriveId: string,
): Promise<{ folderId: string; folderName: string }> {
  const { client } = loadServiceAccount();
  const folderId = await ensureFolder(client, sharedDriveId, sharedDriveId, ROOT_FOLDER_NAME);
  return { folderId, folderName: ROOT_FOLDER_NAME };
}

/**
 * Provision the standard project subfolder structure inside the school's
 * root folder. Returns the project folder id and a map of subfolder names
 * to their drive ids.
 */
export async function provisionProjectFolders(
  sharedDriveId: string,
  rootFolderId: string,
  projectName: string,
): Promise<{
  projectFolderId: string;
  subfolders: Record<string, string>;
}> {
  const { client } = loadServiceAccount();
  const projectFolderId = await ensureFolder(
    client,
    rootFolderId,
    sharedDriveId,
    projectName,
  );
  const subfolderNames = ["Audio", "Video", "Images", "Notes", "Exports"];
  const subfolders: Record<string, string> = {};
  for (const name of subfolderNames) {
    subfolders[name] = await ensureFolder(client, projectFolderId, sharedDriveId, name);
  }
  return { projectFolderId, subfolders };
}

/**
 * Upload a file (from a Node Readable stream) to a specific Drive folder.
 * Uses resumable upload internally via the Drive SDK so files of any size
 * are supported.
 */
export async function uploadFileToFolder(args: {
  parentFolderId: string;
  fileName: string;
  mimeType: string;
  body: Readable;
}): Promise<{ fileId: string; webViewLink: string | null }> {
  const { client } = loadServiceAccount();
  const res = await client.files.create({
    requestBody: {
      name: args.fileName,
      parents: [args.parentFolderId],
    },
    media: {
      mimeType: args.mimeType,
      body: args.body,
    },
    supportsAllDrives: true,
    fields: "id,webViewLink",
  });
  if (!res.data.id) {
    throw new DriveAccessError("Drive upload returned no file id");
  }
  return { fileId: res.data.id, webViewLink: res.data.webViewLink ?? null };
}

export async function deleteDriveFile(fileId: string): Promise<void> {
  const { client } = loadServiceAccount();
  await client.files.delete({ fileId, supportsAllDrives: true });
}

export async function getDriveFolderWebViewLink(
  folderId: string,
): Promise<string | null> {
  const { client } = loadServiceAccount();
  const res = await client.files.get({
    fileId: folderId,
    fields: "webViewLink",
    supportsAllDrives: true,
  });
  return res.data.webViewLink ?? null;
}

export function getDriveFileStream(fileId: string): Promise<Readable> {
  const { client } = loadServiceAccount();
  return client.files
    .get(
      { fileId, alt: "media", supportsAllDrives: true },
      { responseType: "stream" },
    )
    .then((res) => res.data as Readable);
}
