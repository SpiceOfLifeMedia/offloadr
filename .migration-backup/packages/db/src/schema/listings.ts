import { pgTable, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const listings = pgTable("listings", {
  id: text("id").primaryKey(),
  code: text("code"),
  sellerClerkId: text("seller_clerk_id"),
  sellerName: text("seller_name"),
  sellerEmail: text("seller_email"),
  sellerPhone: text("seller_phone"),
  title: text("title").notNull(),
  price: numeric("price"),
  reservePrice: numeric("reserve_price"),
  suburb: text("suburb"),
  exactAddress: text("exact_address"),
  meetupTimes: text("meetup_times").array(),
  itemNote: text("item_note"),
  description: text("description"),
  sourceUrl: text("source_url"),
  status: text("status").notNull().default("available"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertListingSchema = createInsertSchema(listings).omit({ createdAt: true, updatedAt: true });
export type InsertListing = z.infer<typeof insertListingSchema>;
export type Listing = typeof listings.$inferSelect;
