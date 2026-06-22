# Offloadr

A media upload/management platform for podcast studios and schools. Students record and upload footage; Offloadr organises it, prepares AI draft videos, and gives teachers a final MP4 to review, download and share.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port from `$PORT`, default 8080)
- `pnpm --filter @workspace/offloadr-app run dev` — run the web app (port from `$PORT`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string (provisioned via Replit)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 + pino logging + connect-pg-simple sessions
- DB: PostgreSQL + Drizzle ORM (30 tables, 340 columns)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec) — do NOT re-run codegen (would overwrite backup's generated files)
- Build: esbuild (CJS bundle) for API, Vite 7 for web
- Auth: bcrypt password hashing, express-session backed by Postgres
- File transfer: rclone v1.69.1 (Nix system package) — CLI-driven, JSON-log progress parsing

## Where things live

- `artifacts/offloadr-app/` — Vite+React web app (all routes/pages in `src/pages/`, shared UI in `src/components/`)
- `artifacts/api-server/` — Express API server (`src/routes/`, `src/lib/`, `src/providers/`)
  - `src/lib/rclone.ts` — rclone service: install check, job tracking, copy runner, cancel
  - `src/routes/rclone.ts` — REST API: GET /rclone/status, POST /rclone/jobs, GET /rclone/jobs[/:id], DELETE /rclone/jobs/:id
- `lib/db/` — Drizzle schema (26 files under `src/schema/`), health/ping utilities
- `lib/api-zod/` — Zod schemas generated from OpenAPI (pre-generated, do not re-run)
- `lib/api-client-react/` — Orval-generated React Query hooks (pre-generated, do not re-run)
- `lib/client/` — shared API client helpers
- `lib/upload/` — shared upload utilities
- `.migration-backup/` — original Vercel project source (reference only)

## Architecture decisions

- Sessions stored in Postgres (`user_sessions` table) via connect-pg-simple — avoids session loss on machine restart
- Composite foreign keys (e.g. `class_memberships → classes(id, organization_id)`) enforce tenant isolation at the DB layer
- `bcrypt` uses native module — run `pnpm approve-builds` and select bcrypt if you see "Ignored build scripts: bcrypt" warnings
- Web app's `src/api-client/` folder handles all API calls directly (does NOT use `@workspace/api-client-react` at runtime)
- `STORAGE_DRIVER=fs` (default) for local dev; set `STORAGE_DRIVER=s3` with S3/R2 credentials for production uploads
- rclone remote is configured via `RCLONE_REMOTE_NAME` + `RCLONE_REMOTE_PATH` env vars only — actual rclone credentials live in rclone's own config file (`~/.config/rclone/rclone.conf`), never in app env vars or API responses
- rclone child processes inherit only HOME, PATH, and RCLONE_CONFIG from the parent environment — DATABASE_URL, SESSION_SECRET, and all other app secrets are never passed to rclone
- API is mounted at `/api` prefix (configurable via `API_MOUNT_PATH` env var)

## Product

- **Landing page** — marketing site at `/`
- **Login** — teacher/staff login, upload-code entry for students, student login (coming soon) at `/login`
- **Dashboard** — teacher project management, student upload review
- **Student upload portal** — students upload footage via short code, no account needed
- **AI editing** — automatic first-draft video assembly from student footage
- **Render jobs** — Shotstack provider integration for video rendering

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Do NOT re-run `pnpm --filter @workspace/api-spec run codegen` — it would overwrite the pre-generated Orval output in `lib/api-zod/src/generated/` and `lib/api-client-react/src/generated/` with stub-only output from the placeholder `openapi.yaml`
- `bcrypt` build scripts are ignored by default — run `pnpm approve-builds` to enable native bcrypt if needed
- DB schema push may fail with composite FK constraint errors — the tables were already created from the migration backup, so this is expected; the schema is already in place
- `vite.config.ts` has `fs.strict: false` to allow imports from workspace packages outside the artifact root

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
