# Offloadr — Setup & Rebuild Guide

This guide explains how to rebuild and run Offloadr from a fresh clone of this
GitHub repository.

---

## 1. Prerequisites

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | 24.x | The repo targets Node 24. |
| pnpm | 9+ | Package manager. `npm install -g pnpm` |
| PostgreSQL | 14+ | A reachable Postgres database. |
| rclone | 1.69+ | **Optional** — only needed for Google Drive transfers. Install from https://rclone.org/install/ |

> This is a pnpm **workspace monorepo**. Always run `pnpm`, never `npm`/`yarn`
> (a `preinstall` guard enforces this).

---

## 2. Clone & install

```bash
git clone <your-repo-url> offloadr
cd offloadr
pnpm install
```

If you see a warning like `Ignored build scripts: bcrypt`, approve the native
build once:

```bash
pnpm approve-builds   # select bcrypt
```

---

## 3. Configure environment

```bash
cp .env.example .env
```

Then edit `.env`. The full variable reference is below. On Replit, add these in
the **Secrets** pane instead of a `.env` file. On other hosts, add them in the
platform's environment settings.

### Required

| Variable | Secret? | Description |
| --- | :---: | --- |
| `DATABASE_URL` | yes | Postgres connection string. |
| `SESSION_SECRET` | yes | Long random string (>=32 chars) for signing session cookies. |
| `PORT` | no | API server listen port. **Required** — the server fails to start if unset (the host usually injects it). |
| `BASE_PATH` | no | Build-time base path for the web app. **Required** — the Vite build fails if unset (use `/`). |

### Routing & static serving (optional)

| Variable | Default | Description |
| --- | --- | --- |
| `NODE_ENV` | — | `development` or `production`. |
| `OFFLOADR_ENV` | `pilot` | App stage: `production` / `pilot` / `dev`. |
| `API_MOUNT_PATH` | `/api` | URL prefix for API routes. |
| `WEB_BASE_PATH` | `/` | Base path the web bundle is served from. |
| `STATIC_WEB_DIR` | — | Absolute path to the built web app output (`artifacts/offloadr-app/dist/public`). When set, the API serves the SPA. |
| `APP_BASE_URL` | — | Public URL of the app (used in emails/links). |

> `PORT` and `BASE_PATH` are listed under "Required" above — they are not optional
> despite looking like routing config.

### Storage

| Variable | Default | Secret? | Description |
| --- | --- | :---: | --- |
| `STORAGE_DRIVER` | `fs` | | `fs` (local disk) or `s3` (S3/R2). |
| `STORAGE_FS_ROOT` | — | | Local dir for the `fs` driver. |
| `UPLOADS_DIR` | — | | Temp dir for incoming uploads. |
| `STORAGE_S3_REGION` | — | | Required when `STORAGE_DRIVER=s3`. |
| `STORAGE_S3_BUCKET` | — | | Required when `STORAGE_DRIVER=s3`. |
| `STORAGE_S3_ENDPOINT` | — | | Required for R2/MinIO. |
| `STORAGE_S3_ACCESS_KEY_ID` | — | yes | Required when `STORAGE_DRIVER=s3`. |
| `STORAGE_S3_SECRET_ACCESS_KEY` | — | yes | Required when `STORAGE_DRIVER=s3`. |
| `STORAGE_S3_FORCE_PATH_STYLE` | `false` | | Path-style addressing for S3-compatible stores (e.g. MinIO). |

### Google Drive transfers via rclone (optional)

| Variable | Secret? | Description |
| --- | :---: | --- |
| `RCLONE_REMOTE_NAME` | | Name of the configured rclone remote. |
| `RCLONE_REMOTE_PATH` | | Path within the remote. |
| `GDRIVE_UPLOAD_ROOT` | | Drive folder root for uploads. |
| `GDRIVE_SHARED_DRIVE_ID` | | Shared Drive ID (if applicable). |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | yes | Single-line JSON service-account key (if using the Drive API directly). |
| `RCLONE_CONFIG` | | Path to an rclone config file (alternative to inline service-account creds). |
| `TRANSFER_CONCURRENCY` | | Max concurrent transfers (default `2`). |

> rclone credentials themselves live in rclone's own config file
> (`~/.config/rclone/rclone.conf`), **never** in app env vars.

### Email & misc (optional)

