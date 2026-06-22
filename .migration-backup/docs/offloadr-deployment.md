# Offloadr — Production Deployment Guide

**Architecture:** Vercel (frontend SPA) + Railway (Express API)  
**Public URL:** `https://www.useoffloadr.com`  
**Student login:** `https://www.useoffloadr.com/student-login/demo-school`  
**API:** `https://api.useoffloadr.com`

---

## Architecture Overview

```
Browser
  └── www.useoffloadr.com  (Vercel — React SPA, served from CDN)
        └── /api/*  →  api.useoffloadr.com  (Railway — Express API, proxied by Vercel)
                              ├── Neon PostgreSQL  (DATABASE_URL)
                              ├── Cloudflare R2   (student file uploads)
                              └── Resend          (email notifications)
```

**Why this split:**
- Vercel cannot host the Express upload API — serverless functions have a 4.5 MB request body
  limit (Hobby) and 60 s execution timeout (Pro), both incompatible with student video uploads.
- Railway runs Node.js natively with no upload size limit and always-on processes.
- From the student's browser, everything appears under a single `www.useoffloadr.com` domain —
  Vercel's edge proxy forwards `/api/*` to Railway transparently. Cookies work because the
  browser never sees the Railway hostname.

---

## DNS Records Required

Add these to your DNS provider (wherever `useoffloadr.com` is registered — typically
Cloudflare, Namecheap, GoDaddy, etc.).

| # | Type  | Name  | Value                                       | Notes |
|---|-------|-------|---------------------------------------------|-------|
| 1 | CNAME | `www` | `cname.vercel-dns.com`                      | Frontend — Vercel will verify + issue TLS |
| 2 | CNAME | `api` | `[your-service].railway.app`                | API — Railway gives you this value after deploy |

**For the root domain (`useoffloadr.com` with no www):**

If you want `useoffloadr.com` (no www) to also work, add one of:

