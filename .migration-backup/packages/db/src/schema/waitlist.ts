import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const waitlistEmails = pgTable("waitlist_emails", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  source: text("source").notNull().default("offly"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type WaitlistEmail = typeof waitlistEmails.$inferSelect;
