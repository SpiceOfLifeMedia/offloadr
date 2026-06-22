import { pool } from "./index";

export interface DbPingResult {
  ok: boolean;
  host: string;
  errorClass?:
    | "disabled_endpoint"
    | "auth_failed"
    | "host_not_found"
    | "connection_refused"
    | "tls_error"
    | "timeout"
    | "missing_database"
    | "unknown";
  errorMessage?: string;
  nextSteps?: string[];
}

function safeHost(rawUrl: string | undefined): string {
  if (!rawUrl) return "<DATABASE_URL not set>";
  try {
    const u = new URL(rawUrl);
    const port = u.port ? `:${u.port}` : "";
    return `${u.hostname}${port}`;
  } catch {
    return "<unparseable DATABASE_URL>";
  }
}

function classify(err: unknown): {
  errorClass: NonNullable<DbPingResult["errorClass"]>;
  nextSteps: string[];
} {
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
      errorClass: "disabled_endpoint",
      nextSteps: [
        "Open the Database tab in Replit and re-enable / wake the Postgres endpoint.",
        "If using Neon directly, resume the compute endpoint in the Neon console.",
      ],
    };
  }
  if (
    lower.includes("password authentication failed") ||
    code === "28P01" ||
    code === "28000"
  ) {
    return {
      errorClass: "auth_failed",
      nextSteps: [
        "Verify the deployment's DATABASE_URL secret matches the intended database.",
      ],
    };
  }
  if (code === "ENOTFOUND" || lower.includes("getaddrinfo")) {
    return {
      errorClass: "host_not_found",
      nextSteps: ["Verify DATABASE_URL host is correct and current."],
    };
  }
  if (code === "ECONNREFUSED") {
    return {
      errorClass: "connection_refused",
      nextSteps: [
        "Database refused the connection — confirm it is provisioned and reachable.",
      ],
    };
  }
  if (lower.includes("ssl") || lower.includes("tls")) {
    return {
      errorClass: "tls_error",
      nextSteps: ["Check sslmode in the connection string."],
    };
  }
  if (code === "ETIMEDOUT" || lower.includes("timeout")) {
    return {
      errorClass: "timeout",
      nextSteps: [
        "Endpoint may be cold-starting or unreachable. Re-enable in the Database tab if needed.",
      ],
    };
  }
  if (
    code === "3D000" ||
    (lower.includes("database") && lower.includes("does not exist"))
  ) {
    return {
      errorClass: "missing_database",
      nextSteps: ["Confirm the database name in DATABASE_URL is correct."],
    };
  }
  return {
    errorClass: "unknown",
    nextSteps: [
      "Run `pnpm run db:check` for a full diagnostic against this DATABASE_URL.",
    ],
  };
}

export async function pingDatabase(timeoutMs = 5000): Promise<DbPingResult> {
  const host = safeHost(process.env.DATABASE_URL);
  try {
    const client = await Promise.race([
      pool.connect(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Database ping timed out after ${timeoutMs}ms`)),
          timeoutMs,
        ),
      ),
    ]);
    try {
      await client.query("SELECT 1");
    } finally {
      client.release();
    }
    return { ok: true, host };
  } catch (err) {
    const c = classify(err);
    const errorMessage =
      err instanceof Error ? err.message : "Unknown database error";
    return {
      ok: false,
      host,
      errorClass: c.errorClass,
      errorMessage,
      nextSteps: c.nextSteps,
    };
  }
}

export function formatDbPingFailure(r: DbPingResult): string {
  if (r.ok) return "";
  const lines = [
    "",
    "✗ Database health check FAILED at startup",
    `  Database:   ${r.host}`,
    `  Error type: ${r.errorClass}`,
    `  Detail:     ${r.errorMessage}`,
    "  Next steps:",
    ...(r.nextSteps ?? []).map((s) => `    • ${s}`),
    "",
  ];
  return lines.join("\n");
}
