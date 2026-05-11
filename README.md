# Offloadr

Producer hand-off and project-management app. Producers upload tracks, files, stems, and notes for a project, then share a private hand-off page with the artist or team.

This repository is the **current source-of-truth mirror** of Offloadr. The app currently runs on Replit; this mirror exists so the project is portable and can be moved to other infrastructure when needed.

## Stack

- **Frontend**: React 18 + Vite + Tailwind + wouter + Tanstack Query (`artifacts/offloadr-app`)
- **API**: Express 5 + Drizzle ORM, session-based auth (`artifacts/offloadr-api`)
- **DB**: PostgreSQL via `lib/db` (Drizzle schema)
- **Object storage**: pluggable; currently Replit App Storage / GCS via `@google-cloud/storage`
- **Shared contract**: OpenAPI in `lib/api-spec`, generated Zod schemas in `lib/api-zod`, generated React Query hooks in `lib/api-client-react`
- **Build**: pnpm workspace, TypeScript 5.9

## Local development (off Replit)

This repo will install and typecheck out of the box. Running it requires the env vars listed below.

```bash
pnpm install
pnpm --filter @workspace/api-spec run codegen   # regenerate clients if the spec changed

# Frontend (build only — dev server currently requires PORT + BASE_PATH; see DEPLOYMENT.md)
pnpm --filter @workspace/offloadr-app run typecheck

# API
pnpm --filter @workspace/offloadr-api run typecheck
pnpm --filter @workspace/offloadr-api run build
pnpm --filter @workspace/offloadr-api run start
```

### Required environment variables

API (`artifacts/offloadr-api`):

- `DATABASE_URL` — Postgres connection string
- `SESSION_SECRET` — express-session secret
- `PORT` — port the API listens on (defaults to 5001 in dev)
- `API_MOUNT_PATH` — path prefix the API is mounted at (e.g. `/offloadr/api`)
- `PRIVATE_OBJECT_DIR` — `gs://<bucket>/<prefix>` for the GCS-backed object store (Replit App Storage today)

Frontend (`artifacts/offloadr-app`):

- `PORT` — required by the current Vite config (dev only)
- `BASE_PATH` — required by the current Vite config; the public path the SPA is served at (e.g. `/offloadr/`)
- `API_PORT` — port the dev server should proxy `/api` to (defaults to `5001`)

## Deployment

This repo is **not currently wired to any host**. See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for:

- exactly which parts of Offloadr are Replit-specific today
- what needs to change before Offloadr can leave Replit cleanly
- short-term and long-term hosting options (Replit, Railway/Render/Fly, Vercel, Neon/Supabase, R2/S3)

## Repository layout

```
artifacts/
  offloadr-app/        Vite + React frontend
  offloadr-api/        Express API
lib/
  db/                  Drizzle schema + client
  api-spec/            OpenAPI source of truth
  api-zod/             Generated Zod schemas (from openapi.yaml)
  api-client-react/    Generated React Query client (from openapi.yaml)
package.json           pnpm workspace root
pnpm-workspace.yaml    workspace + dependency catalog
DEPLOYMENT.md          hosting + Replit-dependency notes
```
