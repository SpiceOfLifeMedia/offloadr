# Offloadr production deploy runbook (Fly.io)

This is the operational runbook for deploying the Offloadr web + API to
production. The architecture (decided in task #230, runtime chosen in task
#233) is:

> **One Fly.io app, the entire `artifacts/offloadr-app` artifact, web and
> API together at the same origin.** The API mounts at `/offloadr/api/*`,
> the web bundle is served from `/offloadr/`. No CORS, no cross-origin
> cookies, one secrets panel.

**Production URL:** https://offloadr-pilot.fly.dev/offloadr/
**Fly app:** `offloadr-pilot` (region `syd`, shared-cpu-1x, 1024 MB RAM)
**Source of truth:** Replit workspace (this repo) + GitHub backup mirror
`SpiceOfLifeMedia/artifacts-monorepo`. Fly builds remotely from the local
working tree via `flyctl deploy`.

The Vercel mirror at `offloadr-one.vercel.app` is paused and is **not** the
production URL. Replit Deploy was evaluated and ruled out for Offloadr (no
add-app flow for a second deployment in this workspace).

## 1. Pre-deploy checklist

Before running `flyctl deploy`, confirm:

- [ ] Cloudflare R2 bucket `offloadr-production` exists and the scoped
      Object Read & Write token has been generated. (Runbook:
      `r2-provisioning.md`.)
- [ ] You can paste the seven `STORAGE_*` values from a password manager —
      they are not stored anywhere in the repo.
- [ ] You have a `SESSION_SECRET` of at least 32 random characters. Generate
      one with: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
      The API hard-fails at boot in production if this is missing or too
      short (see `artifacts/offloadr-api/src/app.ts`).
- [ ] Neon `DATABASE_URL` is reachable. The pilot uses Neon Sydney
      (`ep-fragrant-hill-a7cd7fu0.ap-southeast-2.aws.neon.tech`); pooled
      connection string, `?sslmode=require` preserved.
- [ ] Local dev still boots clean: `restart_workflow artifacts/offloadr-app: api`
      and check the logs for `Storage driver ready` and `Database reachable`.
- [ ] You are authenticated to flyctl on the machine you're deploying from:
      `flyctl auth whoami` should print the deploy email.

## 2. Required deployment secrets

Set every one of these via `flyctl secrets set ... -a offloadr-pilot`
(see § 3 for the exact command). Names are case-sensitive and must match
exactly. `flyctl secrets set` triggers a rolling redeploy automatically.

| Secret                          | Purpose                                                                 | Required in prod |
| ------------------------------- | ----------------------------------------------------------------------- | ---------------- |
| `DATABASE_URL`                  | Neon Postgres connection string. Read by `@workspace/db` and boot ping. | yes              |
| `SESSION_SECRET`                | ≥32-char random string for express-session cookie signing.              | yes (hard-fail)  |
| `STORAGE_DRIVER`                | `s3` to use Cloudflare R2 instead of the ephemeral local FS.            | yes              |
| `STORAGE_S3_ENDPOINT`           | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`                         | yes (R2)         |
| `STORAGE_S3_REGION`             | `auto`                                                                  | yes              |
| `STORAGE_S3_BUCKET`             | `offloadr-production`                                                   | yes              |
| `STORAGE_S3_ACCESS_KEY_ID`      | R2 scoped token access key id.                                          | yes              |
| `STORAGE_S3_SECRET_ACCESS_KEY`  | R2 scoped token secret.                                                 | yes              |
| `STORAGE_S3_FORCE_PATH_STYLE`   | `true` (required for R2 / MinIO).                                       | yes              |
| `GOOGLE_SERVICE_ACCOUNT_KEY`    | Google Drive import. Set only if you actually use Drive imports.        | optional         |
| `SHOTSTACK_API_KEY`             | Shotstack render API key. Without it, Smart Draft surfaces "Provider not configured yet". | optional |
| `SHOTSTACK_ENV`                 | `stage` (default) or `v1` (production billing).                         | optional         |
| `STUDENT_ACCOUNTS_ENABLED`      | Stage 2.1.1 dormancy gate. `true` exposes `/offloadr/api/student/auth/*`; anything else (incl. unset) makes every path under it return a bare `404 Not Found` with no auth/rate-limit signal. **Default: keep unset until Stage 3 ships.** | optional (default: off) |

`PORT` is set by Fly automatically (machine binds to `8080` per `fly.toml`).
`API_MOUNT_PATH=/offloadr/api` and `NODE_ENV=production` are baked into the
Dockerfile / fly.toml `[env]` block; do not duplicate them as secrets.

## 3. Deploy

### First deploy (or after a Dockerfile / fly.toml change)

From the repo root (this workspace, or a fresh `git clone` on a Mac with
flyctl installed):

```bash
flyctl deploy -a offloadr-pilot --remote-only
```

`--remote-only` runs the Docker build on Fly's builders so you don't need
Docker locally. Build takes ~3-5 min the first time, ~1-2 min on subsequent
deploys because `pnpm install` cache is reused.

### Updating only secrets (no code change)

```bash
flyctl secrets set \
  "DATABASE_URL=postgresql://..." \
  "SESSION_SECRET=..." \
  "STORAGE_DRIVER=s3" \
  "STORAGE_S3_REGION=auto" \
  "STORAGE_S3_FORCE_PATH_STYLE=true" \
  "STORAGE_S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com" \
  "STORAGE_S3_BUCKET=offloadr-production" \
  "STORAGE_S3_ACCESS_KEY_ID=..." \
  "STORAGE_S3_SECRET_ACCESS_KEY=..." \
  -a offloadr-pilot
```

This redeploys the currently-built image with the new secrets — no rebuild.
Use this for credential rotation. ~30 sec end-to-end.

### Scaling memory (one-time, already done for the pilot)

```bash
flyctl scale memory 1024 -a offloadr-pilot
```

The Fly machine defaulted to 256 MB on first create and OOM'd at boot. The
machine is now pinned to 1024 MB. `fly.toml`'s `memory = "1gb"` declaration
is honored on fresh deploys; existing machines need this explicit `scale`.

### Build pipeline (what runs inside the Docker build)

The `Dockerfile` at repo root performs:

1. `pnpm install --frozen-lockfile`
2. `pnpm --filter @workspace/offloadr-api run build` → `dist/index.mjs`
3. `pnpm --filter @workspace/offloadr-app run build` → static bundle in
   `artifacts/offloadr-app/dist`
4. Copies the static bundle into the runtime image at the path declared by
   `STATIC_WEB_DIR`; `artifacts/offloadr-api/src/app.ts` mounts it at
   `/offloadr/*` and serves the SPA index for unmatched HTML routes.
5. Runtime command: `node --enable-source-maps artifacts/offloadr-api/dist/index.mjs`
6. Fly health check: `GET /offloadr/api/healthz` with 60s grace period.

The deploy will fail fast if any required secret is missing — that's
intentional and matches the "fail loud, never silently" expectation in
task #230 step 3.

## 4. Post-deploy verification (smoke test)

Replace `<APP>` with `offloadr-pilot.fly.dev` (or the custom domain once
attached).

### 4a. Boot logs

```bash
flyctl logs -a offloadr-pilot
```

Confirm all three lines appear within ~10s of boot:

```
Storage driver ready  driver: "s3"
Database reachable    host: "<your-db-host>"
Server listening      port: 8080
```

If you see `driver: "fs"`: secrets aren't reaching the prod runtime. Stop
and fix before going further.

### 4b. Public health check

```bash
curl -i https://<APP>/offloadr/api/healthz
# Expect: HTTP/1.1 200 OK
# Body: {"status":"ok","storage":{"driver":"s3","ready":true},"db":{"reachable":true,"host":"..."}}
```

If `status` is anything other than `ok`, the JSON body names exactly which
dependency is degraded (storage vs db). The endpoint returns `503` when
degraded so uptime probes can alert correctly.

### 4c. End-to-end user flow

1. Open `https://<APP>/offloadr/` in a clean browser.
2. Register a new user, create a school (organization), create a project.
3. Upload one small file (~1 MB).
4. In the Cloudflare R2 dashboard → bucket `offloadr-production` →
   Objects, confirm a new object appears immediately.
5. Download the file back through the Offloadr UI; verify byte size and
   contents match.
6. Create a share link; open it in an incognito window (no auth); confirm
   the download works for the share-link recipient.
7. Delete the file through the UI; confirm the object disappears from R2.

If any of those seven steps fail, the deploy is not done. Common failure
modes:

- **502 / connection refused** on `/offloadr/api/*` — API process crashed at
  boot. Run `flyctl logs -a offloadr-pilot` and check for missing secrets,
  OOM, or DB unreachable.
- **OOM kill loop** — `flyctl scale memory 1024 -a offloadr-pilot` was
  skipped. Re-run it; machine restarts automatically.
- **Login works but immediately logs out on the next request** — `trust proxy`
  not set, or `cookie.secure` mismatch with the browser. Both are handled
  in `app.ts`; if it still happens, the deploy isn't running the latest
  code (force a fresh deploy with `flyctl deploy --no-cache`).
- **Upload returns 200 but no object in R2** — wrong `STORAGE_S3_BUCKET`
  value or the scoped token isn't actually scoped to that bucket.
- **Share link 404 in incognito** — share link route requires no auth; if it
  fails, the issue is the file lookup, not auth. Check API logs.
- **First request after weekend takes 3+ sec** — Neon free tier scaled the
  DB to zero after 5 min idle. Expected for the pilot; tracked in follow-up
  #239 (keepalive ping or upgrade Neon plan).

## 4d. Database migrations (manual, runs against prod Neon)

Migrations live in `lib/db/migrations/` and are **not** applied
automatically on Fly deploy. After merging a PR that adds a new SQL file,
apply it against the production Neon DB before (or immediately after) the
Fly rollout — otherwise routes that query new columns will 500 with
`column "<x>" does not exist`. (This bit us on 2026-05-20: the
`2026-05-19_student_upload_codes.sql` migration sat un-applied for a day,
which broke every teacher upload and every `GET /projects/:id/files`.)

**Idempotency is per-file, not repo-wide.** Newer migrations
(`2026-05-19_student_upload_codes.sql`,
`2026-05-14_organization_tenancy_v1_roles.sql`) are authored
defensively (`IF NOT EXISTS`, `DO $$ ... duplicate_object ...`) and
safe to re-run. Legacy ones (`2026-05-19_helper_devices.sql`,
`2026-05-19_helper_devices_fixups.sql`) use plain `CREATE TYPE / CREATE
TABLE / ALTER TABLE` and will error on re-run. Check the SQL before
re-applying anything that's already in the "already-applied" list
below — when in doubt, query `information_schema` first.

```bash
# 1. Pull the live DATABASE_URL off the Fly machine. Don't paste it
#    anywhere; the subshell scopes it to this invocation only.
PROD_DB=$(flyctl ssh console -a offloadr-pilot -C 'printenv DATABASE_URL' \
  | tr -d '\r' | grep -E '^postgres')

# 2. List available migrations.
pnpm --filter @workspace/scripts run apply-migration --list

# 3. Apply one.
DATABASE_URL="$PROD_DB" pnpm --filter @workspace/scripts run \
  apply-migration 2026-05-19_student_upload_codes.sql
```

Already-applied (production Neon, as of 2026-05-20):
- `2026-05-14_organization_tenancy_v1_roles.sql`
- `2026-05-19_helper_devices.sql`
- `2026-05-19_helper_devices_fixups.sql`
- `2026-05-19_student_upload_codes.sql`

Follow-up task #229 ("Catch DB problems automatically every few minutes")
will replace this manual flow with a scheduled drift check; until then,
apply by hand.

## 4e. Upload-notification email (Resend)

When a file finishes uploading (teacher *or* student path) the API
sends a best-effort notification email via Resend to
`info@edumediasystems.com.au`. The send is fire-and-forget — if Resend
is unreachable or the API key is missing, the upload still returns 201
and only the notifier log line is affected.

**Required Fly secrets** (set on `offloadr-pilot`):
- `RESEND_API_KEY` — from https://resend.com/api-keys
- `UPLOAD_NOTIFICATION_EMAIL` — recipient, default
  `info@edumediasystems.com.au`
- `UPLOAD_NOTIFICATION_FROM` — sender. **Must be on a Resend-verified
  domain.** Default: `Offloadr <notifications@edumediasystems.com.au>`
- `APP_BASE_URL` — base URL for the "Open Project" link. Default:
  `https://offloadr-pilot.fly.dev/offloadr`

**Resend DNS setup for `edumediasystems.com.au`** (one-time, required
before the verified-domain sender will work):

1. In Resend → **Domains** → **Add Domain** → enter
   `edumediasystems.com.au`. Resend will show 3–4 DNS records:
   - **SPF (TXT)** on `@` (or `send.edumediasystems.com.au` if you
     chose a subdomain). Value looks like
     `v=spf1 include:amazonses.com ~all`.
   - **DKIM (TXT)** on a hostname like
     `resend._domainkey.edumediasystems.com.au`. Value is a long
     `p=...` public key Resend gives you.
   - **MX** on `send` (subdomain) — `feedback-smtp.<region>.amazonses.com`
     priority 10. (Only if you opted into the subdomain pattern. Skip
     if you picked apex.)
   - **DMARC (TXT)** on `_dmarc` — Resend will suggest
     `v=DMARC1; p=none;`. Optional but recommended.
2. Add each record exactly as shown in your DNS provider (Cloudflare,
   Route 53, etc.). TTL 3600 is fine.
3. Back in Resend, click **Verify DNS records**. SPF + DKIM usually
   propagate within minutes; DMARC can take longer but is non-blocking.
4. Once Resend shows the domain as **Verified**, the sender
   `notifications@edumediasystems.com.au` is live.

**Until DNS is verified**, set the sender to Resend's sandbox address
so the notifier still works end-to-end:

```bash
flyctl secrets set UPLOAD_NOTIFICATION_FROM='onboarding@resend.dev' \
  -a offloadr-pilot
```

**Quick smoke test from a Fly machine shell:**

```bash
flyctl ssh console -a offloadr-pilot
node -e "
const {Resend} = require('resend');
const r = new Resend(process.env.RESEND_API_KEY);
r.emails.send({
  from: process.env.UPLOAD_NOTIFICATION_FROM,
  to: process.env.UPLOAD_NOTIFICATION_EMAIL,
  subject: 'Offloadr Resend smoke test',
  text: 'If you got this, Resend + DNS are wired correctly.',
}).then(r => console.log(JSON.stringify(r)));
"
```

## 5. Redeploy

To redeploy after a code change: `flyctl deploy -a offloadr-pilot --remote-only`
from the repo root. Fly rebuilds the Docker image, pushes it to its
registry, performs the health check, and rolls the machine. Secrets persist
across redeploys; you only need to re-set them if they actually rotate.

## 6. Old runtime status — nothing to decommission

Offloadr was never live on Replit Deploy or any other production runtime
prior to this Fly cutover. There is no old origin to redirect, no DNS to
swap, no users to migrate. The Vercel project `offloadr-one.vercel.app`
remained 404'ing on every API call throughout (frontend-only mirror, no
backend) and is documented as "paused, not the pilot URL" in `replit.md` —
no further action needed before the pilot starts.

The `SpiceOfLifeMedia/offloadr` GitHub repo can stay as-is — it's preserved
in case the project later splits into Vercel-frontend + Fly-API. Just don't
auto-push to it during the pilot.

## 7. Rolling back

If a deploy goes bad:

```bash
# List recent releases
flyctl releases -a offloadr-pilot

# Roll back to the previous release
flyctl releases rollback <version> -a offloadr-pilot
```

Or, for a faster fix when you know the prior image was healthy:

```bash
flyctl deploy --image registry.fly.io/offloadr-pilot:deployment-<id> -a offloadr-pilot
```

The image id is shown in the output of every `flyctl deploy`.
