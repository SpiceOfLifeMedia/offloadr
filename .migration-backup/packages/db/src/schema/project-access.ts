import {
  pgTable,
  serial,
  integer,
  boolean,
  timestamp,
  uniqueIndex,
  index,
  foreignKey,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";
import { classesTable } from "./classes";
import { studentAccountsTable } from "./student-accounts";
import { organizationsTable } from "./organizations";
import { usersTable } from "./users";

// Per-class access for a project. V1 keeps this 1:N (one project belongs
// to one class) per the user's decision in §9.1 of the plan, but the
// schema supports many-to-many to avoid a future breaking migration.
//
// Tenant integrity: organization_id is denormalised here. The composite
// FKs force project AND class to share the same org. A route bug or
// manual write linking a project in org A to a class in org B is rejected
// at the DB layer.
export const projectClassAccessTable = pgTable(
  "project_class_access",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id").notNull(),
    classId: integer("class_id").notNull(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    canUpload: boolean("can_upload").notNull().default(true),
    canViewOwn: boolean("can_view_own").notNull().default(true),
    // "Can students see each other's work?" — default off.
    canViewClass: boolean("can_view_class").notNull().default(false),
    opensAt: timestamp("opens_at", { withTimezone: true }),
    closesAt: timestamp("closes_at", { withTimezone: true }),
    addedByUserId: integer("added_by_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    projectClassUnique: uniqueIndex("project_class_access_unique").on(
      t.projectId,
      t.classId,
    ),
    orgIdx: index("project_class_access_org_idx").on(t.organizationId),
    projectOrgFk: foreignKey({
      name: "project_class_access_project_org_fk",
      columns: [t.projectId, t.organizationId],
      foreignColumns: [projectsTable.id, projectsTable.organizationId],
    }).onDelete("cascade"),
    classOrgFk: foreignKey({
      name: "project_class_access_class_org_fk",
      columns: [t.classId, t.organizationId],
      foreignColumns: [classesTable.id, classesTable.organizationId],
    }).onDelete("cascade"),
  }),
);

// One-off per-student access for exceptions to the class-based model
// (e.g. a single student who needs to upload to a project their class
// isn't otherwise assigned to).
export const projectStudentAccessTable = pgTable(
  "project_student_access",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id").notNull(),
    studentAccountId: integer("student_account_id").notNull(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    canUpload: boolean("can_upload").notNull().default(true),
    canViewOwn: boolean("can_view_own").notNull().default(true),
    addedByUserId: integer("added_by_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    projectStudentUnique: uniqueIndex("project_student_access_unique").on(
      t.projectId,
      t.studentAccountId,
    ),
    orgIdx: index("project_student_access_org_idx").on(t.organizationId),
    projectOrgFk: foreignKey({
      name: "project_student_access_project_org_fk",
      columns: [t.projectId, t.organizationId],
      foreignColumns: [projectsTable.id, projectsTable.organizationId],
    }).onDelete("cascade"),
    studentOrgFk: foreignKey({
      name: "project_student_access_student_org_fk",
      columns: [t.studentAccountId, t.organizationId],
      foreignColumns: [
        studentAccountsTable.id,
        studentAccountsTable.organizationId,
      ],
    }).onDelete("cascade"),
  }),
);

export const insertProjectClassAccessSchema = createInsertSchema(
  projectClassAccessTable,
).omit({ id: true, createdAt: true });

export const insertProjectStudentAccessSchema = createInsertSchema(
  projectStudentAccessTable,
).omit({ id: true, createdAt: true });

export type InsertProjectClassAccess = z.infer<
  typeof insertProjectClassAccessSchema
>;
export type ProjectClassAccess = typeof projectClassAccessTable.$inferSelect;
export type InsertProjectStudentAccess = z.infer<
  typeof insertProjectStudentAccessSchema
>;
export type ProjectStudentAccess =
  typeof projectStudentAccessTable.$inferSelect;
