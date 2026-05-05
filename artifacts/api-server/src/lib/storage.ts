import path from "path";
import fs from "fs";
import { db, mediaFilesTable } from "@workspace/db";
import { sum } from "drizzle-orm";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "./uploads";

export function ensureUploadDir(): void {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

export function getUploadPath(filename: string): string {
  return path.join(UPLOAD_DIR, filename);
}

export function deleteFileFromDisk(storagePath: string): void {
  const fullPath = path.isAbsolute(storagePath) ? storagePath : path.join(UPLOAD_DIR, storagePath);
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }
}

export async function getTotalStorageBytes(): Promise<number> {
  const result = await db
    .select({ total: sum(mediaFilesTable.fileSize) })
    .from(mediaFilesTable);
  return Number(result[0]?.total ?? 0);
}

export function detectFileType(mimetype: string): "audio" | "video" | "image" | "project_file" | "document" | "export" | "other" {
  if (mimetype.startsWith("audio/")) return "audio";
  if (mimetype.startsWith("video/")) return "video";
  if (mimetype.startsWith("image/")) return "image";
  if (mimetype.includes("pdf") || mimetype.includes("document")) return "document";
  if (mimetype.includes("zip") || mimetype.includes("tar") || mimetype.includes("compressed")) return "export";
  if (mimetype.includes("premiere") || mimetype.includes("davinci") || mimetype.includes("fcpx")) return "project_file";
  return "other";
}
