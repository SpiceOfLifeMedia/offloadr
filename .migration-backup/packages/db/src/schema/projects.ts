import { pgTable, serial, integer, varchar, text, timestamp, pgEnum, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { organizationsTable, storageModeEnum } from "./organizations";

export const projectStatusEnum = pgEnum("project_status", [
  "draft",
  "uploading",
  "review_needed",
  "ready_for_editor",
  "delivered",
  "archived",
]);

export const submissionStatusEnum = pgEnum("submission_status", [
  "draft",
  "needs_review",
  "approved",
  "rejected",
  "exported",
]);

export const studentWorkflowChoiceEnum = pgEnum("student_workflow_choice", [
  "smart_draft",
  "manual",
]);

// Project-level workflow type. Drives which file-role tags the upload
// UI surfaces (podcast vs general video) and is the seed for future
// workflow-aware behavior (AI first-cut rules, render templates,
// teacher review layout). V1 only ships two values; the enum is
// designed to be extended (school_news, documentary, short_film, etc.)
// without a breaking migration.
export const projectWorkflowTypeEnum = pgEnum("project_workflow_type", [
  "podcast_studio",
  "general_video",
]);

// How students get into a project.
//   - quick_upload: the existing upload-code-only flow. Default for all
//     existing rows so the pilot keeps working with zero changes.
//   - student_accounts: only authenticated students with class/project
//     access can upload.
//   - both: a project that accepts both auth'd students and a fallback
//     upload code (e.g. relief teacher day on top of normal class access).
//   - closed: uploads disabled entirely.
export const projectAccessModeEnum = pgEnum("project_access_mode", [
  "quick_upload",
  "student_accounts",
  "both",
  "closed",
]);

export const projectsTable = pgTable("projects", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  organizationId: integer("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  // (id, organization_id) composite unique declared below.
  projectName: varchar("project_name", { length: 255 }).notNull(),
  episodeTitle: varchar("episode_title", { length: 255 }),
  clientName: varchar("client_name", { length: 255 }),
  recordingDate: varchar("recording_date", { length: 50 }),
  status: projectStatusEnum("status").notNull().default("draft"),
  description: text("description"),
  editorNotes: text("editor_notes"),
  expectedCameraCount: integer("expected_camera_count"),
  expectedAudioSetup: varchar("expected_audio_setup", { length: 100 }),
  classGroup: varchar("class_group", { length: 120 }),
  lessonType: varchar("lesson_type", { length: 40 }),
  studentInstructions: text("student_instructions"),
  uploadMethod: varchar("upload_method", { length: 40 }),
  dueDate: varchar("due_date", { length: 50 }),
  submissionStatus: submissionStatusEnum("submission_status").notNull().default("draft"),
  studentWorkflowChoice: studentWorkflowChoiceEnum("student_workflow_choice"),
  studentWorkflowChoiceAt: timestamp("student_workflow_choice_at"),
  projectWorkflowType: projectWorkflowTypeEnum("project_workflow_type")
    .notNull()
    .default("general_video"),
  accessMode: projectAccessModeEnum("access_mode")
    .notNull()
    .default("quick_upload"),
  storageMode: storageModeEnum("storage_mode").notNull().default("object_storage"),
  driveFolderId: varchar("drive_folder_id", { length: 128 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
},
(t) => ({
  // Composite unique used as the FK target for tenant-consistency composite
  // FKs from project_class_access and project_student_access.
  idOrgUnique: uniqueIndex("projects_id_org_unique").on(
    t.id,
    t.organizationId,
  ),
}));

export const insertProjectSchema = createInsertSchema(projectsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;
