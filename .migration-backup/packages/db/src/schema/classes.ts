import {
  pgTable,
  serial,
  integer,
  varchar,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";
import { usersTable } from "./users";

// A Class is a roster of students that persists across many projects.
// A Project is one piece of work assigned to a class. The student-auth
// plan deliberately keeps these as separate models.
export const classesTable = pgTable(
  "classes",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    yearLevel: varchar("year_level", { length: 20 }),
    subject: varchar("subject", { length: 80 }),
    externalRef: varchar("external_ref", { length: 120 }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdByUserId: integer("created_by_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index("classes_org_idx").on(t.organizationId, t.archivedAt),
    // Composite unique used as the target of tenant-consistency composite FKs
    // from class_memberships and project_class_access. See the Stage 2.1
    // migration for the FK definitions.
    idOrgUnique: uniqueIndex("classes_id_org_unique").on(
      t.id,
      t.organizationId,
    ),
  }),
);

export const insertClassSchema = createInsertSchema(classesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertClass = z.infer<typeof insertClassSchema>;
export type Class = typeof classesTable.$inferSelect;
