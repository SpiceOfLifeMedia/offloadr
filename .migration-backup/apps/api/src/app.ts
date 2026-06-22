import path from "node:path";
import express, { type Express, type ErrorRequestHandler } from "express";
import cors from "cors";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pinoHttp from "pino-http";
import { pool } from "@workspace/db";
import router from "./routes";
import { logger } from "./lib/logger";

const isProduction = process.env.NODE_ENV === "production";

const sessionSecret = process.env.SESSION_SECRET;
if (isProduction && (!sessionSecret || sessionSecret.length < 32)) {
  throw new Error(
    "SESSION_SECRET is required in production and must be at least 32 characters. " +
      "Set it in the deployment's secrets panel — never commit a default.",
  );
}

// Persist sessions in Postgres so they survive Fly machine sleep/restart.
// Without this, `express-session`'s default in-memory store loses every
// session whenever the machine stops (which happens constantly under
// auto_stop_machines = "stop"). That manifests as users being silently
// logged out — including mid-upload, which kills 401s on long POSTs.
//
// We deliberately do NOT pass `createTableIfMissing: true`. That option
// makes connect-pg-simple read `node_modules/connect-pg-simple/table.sql`
// at runtime, but esbuild bundles us into a single dist/index.mjs without
// copying that file. In production it fails with ENOENT on the very first
// session write and the user sees "Session could not be saved" on login.
// Instead we run an idempotent CREATE TABLE IF NOT EXISTS at boot via
// `ensureSessionStoreSchema()` — no filesystem dependency, no surprises.
const PgSession = connectPgSimple(session);
const sessionStore = new PgSession({
  pool,
  tableName: "user_sessions",
});

export async function ensureSessionStoreSchema(): Promise<void> {
  // Schema mirrors connect-pg-simple's bundled table.sql. PRIMARY KEY is
  // inlined so the whole thing is a single idempotent CREATE.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "user_sessions" (
      "sid" varchar NOT NULL PRIMARY KEY,
      "sess" json NOT NULL,
      "expire" timestamp(6) NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "IDX_user_sessions_expire" ON "user_sessions" ("expire");
  `);
}

const app: Express = express();

// Required for secure cookies to work behind Replit's TLS-terminating proxy.
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cors({
  origin: true,
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  store: sessionStore,
  secret: sessionSecret ?? "offloadr-dev-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProduction,
    httpOnly: true,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
}));

const apiMountPath = process.env.API_MOUNT_PATH ?? "/api";
app.use(apiMountPath, router);

// Optionally serve the built web bundle from the same process. Enabled by
// setting STATIC_WEB_DIR to the absolute path of the Vite build output
// (e.g. /app/artifacts/offloadr-app/dist in the production Docker image).
// WEB_BASE_PATH is the URL prefix the SPA expects (must match the Vite
// `base` baked into the bundle at build time — e.g. "/offloadr/").
//
// When unset, the API runs API-only (current dev mode, where Vite serves
// the web bundle on its own port). When set, requests under WEB_BASE_PATH
// that don't match the API mount fall through to the static bundle, with
// SPA fallback to index.html for client-side routes.
const staticWebDir = process.env.STATIC_WEB_DIR;
if (staticWebDir) {
  const webBasePath = process.env.WEB_BASE_PATH ?? "/";
  const indexHtmlPath = path.join(staticWebDir, "index.html");

  app.use(
    webBasePath,
    express.static(staticWebDir, {
      index: "index.html",
      maxAge: isProduction ? "1h" : 0,
      fallthrough: true,
    }),
  );

  app.use(webBasePath, (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    // The API is mounted separately at apiMountPath; never serve index.html
    // for paths that would belong to it.
    const relative = req.path.replace(/^\/+/, "");
    if (relative.startsWith("api/") || relative === "api") return next();
    res.sendFile(indexHtmlPath, (err) => {
      if (err) next(err);
    });
  });

  logger.info({ staticWebDir, webBasePath }, "Static web bundle mounted");
}

/**
 * Global error handler. Logs structured context for any error thrown by a
 * route handler and returns a generic message to the client (never the
 * stack or raw error string — those go to logs only).
 *
 * Pino's `redact` config in `lib/logger.ts` strips Authorization / Cookie /
 * Set-Cookie headers from logged requests so we don't leak session tokens
 * here.
 */
const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  // express-rate-limit and CORS preflight may set headers before reaching
  // here; if the response is already streaming, just close it.
  if (res.headersSent) {
    res.end();
    return;
  }
  req.log.error(
    {
      err,
      route: `${req.method} ${req.baseUrl ?? ""}${req.path}`,
      userId: typeof req.session?.userId === "number" ? req.session.userId : null,
      organizationId:
        typeof req.session?.organizationId === "number" ? req.session.organizationId : null,
    },
    "Unhandled error in route handler",
  );
  res.status(500).json({
    error: "Internal Server Error",
    message: "Something went wrong. The error has been logged.",
  });
};
app.use(errorHandler);

export default app;
