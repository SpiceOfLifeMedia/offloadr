import { pgTable, serial, integer, varchar, text, jsonb, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { timelinesTable } from "./timelines";

export const renderProviderEnum = pgEnum("render_provider", [
  "descript",
  "shotstack",
  "vizard",
  "creatomate",
  "remotion",
  "stub",
]);

export const renderJobStatusEnum = pgEnum("render_job_status", [
  "queued",
  "submitted",
  "processing",
  "complete",
  "failed",
  "not_configured",
]);

export const renderJobKindEnum = pgEnum("render_job_kind", [
  "smart_draft",
  "final_render",
  "highlight",
]);

export const renderJobsTable = pgTable("render_jobs", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  timelineId: integer("timeline_id").references(() => timelinesTable.id, { onDelete: "set null" }),
  provider: renderProviderEnum("provider").notNull(),
  kind: renderJobKindEnum("kind").notNull().default("smart_draft"),
  status: renderJobStatusEnum("status").notNull().default("queued"),
  externalJobId: varchar("external_job_id", { length: 200 }),
  previewUrl: text("preview_url"),
  finalExportUrl: text("final_export_url"),
  errorMessage: text("error_message"),
  rawPayload: jsonb("raw_payload").notNull().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type RenderJob = typeof renderJobsTable.$inferSelect;
