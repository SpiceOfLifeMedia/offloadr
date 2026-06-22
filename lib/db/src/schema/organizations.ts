import { pgTable, serial, integer, varchar, text, timestamp, boolean, pgEnum, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

// ---------- Organization (tenant) ----------
// Internal name: "organization". User-facing copy in the Offloadr UI still
// reads as "School" — do not rename labels in the frontend; rename only types,
// API paths, query keys, and DB identifiers.

export const organizationStatusEnum = pgEnum("school_status", [
  "active",
  "trialing",
  "suspended",
  "archived",
]);

export const organizationPlanTierEnum = pgEnum("school_plan_tier", [
  "starter",
  "standard",
  "program",
]);

// V1 role set: admin, producer, student.
//   - owner role retired: collapsed into admin + the new is_owner flag.
//   - teacher role retired: renamed to producer.
// Migration mapping handled in lib/db/migrations/2026-05-14_organization_tenancy_v1_roles.sql.
export const organizationMembershipRoleEnum = pgEnum("organization_membership_role", [
  "admin",
  "producer",
  "student",
]);

export const storageModeEnum = pgEnum("storage_mode", [
  "object_storage",
  "google_drive",
]);

export const organizationsTable = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 80 }).notNull().unique(),
  status: organizationStatusEnum("status").notNull().default("active"),
  planTier: organizationPlanTierEnum("plan_tier").notNull().default("starter"),
  displayName: varchar("display_name", { length: 255 }),
  logoUrl: text("logo_url"),
  storageMode: storageModeEnum("storage_mode").notNull().default("object_storage"),
  driveSharedDriveId: varchar("drive_shared_drive_id", { length: 128 }),
  driveRootFolderId: varchar("drive_root_folder_id", { length: 128 }),
  driveConnectedAt: timestamp("drive_connected_at", { withTimezone: true }),
  // Student-accounts feature flag (per-org). Until flipped on, the org
  // continues to use the upload-code-only flow exactly as today.
  studentAccountsEnabled: boolean("student_accounts_enabled")
    .notNull()
    .default(false),
  // Org-level switch to allow/disallow Quick Upload Mode. Default true so
  // existing pilot orgs keep working with no change. Security-sensitive
  // schools can flip this to false later.
  quickUploadModeAllowed: boolean("quick_upload_mode_allowed")
    .notNull()
    .default(true),
  // Default username generation pattern for new student accounts in this
  // org. Null = use the platform default ("firstname.lastInitial+year").
  // Configurable surface lives in a later stage; column reserved now.
  studentUsernameFormat: varchar("student_username_format", { length: 80 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const organizationMembershipsTable = pgTable(
  "organization_memberships",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    role: organizationMembershipRoleEnum("role").notNull().default("producer"),
    // is_owner is a marker, not a role. Only admins should ever have it true,
    // and exactly one admin per org is the owner (the user who created it).
    isOwner: boolean("is_owner").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    userOrgUnique: uniqueIndex("organization_memberships_user_org_unique").on(
      t.userId,
      t.organizationId,
    ),
  }),
);

export const insertOrganizationSchema = createInsertSchema(organizationsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOrganizationMembershipSchema = createInsertSchema(
  organizationMembershipsTable,
).omit({
  id: true,
  createdAt: true,
});

export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizationsTable.$inferSelect;
export type InsertOrganizationMembership = z.infer<typeof insertOrganizationMembershipSchema>;
export type OrganizationMembership = typeof organizationMembershipsTable.$inferSelect;
export type OrganizationMembershipRole = "admin" | "producer" | "student";
export type StorageMode = "object_storage" | "google_drive";
