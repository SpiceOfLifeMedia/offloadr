import {
  pgTable,
  varchar,
  integer,
  timestamp,
  text,
  index,
} from "drizzle-orm/pg-core";
import { studentAccountsTable } from "./student-accounts";
import { organizationsTable } from "./organizations";

// Separate session system from teacher/admin (express-session +
// connect-pg-simple). Different cookie name, different middleware. The
// primary key is the SHA-256 hex digest of the raw cookie token — the raw
// token only ever exists in the client cookie, so a DB compromise does
// not yield session-stealing material.
export const studentSessionsTable = pgTable(
  "student_sessions",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    studentAccountId: integer("student_account_id")
      .notNull()
      .references(() => studentAccountsTable.id, { onDelete: "cascade" }),
    // Denormalised so we can answer "what org is this session in?" without
    // a join on every authenticated request.
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    // Absolute expiry — 8 hours from issue.
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    // Salted SHA-256 hash. Raw IPs of minors are never stored.
    ipHash: varchar("ip_hash", { length: 64 }),
    userAgent: text("user_agent"),
  },
  (t) => ({
    studentIdx: index("student_sessions_student_idx").on(
      t.studentAccountId,
      t.expiresAt,
    ),
  }),
);

export type StudentSession = typeof studentSessionsTable.$inferSelect;
