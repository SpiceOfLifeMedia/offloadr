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

// Note on enum values:
//   - "user"            uploaded via the teacher dashboard (logged-in staff)
//   - "student"         uploaded via the legacy Quick Upload Mode code
//                       (no student identity; only a typed name). Retained
//                       as-is for backward compatibility with every existing
//                       row in production.
//   - "student_account" uploaded via the new authenticated student-account
//                       flow. Distinguished from "student" so the teacher
//                       UI can separate the two lanes visually.
export const mediaUploaderKindEnum = pgEnum("media_uploader_kind", [
  "user",
  "student",
  "student_account",
]);

export const processingStatusEnum = pgEnum("processing_status", [
  "uploaded",
  "processing",
  "proxy_ready",
  "failed",
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
  processingStatus: processingStatusEnum("processing_status").notNull().default("uploaded"),
  proxyFileUrl: text("proxy_file_url"),
  thumbnailUrl: text("thumbnail_url"),
  storagePath: text("storage_path"),
  driveFileId: varchar("drive_file_id", { length: 128 }),
  driveWebViewLink: text("drive_web_view_link"),
  publicUrl: text("public_url"),
  notes: text("notes"),
  checksum: varchar("checksum", { length: 64 }),
  uploadedAt: timestamp("uploaded_at"),
  uploaderKind: mediaUploaderKindEnum("uploader_kind").notNull().default("user"),
  studentUploaderName: varchar("student_uploader_name", { length: 120 }),
  studentUploadCodeId: integer("student_upload_code_id"),
  // Populated when uploaderKind = 'student_account'. Intentionally NOT a
  // FK so a deleted student account doesn't cascade-delete their uploaded
  // work; the teacher's project keeps the file with a nulled uploader.
  uploaderStudentAccountId: integer("uploader_student_account_id"),
  // Stage 2.1.5b "Offload Project" handoff. Both NULL = draft (student
  // can still delete). Non-NULL = frozen part of a submission batch.
  // Only ever set for uploader_kind = 'student_account'; legacy
  // 'student' (upload-code) rows always have these NULL.
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  submissionId: varchar("submission_id", { length: 64 }),
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
