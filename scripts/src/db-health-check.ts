import pg from "pg";

const { Client } = pg;

const CONNECT_TIMEOUT_MS = 5_000;
const QUERY_TIMEOUT_MS = 3_000;
// NOTE: This script intentionally does not import @workspace/db, because that
// package opens a Pool at import time and we want a single short-lived client
// with explicit timeouts during the pre-publish gate. The runtime equivalent
// (api-server / offloadr-api startup) uses lib/db's pingDatabase() helper,
// which shares the same classification semantics.

type ErrorClass =
  | "disabled_endpoint"
  | "auth_failed"
  | "host_not_found"
  | "connection_refused"
  | "tls_error"
  | "timeout"
  | "missing_database"
  | "unknown";

interface Classified {
  klass: ErrorClass;
  summary: string;
  nextSteps: string[];
}

function safeHost(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    const port = u.port ? `:${u.port}` : "";
    return `${u.hostname}${port}`;
  } catch {
    return "<unparseable DATABASE_URL>";
  }
}

function classify(err: unknown): Classified {
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : JSON.stringify(err);
  const lower = msg.toLowerCase();
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code?: unknown }).code ?? "")
      : "";

  if (
    lower.includes("endpoint has been disabled") ||
    lower.includes("endpoint is disabled") ||
    lower.includes("compute endpoint")
  ) {
    return {
      klass: "disabled_endpoint",
      summary:
        "The Postgres endpoint backing this database appears to be disabled or suspended.",
      nextSteps: [
        "Open the Database tab in this Replit workspace and re-enable / wake the endpoint.",
        "If using Neon directly, log into the Neon console and resume the compute endpoint.",
        "Then re-run `pnpm run db:check` to confirm before retrying Publish.",
      ],
    };
  }
  if (
    lower.includes("password authentication failed") ||
    lower.includes("role") && lower.includes("does not exist") ||
    code === "28P01" ||
    code === "28000"
  ) {
    return {
      klass: "auth_failed",
      summary: "The database refused the credentials in DATABASE_URL.",
      nextSteps: [
        "Confirm the deployment's DATABASE_URL secret matches the database you intend to deploy against.",
        "Rotate / re-copy the connection string from the Database tab if it was recently changed.",
      ],
    };
  }
  if (
    code === "ENOTFOUND" ||
    lower.includes("getaddrinfo") ||
    lower.includes("enotfound")
  ) {
    return {
      klass: "host_not_found",
      summary: "DNS lookup failed for the database host in DATABASE_URL.",
      nextSteps: [
        "Verify DATABASE_URL points at the correct host (typo, wrong region, stale URL).",
        "If the database was recreated, copy the new connection string from the Database tab.",
      ],
    };
  }
  if (code === "ECONNREFUSED" || lower.includes("econnrefused")) {
    return {
      klass: "connection_refused",
      summary: "The database host refused the TCP connection.",
      nextSteps: [
        "The database may be down, paused, or behind a firewall.",
        "Open the Database tab and confirm the database is provisioned and reachable.",
      ],
    };
  }
  if (lower.includes("self signed") || lower.includes("ssl") || lower.includes("tls")) {
    return {
      klass: "tls_error",
      summary: "TLS / SSL negotiation with the database failed.",
      nextSteps: [
        "Verify the connection string includes the correct sslmode (e.g. `?sslmode=require`).",
        "Check that the deployment environment trusts the database's certificate chain.",
      ],
    };
  }
  if (
    code === "ETIMEDOUT" ||
    lower.includes("timeout") ||
    lower.includes("timed out")
  ) {
    return {
      klass: "timeout",
      summary: `Database did not respond within ${CONNECT_TIMEOUT_MS}ms.`,
      nextSteps: [
        "The endpoint may be cold-starting, paused, or unreachable from this network.",
        "Wait a few seconds and re-run `pnpm run db:check`. If it keeps failing, re-enable the endpoint in the Database tab.",
      ],
    };
  }
  if (lower.includes("database") && lower.includes("does not exist") || code === "3D000") {
    return {
      klass: "missing_database",
      summary: "The Postgres server is reachable but the named database does not exist.",
      nextSteps: [
        "Confirm the database name in DATABASE_URL is correct.",
        "Recreate / re-provision the database if it was dropped.",
      ],
    };
  }
  return {
    klass: "unknown",
    summary: `Unrecognised database error: ${msg}`,
    nextSteps: [
      "Run `pnpm run db:check` locally for a full trace.",
      "Verify the deployment's DATABASE_URL secret points at the intended database.",
    ],
  };
}

function fail(host: string, c: Classified): never {
  const lines = [
    "",
    "✗ Pre-publish database health check FAILED",
    "",
    `  Database:   ${host}`,
    `  Error type: ${c.klass}`,
    `  Detail:     ${c.summary}`,
    "",
    "  Next steps:",
    ...c.nextSteps.map((s) => `    • ${s}`),
    "",
    "  Aborting before schema-diff / deploy. No changes were pushed.",
    "",
  ];
  process.stderr.write(lines.join("\n") + "\n");
  process.exit(1);
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    process.stdout.write(
      "db-health-check: DATABASE_URL not set; skipping (no DB-backed deploy).\n",
    );
    return;
  }

  const host = safeHost(url);
  const client = new Client({
    connectionString: url,
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
    statement_timeout: QUERY_TIMEOUT_MS,
    query_timeout: QUERY_TIMEOUT_MS,
  });

  try {
    await client.connect();
    const res = await client.query("SELECT 1 AS ok");
    if (res.rows[0]?.ok !== 1) {
      fail(host, {
        klass: "unknown",
        summary: "Database responded but `SELECT 1` did not return 1.",
        nextSteps: ["Investigate the database state manually."],
      });
    }
    if (process.env.DB_HEALTH_CHECK_VERBOSE === "1") {
      process.stdout.write(`db-health-check: ${host} OK\n`);
    }
  } catch (err) {
    fail(host, classify(err));
  } finally {
    try {
      await client.end();
    } catch {
      /* ignore */
    }
  }
}

main().catch((err) => {
  const host = safeHost(process.env.DATABASE_URL ?? "");
  fail(host, classify(err));
});
