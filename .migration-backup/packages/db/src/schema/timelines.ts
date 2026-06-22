import { pgTable, serial, integer, boolean, jsonb, timestamp, varchar } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";

export const timelinesTable = pgTable("timelines", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  // Stage 2.1.5c — when a student initiates "Prepare First Cut" we mint a
  // timeline row owned by that student. Teacher-side smart_draft jobs leave
  // this null. Ownership is the basis for student-scoped GET/PATCH.
  studentAccountId: integer("student_account_id"),
  smartDraftGenerated: boolean("smart_draft_generated").notNull().default(false),
  provider: varchar("provider", { length: 40 }),
  data: jsonb("data").notNull().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Timeline = typeof timelinesTable.$inferSelect;
