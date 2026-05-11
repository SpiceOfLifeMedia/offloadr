import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const holds = pgTable("holds", {
  id: text("id").primaryKey(),
  itemId: text("item_id").notNull(),
  buyerName: text("buyer_name"),
  buyerEmail: text("buyer_email"),
  buyerMobile: text("buyer_mobile"),
  selectedTime: text("selected_time"),
  status: text("status").notNull().default("created"),
  paymentIntentId: text("payment_intent_id"),
  buyerToken: text("buyer_token"),
  reservedUntil: timestamp("reserved_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertHoldSchema = createInsertSchema(holds).omit({ createdAt: true, updatedAt: true });
export type InsertHold = z.infer<typeof insertHoldSchema>;
export type Hold = typeof holds.$inferSelect;
