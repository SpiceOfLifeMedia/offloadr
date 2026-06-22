import {
  pgTable,
  serial,
  integer,
  varchar,
  timestamp,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";
import { organizationsTable } from "./organizations";
import { usersTable } from "./users";

export const studentUploadCodeStatusEnum = pgEnum("student_upload_code_status", [
  "active",
  "closed",
]);

export const studentUploadCodesTable = pgTable(
  "student_upload_codes",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 16 }).notNull(),
    status: studentUploadCodeStatusEnum("status").notNull().default("active"),
    maxUploads: integer("max_uploads"),
    uploadCount: integer("upload_count").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdByUserId: integer("created_by_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    closedAt: timestamp("closed_at"),
  },
  (t) => ({
    codeUnique: uniqueIndex("student_upload_codes_code_unique").on(t.code),
    projectIdx: index("student_upload_codes_project_idx").on(t.projectId),
    orgIdx: index("student_upload_codes_org_idx").on(t.organizationId),
  }),
);

export const insertStudentUploadCodeSchema = createInsertSchema(
  studentUploadCodesTable,
).omit({
  id: true,
  code: true,
  uploadCount: true,
  createdAt: true,
  closedAt: true,
});

export type InsertStudentUploadCode = z.infer<typeof insertStudentUploadCodeSchema>;
export type StudentUploadCode = typeof studentUploadCodesTable.$inferSelect;
export type StudentUploadCodeStatus = "active" | "closed";
