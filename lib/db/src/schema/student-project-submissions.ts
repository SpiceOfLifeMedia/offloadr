import {
  pgTable,
  serial,
  integer,
  varchar,
  timestamp,
  bigint,
} from "drizzle-orm/pg-core";

export const studentProjectSubmissionsTable = pgTable(
  "student_project_submissions",
  {
    id: serial("id").primaryKey(),
    submissionId: varchar("submission_id", { length: 64 }).notNull().unique(),
    studentAccountId: integer("student_account_id").notNull(),
    projectId: integer("project_id").notNull(),
    organizationId: integer("organization_id").notNull(),
    fileCount: integer("file_count").notNull().default(0),
    totalBytes: bigint("total_bytes", { mode: "number" })
      .notNull()
      .default(0),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    reopenedAt: timestamp("reopened_at", { withTimezone: true }),
    reopenedByUserId: integer("reopened_by_user_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
);

export type StudentProjectSubmission =
  typeof studentProjectSubmissionsTable.$inferSelect;
