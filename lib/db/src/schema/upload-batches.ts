import { pgTable, serial, integer, varchar, bigint, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";

export const uploadBatchesTable = pgTable("upload_batches", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  batchLabel: varchar("batch_label", { length: 255 }),
  totalFiles: integer("total_files").notNull().default(0),
  uploadedFiles: integer("uploaded_files").notNull().default(0),
  failedFiles: integer("failed_files").notNull().default(0),
  totalBytes: bigint("total_bytes", { mode: "number" }).notNull().default(0),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUploadBatchSchema = createInsertSchema(uploadBatchesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUploadBatch = z.infer<typeof insertUploadBatchSchema>;
export type UploadBatch = typeof uploadBatchesTable.$inferSelect;
