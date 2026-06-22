import { pgTable, serial, integer, varchar, text, timestamp, pgEnum, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";
import { organizationsTable } from "./organizations";

export const activityActorKindEnum = pgEnum("activity_actor_kind", [
  "user",
  "student_account",
  "system",
]);

export const activityLogsTable = pgTable(
  "activity_logs",
  {
    id: serial("id").primaryKey(),
    // project_id is nullable as of Stage 2.1 so org-scoped events
    // (student login/logout/lockout/password change) can be audit-logged
    // without inventing a fake project. Project-scoped activity still
    // populates it as before.
    projectId: integer("project_id").references(() => projectsTable.id, {
      onDelete: "cascade",
    }),
    organizationId: integer("organization_id").references(
      () => organizationsTable.id,
      { onDelete: "cascade" },
    ),
    userId: integer("user_id"),
    // Backfilled in migration, then locked to NOT NULL by the same
    // migration. The runtime logActivity() helper always sets this.
    actorKind: activityActorKindEnum("actor_kind").notNull(),
    // Populated when actorKind = 'student_account'. Not an FK — see same
    // reasoning as media_files.uploader_student_account_id.
    actorStudentAccountId: integer("actor_student_account_id"),
    // Salted SHA-256 of caller IP. Raw IPs of minors are never logged.
    // For staff routes this is also a hash (consistent treatment).
    ipHash: varchar("ip_hash", { length: 64 }),
    action: varchar("action", { length: 100 }).notNull(),
    message: text("message").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index("activity_logs_org_idx").on(t.organizationId, t.createdAt),
    actorStudentIdx: index("activity_logs_actor_student_idx").on(
      t.actorStudentAccountId,
    ),
  }),
);

export const insertActivityLogSchema = createInsertSchema(activityLogsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLogsTable.$inferSelect;