| Type | Name | Value | Notes |
|------|------|-------|-------|
| CNAME | `@` (root) | `cname.vercel-dns.com` | Only works if your DNS provider supports CNAME flattening (Cloudflare does; most others don't) |
| A | `@` (root) | `76.76.21.21` | Vercel's static IP for root domains — use this if CNAME flattening isn't supported |

> Vercel will redirect `useoffloadr.com` → `www.useoffloadr.com` automatically once both
> are added in the Vercel dashboard.

**TLS:** Both Vercel and Railway auto-provision Let's Encrypt certificates once the CNAME is
verified. No manual SSL setup required.

---

## Step 1 — Deploy the API to Railway

### Connect the repo
1. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
2. Select `SpiceOfLifeMedia/artifacts-monorepo`
3. **Root Directory:** `/` (monorepo root — Railway reads `railway.json` from there)
4. Railway will detect `railway.json` and use the build + start commands from it

### Environment variables (Railway → Variables tab)

Set every variable below before the first deploy. The API will not start correctly without them.

| Variable | Value | Notes |
|---|---|---|
| `NODE_ENV` | `production` | Enables secure cookies and strict session handling |
| `PORT` | *(leave blank — Railway sets this automatically)* | Do not override |
| `API_MOUNT_PATH` | `/api` | Must match Vercel rewrite prefix |
| `DATABASE_URL` | `postgresql://...@...neon.tech/...?sslmode=require` | Neon production connection string |
| `SESSION_SECRET` | *(random 64-char string)* | **Required.** Generate: `openssl rand -hex 32` |
| `STORAGE_DRIVER` | `s3` | Use Cloudflare R2 |
| `STORAGE_S3_REGION` | `auto` | R2 always uses `auto` |
| `STORAGE_S3_ENDPOINT` | *(your R2 endpoint URL)* | From Cloudflare R2 → API Tokens |
| `STORAGE_S3_BUCKET` | `offloadr-production` | Your R2 bucket name |
| `STORAGE_S3_ACCESS_KEY_ID` | *(from Cloudflare R2 → API Tokens)* | |
| `STORAGE_S3_SECRET_ACCESS_KEY` | *(from Cloudflare R2 → API Tokens)* | |
| `RESEND_API_KEY` | `re_...` | From Resend dashboard |
| `UPLOAD_NOTIFICATION_EMAIL` | `info@edumediasystems.com.au` | Who receives upload alert emails |
| `STUDENT_ACCOUNTS_ENABLED` | `true` | Enables student login routes |
| `OFFLOADR_ENV` | `pilot` | Labels emails as "PILOT" (not "DEV") |
| `CORS_ORIGIN` | `https://www.useoffloadr.com` | Restricts API to your frontend domain |

**Optional:**

| Variable | Default | Notes |
|---|---|---|
| `UPLOAD_NOTIFICATION_FROM` | `notifications@edumediasystems.com.au` | Sender (must be verified in Resend) |
| `STORAGE_FS_ROOT` | `/tmp/offloadr` | Only used when `STORAGE_DRIVER=fs` — not for production |

### Add custom domain in Railway
1. Railway → your service → **Settings** → **Networking** → **Custom Domain**
2. Add `api.useoffloadr.com`
3. Railway shows you a CNAME value — copy it (looks like `[service].railway.app`)
4. Add that as the `api` CNAME in your DNS (record #2 in the table above)

### Verify the API
Once DNS propagates (usually 2–10 min with Cloudflare, up to 48h with other providers):
```
curl https://api.useoffloadr.com/api/health
```
Expected:
```json
{"status":"ok","schemaOk":true,"storage":{"ready":true}}
```

---

## Step 2 — Deploy the Frontend to Vercel

### Connect the repo
1. Go to [vercel.com](https://vercel.com) → **New Project** → **Import Git Repository**
2. Select `SpiceOfLifeMedia/artifacts-monorepo`
3. **Framework Preset:** Other
4. **Root Directory:** `/` (monorepo root — Vercel reads `vercel.json` from there)
5. Vercel auto-detects `buildCommand` and `outputDirectory` from `vercel.json` — no manual config

### Environment variables (Vercel → Settings → Environment Variables)

| Variable | Value | Notes |
|---|---|---|
| `BASE_PATH` | `/` | Vite base path — must be `/` for production root deployment |

That's it. No API keys in the frontend — all secrets live in Railway.

### Add custom domains in Vercel
1. Vercel → your project → **Settings** → **Domains**
2. Add `www.useoffloadr.com`
3. Add `useoffloadr.com` (Vercel will auto-redirect this to www)
4. For each domain, Vercel shows the CNAME value to add — use `cname.vercel-dns.com` for www,
   and either CNAME flattening or the Vercel A record `76.76.21.21` for the root

### Verify the frontend
```
open https://www.useoffloadr.com
open https://www.useoffloadr.com/student-login/demo-school
```

---

## Step 3 — Verify End-to-End

```bash
# 1. API health
curl https://api.useoffloadr.com/api/health

# 2. Frontend loads
open https://www.useoffloadr.com

# 3. Student login (browser)
open https://www.useoffloadr.com/student-login/demo-school
# Login: alice.s1 / student123

# 4. Upload test (login as alice.s1, use the student upload portal)
```

Student accounts for testing:

| Username | Name | Password |
|---|---|---|
| `alice.s1` | Alice Smith | `student123` |
| `ben.j2` | Ben Jones | `student123` |
| `cara.t3` | Cara Thompson | `student123` |
| `dan.w4` | Dan Wilson | `student123` |
| `eva.m5` | Eva Martinez | `student123` |
| `finn.b6` | Finn Brown | `student123` |
| `grace.c7` | Grace Chen | `student123` |
| `harry.d8` | Harry Davis | `student123` |
| `isla.f9` | Isla Fisher | `student123` |
| `jack.g10` | Jack Green | `student123` |

Staff accounts:

| Email | Role | Password |
|---|---|---|
| `admin@demo.test` | Admin | `demo1234` |
| `producer@demo.test` | Producer | `demo1234` |

---

## Redeploys (ongoing)

Vercel and Railway both watch the GitHub `main` branch. Every push to `main` triggers an
automatic redeploy of both services. No manual action needed.

GitHub → auto-deploy pipeline:
```
git push → GitHub main → Vercel rebuilds frontend → Railway rebuilds API
```

---

## Database Migrations

Migrations are NOT applied automatically on deploy. Run them manually before any release
that changes the schema:

```bash
# From Replit workspace (development):
node scripts/apply-migration.mjs
```

The API performs a schema drift check at boot — `GET /api/health` returns `schemaOk: false`
if columns are missing. Always check this after a deploy that includes schema changes.

---

## Secrets — Where They Live

| Secret | Replit (dev) | Railway (prod) |
|---|---|---|
| `DATABASE_URL` | Replit Secrets | Railway Variables |
| `SESSION_SECRET` | Not needed in dev | Railway Variables |
| `STORAGE_S3_ACCESS_KEY_ID` | Replit Secrets | Railway Variables |
| `STORAGE_S3_SECRET_ACCESS_KEY` | Replit Secrets | Railway Variables |
| `RESEND_API_KEY` | Replit Secrets | Railway Variables |

Vercel has **no secrets** — the frontend SPA contains no API keys.

---

## Alternative: Single-Service Deployment (Railway only, no Vercel)

If you want to skip Vercel entirely and serve everything from Railway (simpler, slightly
less CDN performance):

Add to Railway environment variables:
```
STATIC_WEB_DIR=/app/.migration-backup/artifacts/offloadr-app/dist
WEB_BASE_PATH=/
```

Update Railway build command to also build the frontend:
```
pnpm install --frozen-lockfile && \
  pnpm --filter @workspace/offloadr-app run build && \
  pnpm --filter @workspace/offloadr-api run build
```

Then point `www.useoffloadr.com` CNAME directly to Railway (no Vercel needed).
This is a viable option for the pilot phase.
