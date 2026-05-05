import { pgTable, serial, integer, varchar, text, timestamp, bigint, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";

export const fileTypeEnum = pgEnum("file_type", [
  "audio",
  "video",
  "image",
  "project_file",
  "document",
  "export",
  "other",
]);

export const uploadStatusEnum = pgEnum("upload_status", [
  "pending",
  "uploading",
  "uploaded",
  "failed",
  "processing",
]);

export const mediaFilesTable = pgTable("media_files", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  originalFileName: varchar("original_file_name", { length: 500 }).notNull(),
  cleanFileName: varchar("clean_file_name", { length: 500 }),
  fileType: fileTypeEnum("file_type").notNull().default("other"),
  mediaRole: varchar("media_role", { length: 100 }),
  fileSize: bigint("file_size", { mode: "number" }).notNull().default(0),
  duration: integer("duration"),
  uploadStatus: uploadStatusEnum("upload_status").notNull().default("pending"),
  storagePath: text("storage_path"),
  publicUrl: text("public_url"),
  notes: text("notes"),
  checksum: varchar("checksum", { length: 64 }),
  uploadedAt: timestamp("uploaded_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertMediaFileSchema = createInsertSchema(mediaFilesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertMediaFile = z.infer<typeof insertMediaFileSchema>;
export type MediaFile = typeof mediaFilesTable.$inferSelect;
