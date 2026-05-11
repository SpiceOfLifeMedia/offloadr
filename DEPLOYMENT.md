# Offloadr — Deployment Notes

This repository is a **current code mirror** of Offloadr as it runs on Replit. The app is a full-stack project: a Vite/React frontend (`artifacts/offloadr-app`) talking to an Express 5 API (`artifacts/offloadr-api`), backed by PostgreSQL (Drizzle ORM via `lib/db`) and an object store for media. It currently lives in the same pnpm monorepo so that the two services can share generated API types and the DB schema package.

The point of this document is to record exactly what about Offloadr is Replit-specific today, so the project can be moved to other infrastructure later without losing context.

## What's Replit-dependent today

These pieces are wired to Replit-managed infrastructure or Replit-specific build tooling. Each one needs an explicit decision before Offloadr can run cleanly off-platform.

### 1. Object storage — Replit App Storage (Google Cloud Storage)
- **Where**: `artifacts/offloadr-api/src/lib/objectStorage.ts`, `artifacts/offloadr-api/src/routes/files.ts`, `artifacts/offloadr-api/src/index.ts`.
- **Bound to**: the `PRIVATE_OBJECT_DIR` env var, which Replit App Storage sets to a `gs://<bucket>/<prefix>` path. The code uses `@google-cloud/storage` against that bucket using Replit-injected GCS credentials.
- **What this means off-Replit**: there is no `PRIVATE_OBJECT_DIR` and no GCS auth. Uploads and downloads will fail at startup (a guard already throws if the env var is missing).
- **Migration options**: AWS S3, Cloudflare R2, Supabase Storage, Backblaze B2, or self-hosted MinIO. The change is contained — replace the `objectStorage.ts` adapter and update the `files.ts` route to use the new client. Public/signed URLs and the upload + read paths are the only surface area.

### 2. Database — Replit-managed Postgres (Neon endpoint)
- **Where**: `lib/db/src/index.ts` reads `DATABASE_URL`. Schema in `lib/db/src/schema/`.
- **Bound to**: the Replit deployment's `DATABASE_URL` (a Neon Postgres endpoint provisioned and managed by Replit). The endpoint can be paused from the Replit Database tab — when paused, the API will fail its startup health check.
- **What this means off-Replit**: nothing in the schema or query code is Replit-specific. Any standard Postgres works (Neon directly, Supabase, Railway Postgres, RDS, Cloud SQL, Fly Postgres). Run `pnpm --filter @workspace/db run db:push` against the new `DATABASE_URL` and the schema is in place.
- **Note**: `pnpm run db:check` (root) opens a short-timeout `SELECT 1` against `DATABASE_URL` and fails the build with a structured error if the endpoint is down. That script is platform-agnostic and worth keeping in any CI/deploy pipeline.

### 3. Sessions — `express-session` with the default in-memory store
- **Where**: `artifacts/offloadr-api/src/index.ts`, `SESSION_SECRET` env var.
- **What this means off-Replit**: works fine on any single long-running Node process (Replit Deploy, Railway, Render, Fly.io). Will **not** work on a serverless platform (Vercel functions, Lambda, Cloudflare Workers) because each cold start gets a fresh memory store and there's no shared session state.
- **Migration if going serverless**: add a session store (`connect-pg-simple` against the existing Postgres is the lowest-friction option), or migrate auth to JWT/Clerk.

