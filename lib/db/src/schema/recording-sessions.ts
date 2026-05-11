import { pgTable, serial, integer, varchar, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";
import { usersTable } from "./users";

export const recordingSessionStatusEnum = pgEnum("recording_session_status", [
  "idle",
  "ready",
  "recording",
  "stopping",
  "uploading",
  "complete",
  "error",
]);

export const recordingSessionSourceEnum = pgEnum("recording_session_source", [
  "hardware",
  "simulated",
  "browser_demo",
]);

export const recordingSessionsTable = pgTable("recording_sessions", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  status: recordingSessionStatusEnum("status").notNull().default("idle"),
  source: recordingSessionSourceEnum("source").notNull().default("simulated"),
  label: varchar("label", { length: 255 }),
  startedAt: timestamp("started_at"),
  stoppedAt: timestamp("stopped_at"),
  durationMs: integer("duration_ms"),
  // Lightweight only: array of file IDs / manifest references. Never blob data.
  fileRefs: jsonb("file_refs").$type<Array<{ id: string; label?: string; mediaFileId?: number }>>().notNull().default([]),
  errorMessage: varchar("error_message", { length: 1000 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertRecordingSessionSchema = createInsertSchema(recordingSessionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertRecordingSession = z.infer<typeof insertRecordingSessionSchema>;
export type RecordingSession = typeof recordingSessionsTable.$inferSelect;
