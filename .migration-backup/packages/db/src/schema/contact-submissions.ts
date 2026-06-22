import {
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const contactSubmissions = pgTable(
  "contact_submissions",
  {
    id: serial("id").primaryKey(),
    source: text("source").notNull(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    subject: text("subject").notNull(),
    message: text("message").notNull(),
    status: text("status").notNull().default("pending"),
    errorReason: text("error_reason"),
    attempts: integer("attempts").notNull().default(0),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    handledAt: timestamp("handled_at", { withTimezone: true }),
    internalNote: text("internal_note"),
    // Set the moment the system mails the fallback "given up" alert to
    // the fixed admin address so we never re-alert on the same row even
    // if the scheduler keeps re-encountering it. Null means "no alert
    // has been dispatched (yet)" — the row may still be retryable, or
    // may have given up before this column existed.
    alertedAt: timestamp("alerted_at", { withTimezone: true }),
    // Sales-pipeline stage, currently only written by the SITECART
    // admin view. The existing `status` column is owned by the email
    // delivery state machine (`pending`/`sent`/`failed`) so we add a
    // separate column instead of overloading it. Defaults to "new" so
    // every freshly-inserted lead shows up in the team's "to do" pile
    // without a follow-up backfill. Allowed values today are
    // "new", "contacted", "qualified", "not_a_fit" — the column is
    // text so we can iterate the vocabulary without a migration; the
    // PATCH route validates against the canonical set.
    salesStage: text("sales_stage").notNull().default("new"),
    // Audit trail for the stage column only. The PATCH route writes
    // these atomically with `sales_stage` whenever the stage *actually*
    // changes (a no-op re-click does not bump them). `updatedBy` is
    // the identity label of the bearer secret used on the request —
    // currently one of "inbox", "analytics", "export" — because there
    // is no per-user identity behind the shared admin password. Both
    // are nullable for legacy rows that were created or last touched
    // before this column existed; the UI must handle that gracefully.
    salesStageUpdatedAt: timestamp("sales_stage_updated_at", {
      withTimezone: true,
    }),
    salesStageUpdatedBy: text("sales_stage_updated_by"),
  },
  (table) => [
    // Supports the per-source dedupe lookup the SITECART lead route does
    // before inserting (source = ? AND email = ? AND created_at >= ?).
    // Email volume is tiny but this keeps the lookup index-only as the
    // table grows.
    index("contact_submissions_source_email_created_idx").on(
      table.source,
      table.email,
      table.createdAt,
    ),
  ],
);

export type ContactSubmission = typeof contactSubmissions.$inferSelect;
