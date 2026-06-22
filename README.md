# Offloadr

A media upload/management platform for podcast studios and schools. Students
record and upload footage; Offloadr organises it, prepares AI draft videos, and
gives teachers a final MP4 to review, download and share.

This repository is a **pnpm workspace monorepo**.

## Repository layout

```
artifacts/
  offloadr-app/   Vite + React web app (frontend)
  api-server/     Express 5 API server (backend)
lib/
  db/             Drizzle ORM schema + DB helpers
  api-zod/        Zod schemas generated from the OpenAPI spec
  api-client-react/  Generated React Query hooks
  client/         Shared API client helpers
  upload/         Shared upload utilities
scripts/          Workspace scripts (post-merge, etc.)
docs/             Setup & operational docs
```

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- **Frontend:** Vite 7 + React + Tailwind + Radix UI + TanStack Query + wouter
- **Backend:** Express 5 + pino logging + express-session (Postgres-backed)
- **Database:** PostgreSQL + Drizzle ORM
- **Validation:** Zod
- **File transfer:** rclone (system binary) for Google Drive uploads
- **Storage:** local filesystem (default) or S3 / Cloudflare R2

## Quick start

```bash
# 1. Install dependencies (pnpm required)
pnpm install

# 2. Configure environment
cp .env.example .env   # then fill in real values (see docs/SETUP.md)

# 3. Provision the database schema
pnpm --filter @workspace/db run push

# 4. Run the apps in dev
pnpm --filter @workspace/api-server run dev   # API server
pnpm --filter @workspace/offloadr-app run dev # Web app
```

Full rebuild-from-scratch instructions are in **[docs/SETUP.md](docs/SETUP.md)**.

## Environment variables

Every variable is documented in [`.env.example`](.env.example). The required
variables are `DATABASE_URL`, `SESSION_SECRET`, `PORT`, and `BASE_PATH` (the
server and web build fail to start without the latter two). See
[docs/SETUP.md](docs/SETUP.md) for the full table and which are secrets.

## Build

```bash
pnpm run typecheck   # typecheck all packages
pnpm run build       # typecheck + build all packages
```

- Web app build output: `artifacts/offloadr-app/dist/public/`
- API server build output: `artifacts/api-server/dist/index.mjs`

In production the API server can serve the built web app by setting
`STATIC_WEB_DIR` to the web app's `dist/public/` directory.

## Deployment

This app is designed to run as a **long-running Node service** (Replit
autoscale / any Node host / VM / container). It is **not** a serverless/Vercel
app as-is — see the "Deploying" section of [docs/SETUP.md](docs/SETUP.md) for
details and the blockers involved.

## License

MIT
