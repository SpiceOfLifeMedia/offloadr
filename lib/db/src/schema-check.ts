import { getTableColumns, getTableName, is, Table } from "drizzle-orm";
import type { Pool } from "pg";
import * as schema from "./schema";

export type MissingColumn = { table: string; column: string };

export type SchemaCheckResult =
  | { ok: true; checked: number; missing: [] }
  | { ok: false; checked: number; missing: MissingColumn[]; error?: string };

/**
 * Walks the Drizzle schema and returns the set of {table, column} pairs the
 * application code expects to exist in Postgres. This is the SQL column name
 * (snake_case), not the Drizzle property name.
 */
function getExpectedSchema(): Map<string, Set<string>> {
  const expected = new Map<string, Set<string>>();
  for (const value of Object.values(schema)) {
    if (!is(value, Table)) continue;
    const tableName = getTableName(value);
    const columns = getTableColumns(value) as Record<string, { name: string }>;
    const set = expected.get(tableName) ?? new Set<string>();
    for (const col of Object.values(columns)) {
      if (col?.name) set.add(col.name);
    }
    expected.set(tableName, set);
  }
  return expected;
}

/**
 * Boot-time / healthcheck schema drift detector.
 *
 * Compares the columns the running code expects (derived from the Drizzle
 * schema objects) against the columns actually present in Postgres, via a
 * single `information_schema.columns` query. Returns the list of missing
 * (table, column) pairs.
 *
 * This catches the "applied a migration locally, forgot to push to Neon"
 * pattern that has burned us three times in a row. It does NOT catch type
 * mismatches, missing tables (those surface as missing columns for that
 * table), constraint drift, or enum value drift — just the bare presence
 * of named columns, which is what the recurring 500s have actually been.
 *
 * Safe to call repeatedly; one round-trip per call.
 */
export async function checkSchemaColumns(pool: Pool): Promise<SchemaCheckResult> {
  const expected = getExpectedSchema();
  const tables = Array.from(expected.keys());
  if (tables.length === 0) {
    return { ok: true, checked: 0, missing: [] };
  }

  let rows: { table_name: string; column_name: string }[];
  try {
    const result = await pool.query<{ table_name: string; column_name: string }>(
      `SELECT table_name, column_name
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = ANY($1::text[])`,
      [tables],
    );
    rows = result.rows;
  } catch (err) {
    return {
      ok: false,
      checked: 0,
      missing: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const actual = new Map<string, Set<string>>();
  for (const row of rows) {
    const set = actual.get(row.table_name) ?? new Set<string>();
    set.add(row.column_name);
    actual.set(row.table_name, set);
  }

  const missing: MissingColumn[] = [];
  for (const [table, cols] of expected) {
    const present = actual.get(table) ?? new Set<string>();
    for (const col of cols) {
      if (!present.has(col)) missing.push({ table, column: col });
    }
  }

  let checked = 0;
  for (const cols of expected.values()) checked += cols.size;

  if (missing.length === 0) {
    return { ok: true, checked, missing: [] };
  }
  return { ok: false, checked, missing };
}
