import {
  pgTable,
  serial,
  integer,
  varchar,
  text,
  timestamp,
  boolean,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";
import { usersTable } from "./users";

export const studentAccountStatusEnum = pgEnum("student_account_status", [
  "active",
  "suspended",
  "archived",
]);

// Managed student accounts: username + password, scoped to an organization.
// No email required by default — student usernames like "ava.t6" are unique
// only within the org, not globally. See artifacts/offloadr-api/docs/student-auth-plan.md
// section 2 for the full model.
export const studentAccountsTable = pgTable(
  "student_accounts",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    // Stored lowercased; UI must lowercase on input.
    username: varchar("username", { length: 80 }).notNull(),
    displayName: varchar("display_name", { length: 120 }).notNull(),
    givenName: varchar("given_name", { length: 80 }),
    familyName: varchar("family_name", { length: 80 }),
    passwordHash: text("password_hash").notNull(),
    // Set true on creation and on teacher-triggered reset; cleared on
    // first successful change-password.
    passwordMustChange: boolean("password_must_change").notNull().default(true),
    // Optional. Per the plan, schools that don't issue student email
    // simply leave this null forever.
    email: varchar("email", { length: 255 }),
    status: studentAccountStatusEnum("status").notNull().default("active"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    // Per-username lockout (DB-backed; the rate limiter at HTTP edge is
    // a separate defense). Threshold/duration live in the route handler.
    failedLoginCount: integer("failed_login_count").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    createdByUserId: integer("created_by_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    orgUsernameUnique: uniqueIndex("student_accounts_org_username_unique").on(
      t.organizationId,
      t.username,
    ),
    orgStatusIdx: index("student_accounts_org_status_idx").on(
      t.organizationId,
      t.status,
    ),
    // Composite unique used as the FK target for tenant-consistency
    // composite FKs from class_memberships and project_student_access.
    idOrgUnique: uniqueIndex("student_accounts_id_org_unique").on(
      t.id,
      t.organizationId,
    ),
  }),
);

// Audit-only record of teacher/admin password resets. Storing the hash of
// the issued temp password lets a teacher re-print the same login card
// without forcing another reset; it is NOT a reset token.
export const studentPasswordResetsTable = pgTable(
  "student_password_resets",
  {
    id: serial("id").primaryKey(),
    studentAccountId: integer("student_account_id")
      .notNull()
      .references(() => studentAccountsTable.id, { onDelete: "cascade" }),
    issuedTempPasswordHash: text("issued_temp_password_hash").notNull(),
    issuedByUserId: integer("issued_by_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    issuedAt: timestamp("issued_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
  },
  (t) => ({
    studentIdx: index("student_password_resets_student_idx").on(
      t.studentAccountId,
    ),
  }),
);

export const insertStudentAccountSchema = createInsertSchema(
  studentAccountsTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
  failedLoginCount: true,
  lockedUntil: true,
});

export type InsertStudentAccount = z.infer<typeof insertStudentAccountSchema>;
export type StudentAccount = typeof studentAccountsTable.$inferSelect;
export type StudentAccountStatus = "active" | "suspended" | "archived";
export type StudentPasswordReset = typeof studentPasswordResetsTable.$inferSelect;