### 4. Build-time `PORT` + `BASE_PATH` requirement on the frontend
- **Where**: `artifacts/offloadr-app/vite.config.ts` throws if `PORT` or `BASE_PATH` is unset.
- **What this means off-Replit**: any host that doesn't inject these (Vercel, Netlify, plain `vite build` in CI) will fail the build until they're either provided or the requirement is relaxed. Easy fix at migration time: default `BASE_PATH` to `'/'` and drop the `PORT` requirement from build (it's only needed by the dev server).

### 5. Replit Vite plugins
- **Where**: `artifacts/offloadr-app/vite.config.ts` imports `@replit/vite-plugin-runtime-error-modal`, `@replit/vite-plugin-cartographer`, `@replit/vite-plugin-dev-banner`.
- **What this means off-Replit**: the runtime-error-modal is loaded unconditionally and will be a hard dependency. The other two are already gated on `REPL_ID !== undefined` so they no-op off-platform. To leave Replit cleanly, gate the runtime-error-modal the same way and the plugins become harmless.

### 6. `artifact.toml` files (Replit Publish service routing)
- **Where**: `artifacts/offloadr-app/.replit-artifact/artifact.toml`, `artifacts/offloadr-api/.replit-artifact/artifact.toml`.
- **What this means off-Replit**: ignored. They configure how Replit's reverse proxy routes paths (`/offloadr` to the web bundle, `/offloadr/api` to the Express server on local port 5001) and how Replit Publish runs the services. Other platforms have their own routing config and these files are inert.

### 7. Workspace dependencies
- **Where**: `artifacts/offloadr-api/package.json` depends on `@workspace/db` and `@workspace/api-zod` via `workspace:*`. `artifacts/offloadr-app` depends on generated client code in `lib/api-client-react`.
- **What this means off-Replit**: any host that supports `pnpm install` from a monorepo root (Railway, Render, Fly.io, Vercel with the right root setting, GitHub Actions) handles workspace deps natively. Hosts that try to deploy a single subdirectory in isolation will fail unless you either flatten the deps or build artifacts/tarballs first.

### Summary: what must change before Offloadr can leave Replit

Minimum viable departure (full-stack, single VM/container host):

1. Replace the object storage adapter (`objectStorage.ts`) with a non-Replit backend (S3/R2/Supabase) and update env var from `PRIVATE_OBJECT_DIR` to whatever the new backend expects.
2. Provide `DATABASE_URL` pointing at any managed Postgres.
3. Provide `SESSION_SECRET`.
4. Default `BASE_PATH` to `'/'` in the Vite config and drop the build-time `PORT` requirement.
5. Gate `@replit/vite-plugin-runtime-error-modal` on `REPL_ID` (or remove it).
6. Provide a process manager / start command for `artifacts/offloadr-api` (`pnpm --filter @workspace/offloadr-api run start`) and a static file host for the built frontend (`artifacts/offloadr-app/dist`).

That's it. There is no Replit-specific application logic — only infrastructure adapters and build config.

## Hosting options for after Replit

The right shape for Offloadr is a **persistent Node API + a static frontend + Postgres + an object store**. Pick one option per row.

### Frontend (`artifacts/offloadr-app`)
- **Vercel** — fits perfectly once `BASE_PATH`/`PORT` requirements are relaxed. Build: `pnpm install && pnpm --filter @workspace/offloadr-app run build`. Output: `artifacts/offloadr-app/dist`. Set `VITE_API_BASE_URL` (or equivalent) to the API origin.
- **Netlify** — same shape as Vercel.
- **Cloudflare Pages** — fine for static; Pages Functions could serve the API too but that's a serverless rewrite (see below).

### API (`artifacts/offloadr-api`)
- **Railway** — easiest path. Native pnpm monorepo support, persistent process, free Postgres add-on, env vars in the dashboard. **Recommended for short-term migration.**
- **Render** — same shape as Railway. Slightly slower cold starts on the free tier.
- **Fly.io** — most control, requires a `Dockerfile` and `fly.toml`. Best if you want global edge deployment of the API.
- **AWS App Runner / Google Cloud Run** — production-grade containerized hosting. Higher operational overhead, lowest per-request cost at scale.
- **Vercel functions** — possible but requires breaking the Express app into serverless handlers AND replacing `express-session` with a database-backed store or JWTs. Not a same-day migration.

### Database
- **Neon** (direct, not via Replit) — same engine as today, instant cutover; just point a new `DATABASE_URL` at a Neon project you own.
- **Supabase** — Postgres + storage + auth in one. If you also want to swap object storage and sessions, Supabase consolidates three concerns.
- **Railway Postgres** — co-locate with the API on Railway for simplest networking.
- **AWS RDS / Google Cloud SQL** — production scale, more ops work.

### Object storage
- **Cloudflare R2** — cheapest egress, S3-compatible API. **Recommended.**
- **AWS S3** — the reference standard.
- **Supabase Storage** — bundled if you use Supabase for the DB.
- **Backblaze B2** — cheap, S3-compatible.

### Short-term recommended stack (off Replit, full-stack, one weekend of work)
- Frontend: **Vercel**
- API: **Railway**
- DB: **Railway Postgres** (or **Neon** directly)
- Storage: **Cloudflare R2**

### Continue on Replit (zero migration today)
- Replit Deploy already runs the full stack with the existing config. The only operational discipline needed is keeping the Postgres endpoint enabled in the Database tab (the pre-publish health check at the repo root catches this before deploy).

## What's in this mirror

This GitHub repo contains the **current working Offloadr code as it runs on Replit today** plus the parts of the monorepo it needs to build:

- `artifacts/offloadr-app/` — the React/Vite frontend
- `artifacts/offloadr-api/` — the Express API
- `lib/db/` — Drizzle schema and DB client (workspace dep of the API)
- `lib/api-spec/` — OpenAPI source of truth
- `lib/api-zod/` — generated Zod schemas (workspace dep of the API)
- `lib/api-client-react/` — generated React Query client (used by the frontend)
- Root pnpm workspace + TypeScript config

It deliberately **does not** include the other monorepo artifacts (Gametime, SITECART, Bookies Beats, WLD, Offly, the shared API server, the mockup sandbox), the `attached_assets/` dump, screenshots, `node_modules`, or any deployment platform's CI config. Those are not part of Offloadr.

This mirror is **not yet wired to any external CI/CD**. Pushes to this repo do not deploy anywhere. To change that, pick a host from the section above and connect it to this repo.
