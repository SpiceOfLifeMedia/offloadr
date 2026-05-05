import { pgTable, serial, integer, varchar, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const projectStatusEnum = pgEnum("project_status", [
  "draft",
  "uploading",
  "review_needed",
  "ready_for_editor",
  "delivered",
  "archived",
]);

export const projectsTable = pgTable("projects", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  projectName: varchar("project_name", { length: 255 }).notNull(),
  episodeTitle: varchar("episode_title", { length: 255 }),
  clientName: varchar("client_name", { length: 255 }),
  recordingDate: varchar("recording_date", { length: 50 }),
  status: projectStatusEnum("status").notNull().default("draft"),
  description: text("description"),
  editorNotes: text("editor_notes"),
  expectedCameraCount: integer("expected_camera_count"),
  expectedAudioSetup: varchar("expected_audio_setup", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertProjectSchema = createInsertSchema(projectsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;
