import { db, mediaFilesTable } from "@workspace/db";
import { sum } from "drizzle-orm";
import { deleteFromStorage } from "./objectStorage";

export async function deleteFileFromStorage(storagePath: string): Promise<void> {
  await deleteFromStorage(storagePath);
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
