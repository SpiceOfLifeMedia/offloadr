import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const sellerProfiles = pgTable("seller_profiles", {
  id: serial("id").primaryKey(),
  clerkUserId: text("clerk_user_id").unique(),
  name: text("name"),
  email: text("email"),
  phone: text("phone"),
  suburb: text("suburb"),
  address: text("address"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSellerProfileSchema = createInsertSchema(sellerProfiles).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSellerProfile = z.infer<typeof insertSellerProfileSchema>;
export type SellerProfile = typeof sellerProfiles.$inferSelect;
