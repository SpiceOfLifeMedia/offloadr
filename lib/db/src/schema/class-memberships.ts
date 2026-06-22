import {
  pgTable,
  serial,
  integer,
  varchar,
  timestamp,
  index,
  foreignKey,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { classesTable } from "./classes";
import { studentAccountsTable } from "./student-accounts";
import { organizationsTable } from "./organizations";
import { usersTable } from "./users";

// Soft-removal preserves audit history of who was in which class when.
// A partial UNIQUE INDEX (class_id, student_account_id) WHERE removed_at IS NULL
// is created in the migration SQL (drizzle-pg-core doesn't model partial unique
// indexes directly).
//
// Tenant integrity: organization_id is denormalised here so the composite FKs
// below force the linked class AND the linked student to share the same org.
// A route bug or manual write linking a class in org A to a student in org B
// is rejected at the DB layer.
export const classMembershipsTable = pgTable(
  "class_memberships",
  {
    id: serial("id").primaryKey(),
    classId: integer("class_id").notNull(),
    studentAccountId: integer("student_account_id").notNull(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    // 'student' for now; reserved for 'media_leader' in a later stage.
    role: varchar("role", { length: 32 }).notNull().default("student"),
    addedByUserId: integer("added_by_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    classStudentIdx: index("class_memberships_class_student_idx").on(
      t.classId,
      t.studentAccountId,
    ),
    studentIdx: index("class_memberships_student_idx").on(t.studentAccountId),
    orgIdx: index("class_memberships_org_idx").on(t.organizationId),
    classOrgFk: foreignKey({
      name: "class_memberships_class_org_fk",
      columns: [t.classId, t.organizationId],
      foreignColumns: [classesTable.id, classesTable.organizationId],
    }).onDelete("cascade"),
    studentOrgFk: foreignKey({
      name: "class_memberships_student_org_fk",
      columns: [t.studentAccountId, t.organizationId],
      foreignColumns: [
        studentAccountsTable.id,
        studentAccountsTable.organizationId,
      ],
    }).onDelete("cascade"),
  }),
);

export const insertClassMembershipSchema = createInsertSchema(
  classMembershipsTable,
).omit({ id: true, createdAt: true });

export type InsertClassMembership = z.infer<typeof insertClassMembershipSchema>;
export type ClassMembership = typeof classMembershipsTable.$inferSelect;