| Variable | Secret? | Description |
| --- | :---: | --- |
| `RESEND_API_KEY` | yes | Resend API key for transactional email. |
| `UPLOAD_NOTIFICATION_EMAIL` | | Recipient for upload notifications (code has a built-in default). |
| `UPLOAD_NOTIFICATION_FROM` | | Sender for upload notifications (code has a built-in default). |
| `RENDER_NOTIFICATION_EMAIL` | | Recipient for render-complete notifications (code has a built-in default). |
| `RENDER_NOTIFICATION_FROM` | | Sender for render-complete notifications (code has a built-in default). |
| `IP_HASH_SALT` | yes | Salt for hashing client IPs. |
| `STUDENT_ACCOUNTS_ENABLED` | | `true`/`false` toggle for the student portal. |
| `LOG_LEVEL` | | Pino log level (`info`, `debug`, ...). |
| `DISABLE_RATE_LIMIT` | | `1` disables rate limiting (dev only). |

---

## 4. Database setup

The schema is defined with Drizzle ORM in `lib/db/src/schema/`. There are no raw
SQL migration files — the schema is applied with `drizzle-kit push`.

```bash
# 1. Make sure DATABASE_URL points at an empty (or existing) Postgres DB
# 2. Push the schema
pnpm --filter @workspace/db run push
```

The API server also creates the `user_sessions` table automatically at startup
(for the Postgres-backed session store), so no manual step is needed for sessions.

---

## 5. Run in development

```bash
# API server (http://localhost:8080 by default)
pnpm --filter @workspace/api-server run dev

# Web app (Vite dev server)
pnpm --filter @workspace/offloadr-app run dev
```

---

## 6. Build for production

```bash
# Typecheck + build everything
pnpm run build
```

Outputs:

- Web app: `artifacts/offloadr-app/dist/public/`
- API server: `artifacts/api-server/dist/index.mjs`

### Serve in production

Run the API server and point it at the built web bundle:

```bash
export NODE_ENV=production
export DATABASE_URL=...        # your Postgres URL
export SESSION_SECRET=...      # long random string
export STATIC_WEB_DIR="$(pwd)/artifacts/offloadr-app/dist/public"
node artifacts/api-server/dist/index.mjs
```

The API serves both the JSON API (under `API_MOUNT_PATH`, default `/api`) and the
static SPA (with client-side routing fallback to `index.html`).

---

## 7. Deploying

### Recommended: a long-running Node host (Replit autoscale, a VM, or a container)

Offloadr is a **stateful, long-running service**. It maintains in-process work
(an rclone transfer queue and a render-job poller) and shells out to the `rclone`
system binary. Deploy it where a persistent Node process and a writable disk are
available.

Suggested settings for a generic Node host:

- **Install:** `pnpm install`
- **Build:** `pnpm run build`
- **Start:** `node artifacts/api-server/dist/index.mjs`
- **Output (web):** `artifacts/offloadr-app/dist/public`
- Set `STATIC_WEB_DIR` to the web `dist/public` path so one process serves both.
- Provide all required env vars and a reachable `DATABASE_URL`.

On **Replit** this is configured as an `autoscale` deployment (see `.replit`).

### Vercel — not supported as-is

This project **cannot be deployed to Vercel without significant rework**, because
Vercel runs serverless/edge functions rather than a persistent server. The
specific blockers:

1. **Long-running Express server with background jobs.** The rclone transfer
   queue and render-job poller run inside the server process and would be killed
   when a serverless function freezes.
2. **`rclone` system binary.** The server shells out to the `rclone` CLI, which
   cannot be bundled/executed in Vercel functions.
3. **Local filesystem usage.** The default `fs` storage driver and upload temp
   dir assume a persistent, writable disk, which serverless functions lack.
4. **Coupled static + API serving.** A single process serves both the API and
   the SPA via `STATIC_WEB_DIR`, which conflicts with Vercel's split
   static-edge / serverless-function model.

To run on Vercel you would need to: deploy the Vite app as a static site, move
background work (rclone transfers, render polling) to a separate always-on worker
service, replace direct `rclone` binary usage with an SDK/worker, and switch
storage to S3/R2 (`STORAGE_DRIVER=s3`). This is a re-architecture, not a config
change.

---

## 8. Useful scripts

| Command | Purpose |
| --- | --- |
| `pnpm install` | Install all workspace deps. |
| `pnpm run typecheck` | Typecheck every package. |
| `pnpm run build` | Typecheck + build every package. |
| `pnpm --filter @workspace/db run push` | Apply DB schema. |
| `pnpm --filter @workspace/api-server run dev` | Run API in dev. |
| `pnpm --filter @workspace/offloadr-app run dev` | Run web app in dev. |
