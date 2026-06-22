# Offloadr Pre-School-Pilot Safety Floor

Status: completed (Task #232). This document captures the minimum security/operability work shipped before a real school touches the pilot. Update this file if any of the items below change.

## 1. Rate-limiting on auth endpoints
Implementation: `artifacts/offloadr-api/src/lib/rateLimit.ts` (via `express-rate-limit`).
- Login: 10 per 15min per IP+email
- Register: 5 per hour per IP
- Admin password-reset: 10 per hour per IP

Set `DISABLE_RATE_LIMIT=1` only for tests.

## 2. Admin-driven password recovery
- Endpoint: `POST /organizations/me/members/:userId/reset-password`
- Admin sets the new password directly and communicates it out-of-band.
- The org's `is_owner` admin cannot be reset by a peer admin.
- Admins cannot reset themselves through this endpoint.
- Companion: `GET /organizations/me/members` lists members of the caller's active org.
- Both `/organizations` and `/schools` prefixes are registered (`/schools/*` is a transitional alias).

## 3. Cross-tenant isolation check
Command: `pnpm --filter @workspace/offloadr-api run check:tenancy`
- 15 assertions across projects, files, recording sessions, share-disable, member listing, and admin password-reset.
- Plus an unauthenticated baseline.
- Must pass before every deploy that touches multi-tenant routes.

## 4. Structured health endpoint
`GET /offloadr/api/healthz` returns `{status, storage: {driver, ready}, db: {reachable, host}}` and a 503 when degraded so uptime probes can pinpoint the failing dependency.

## 5. Global error handler
`src/app.ts` logs `{err, route, userId, organizationId}` at error level. Pino redacts `Authorization`, `Cookie`, and `Set-Cookie` headers. Clients get a generic 500.

## 6. R2 versioning + lifecycle (MANUAL — enable in Cloudflare dashboard before pilot)
Documented in `artifacts/offloadr-api/docs/r2-provisioning.md` §7–§8:
- Object versioning ON
- 30-day non-current-version lifecycle
- Token rotation runbook

The dashboard click is **not automated**. Verify before the pilot starts.

## 7. Pilot-disclaimer banner
Dismissible amber banner: `PilotBanner.tsx` in `artifacts/offloadr-app`.
- `localStorage` key: `offloadr-pilot-banner-dismissed-v1`
- Sits above the main layout so every user sees "controlled pilot, not a compliance-certified production platform" on first load.

## Known gap
The main monorepo's only off-Replit copy is the manual snapshot to `SpiceOfLifeMedia/artifacts-monorepo`. Either keep that snapshot fresh or treat Replit as single source of truth.
