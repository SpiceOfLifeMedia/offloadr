import { pgTable, serial, integer, varchar, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";

export const editorSharesTable = pgTable("editor_shares", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  shareToken: varchar("share_token", { length: 128 }).notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  expiresAt: timestamp("expires_at"),
  password: varchar("password", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertEditorShareSchema = createInsertSchema(editorSharesTable).omit({
  id: true,
  createdAt: true,
});

export type InsertEditorShare = z.infer<typeof insertEditorShareSchema>;
export type EditorShare = typeof editorSharesTable.$inferSelect;
