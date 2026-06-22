# Offloadr Architecture Notes

Internal architecture details for the Offloadr API + web stack. For deployment runbooks see `production-deploy.md`; for storage provisioning see `r2-provisioning.md`; for the pre-pilot safety floor see `pilot-safety.md`.

## Where it lives in the monorepo

- `artifacts/offloadr-api` — `@workspace/offloadr-api`, Express API. Imports tables directly from `@workspace/db`.
- `artifacts/offloadr-app` — React + Vite web bundle.
- Wired together via the `offloadr-app` `artifact.toml`, which declares the API as a second service (`api`) mounted at `/offloadr/api` on local port `5001`.

### Dev workflows
- `artifacts/offloadr-app: api` — `PORT=5001 API_MOUNT_PATH=/offloadr/api pnpm --filter @workspace/offloadr-api run dev`
- `artifacts/offloadr-app: web` — runs Vite only.

### Prod
The Docker image builds and runs both. The API serves the static web bundle from `STATIC_WEB_DIR` (set in the Docker stage) when present; unset in dev = no-op. Startup health check on `/offloadr/api/healthz`.

## Tenancy: `organization` internally, "School" in UI

The Offloadr tenant entity is `organization` everywhere internal:
- DB tables: `organizations`, `organization_memberships`, enum `organization_membership_role`
- Schema exports: `organizationsTable`, `organizationMembershipsTable`
- API paths: `/offloadr/api/organizations/*` (with `/schools/*` as a transitional alias)
- Session field: `req.session.organizationId`
- Helpers: `requireOrganization`, `getOrganizationId`, `loadMembership`

All user-facing copy in the React app still reads as "School". **Do NOT rename UI strings.**

### Role model (v1)
`[admin, producer, student]` plus an `is_owner` boolean flag on memberships.
- The old `owner` role was collapsed into `admin` + `is_owner`.
- The old `teacher` role became `producer`.

### Authorization
All authorization decisions go through `artifacts/offloadr-api/src/lib/permissions.ts`:
- `canManageOrganization`, `canManageProjects`, `canRunSessions`, `canViewProducerMode`, `canDeleteOrganization`, `canManageMembers`, `loadMembership`

**Never compare role strings inline in routes.**

### Local demo seed
`pnpm --filter @workspace/offloadr-api run seed:demo`
Seeds Demo School + `admin@`/`producer@`/`student@demo.test` (password `demo1234`) and two demo projects.

### Tenancy migration
`lib/db/migrations/2026-05-14_organization_tenancy_v1_roles.sql`, run by `pnpm --filter @workspace/scripts run run-offloadr-org-migration`.

## Storage driver — portable, no Replit Object Storage

Driver interface: `artifacts/offloadr-api/src/lib/storage/`. Two implementations:
- `fs` — local filesystem, default. Writes under `STORAGE_FS_ROOT` (default `artifacts/offloadr-api/.storage/`, gitignored). No config needed; dev and any plain Node host work out of the box.
- `s3` — S3-compatible (Cloudflare R2, AWS S3, MinIO).

Selected by `STORAGE_DRIVER` (default `fs`).

### s3 driver config
- `STORAGE_S3_ENDPOINT` — R2 endpoint URL (omit for AWS)
- `STORAGE_S3_REGION`
- `STORAGE_S3_BUCKET`
- `STORAGE_S3_ACCESS_KEY_ID`
- `STORAGE_S3_SECRET_ACCESS_KEY`
- `STORAGE_S3_FORCE_PATH_STYLE=true` for R2/MinIO

Replit Object Storage / `@google-cloud/storage` / `PRIVATE_OBJECT_DIR` / the Replit sidecar are no longer used and have been removed from the codebase.

## Production storage — Cloudflare R2

Production runs `STORAGE_DRIVER=s3` against a private Cloudflare R2 bucket using a scoped Object Read & Write token. Dev keeps the `fs` default.

The seven `STORAGE_*` env vars (driver selector + six S3 credentials) are set on the Fly app's secrets — never committed. Bucket name, jurisdiction, and endpoint host live with the deployment secrets.

- Provisioning runbook + token rotation: `r2-provisioning.md`
- End-to-end smoke test (upload → R2 dashboard → download → share → delete): in `production-deploy.md`
