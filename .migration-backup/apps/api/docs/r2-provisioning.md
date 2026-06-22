# Cloudflare R2 provisioning for Offloadr production storage

This is the operational handoff for Offloadr's production file storage on
Cloudflare R2 (S3-compatible). The driver code lives at
`artifacts/offloadr-api/src/lib/storage/s3.ts` and is selected by the
`STORAGE_DRIVER` env var.

> **Status (2026-05-17, Task #233):** bucket `offloadr-production` is
> provisioned in the Spice Of Life Media Cloudflare account (account id
> `560994529c054a7b8e5b5161e408af69d`). A scoped Object Read & Write token
> named `offloadr-fly-pilot` is in active use by the Fly.io production
> deployment (`offloadr-pilot`). End-to-end upload → R2 → download has
> been verified live via the `/offloadr/api/healthz` endpoint, which
> reports `storage.ready: true`. **Action items still open before the
> school pilot starts:** enable object versioning + 30-day lifecycle (§ 7)
> and rotate the token that was used during the deploy walkthrough
> (follow-up task #237).

## 1. Provision the R2 bucket (Cloudflare dashboard, ~3 min)

> Already done for the current production bucket. These steps are kept for
> re-provisioning (e.g. spinning up a second environment, or recovering
> after an accidental delete).

1. Cloudflare dashboard → **R2 Object Storage** → **Create bucket**.
2. **Name:** `offloadr-production` (record the exact name you use).
3. **Location:** pick the jurisdiction closest to the primary user base.
   The current pilot bucket uses the **default jurisdiction** (no
   jurisdiction hint), which routes via Cloudflare's global network and
   pairs well with the Fly `syd` region for AU/NZ school pilots. Record
   whatever you choose.
4. Leave **Public access** disabled. All reads must go through the Offloadr
   API; no public bucket URL.
5. After creation, go to **R2** (account-level) → click the bucket → copy
   the **S3 API endpoint** shown on the bucket detail page. It looks like
   `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`. Record the host.

## 2. Mint a scoped API token (Cloudflare dashboard, ~2 min)

1. **R2** → **Manage R2 API Tokens** → **Create Account API token**
   (NOT the User API token — Account tokens survive user changes).
2. **Token name:** something traceable, e.g. `offloadr-fly-pilot` or
   `offloadr-fly-pilot-<YYYY-MM-DD>` if rotating.
3. **Permissions:** `Object Read & Write`.
4. **Specify bucket:** scope to **only** `offloadr-production`.
   Do **not** grant account-wide access.
5. **TTL:** leave as `Forever` for the pilot (set a renewal reminder if you
   rotate annually).
6. After creation Cloudflare shows the **Access Key ID** and **Secret
   Access Key** exactly once. Copy both into a password manager. They will
   go straight into the deployment's secret store in § 3 — do not paste
   them into chat, into the repo, or into `replit.md`.

## 3. Set the required env vars on the production deployment (Fly.io)

These all go on the Fly app `offloadr-pilot` via `flyctl secrets set` (not
dev). The names must match exactly — `artifacts/offloadr-api/src/lib/storage/s3.ts`
reads them verbatim and throws `NotConfiguredError` at boot if any required
value is missing.

| Env var                          | Required | Value for R2                                            | Purpose                                                                             |
| -------------------------------- | -------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `STORAGE_DRIVER`                 | yes      | `s3`                                                    | Selects the S3 driver instead of the default `fs`.                                  |
| `STORAGE_S3_ENDPOINT`            | yes (R2) | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`         | Account-level R2 endpoint from § 1.5. (Omit only when targeting real AWS S3.)       |
| `STORAGE_S3_REGION`              | yes      | `auto`                                                  | R2 ignores region; the AWS SDK just needs a non-empty string. `auto` is convention. |
| `STORAGE_S3_BUCKET`              | yes      | `offloadr-production`                                   | The bucket from § 1.2.                                                              |
| `STORAGE_S3_ACCESS_KEY_ID`       | yes      | Access Key ID from § 2.6                                | Credential for the scoped token.                                                    |
| `STORAGE_S3_SECRET_ACCESS_KEY`   | yes      | Secret Access Key from § 2.6                            | Credential for the scoped token.                                                    |
| `STORAGE_S3_FORCE_PATH_STYLE`    | yes (R2) | `true`                                                  | Required for R2 / MinIO. Set to `true` (or `1`).                                    |

**Where to set them:** `flyctl secrets set <KEY>=<value> ... -a offloadr-pilot`
(see `production-deploy.md` § 3 for the full command). They must be set on
**production** specifically, not on dev — dev keeps the `fs` default so
local development needs no R2 credentials.

## 4. Verify on boot

After `flyctl secrets set` (which auto-redeploys), tail the deployment logs:

```bash
flyctl logs -a offloadr-pilot
```

Look for the line emitted by `artifacts/offloadr-api/src/index.ts`:

```
Storage driver ready  driver: "s3"
```

- If you see `driver: "fs"`: the env vars are not reaching the production
  runtime. Check that they're set on `-a offloadr-pilot` and that the
  machine restarted after they were added (`flyctl status -a offloadr-pilot`).
- If you see a `NotConfiguredError` and the API fails to boot with a list of
  missing `STORAGE_S3_*` vars: one of the six required values is missing or
  empty. Fix the env var, redeploy.
- If boot succeeds but uploads fail with `403` / `SignatureDoesNotMatch`:
  the access key/secret pair is wrong, or `STORAGE_S3_FORCE_PATH_STYLE` is
  not `true`.
- If uploads fail with `NoSuchBucket`: the `STORAGE_S3_BUCKET` value doesn't
  match the actual bucket name, or the scoped token isn't scoped to that
  bucket.

## 5. End-to-end verification

Done as part of the production deploy smoke test — see
`production-deploy.md` § 4c.

Quick public check from any machine:

```bash
curl -s https://offloadr-pilot.fly.dev/offloadr/api/healthz | jq .storage
# Expect: { "driver": "s3", "ready": true }
```

## 6. Recording bucket details

Bucket name, account id, jurisdiction, and endpoint host are recorded in
`replit.md` under the Offloadr production storage paragraph. **Credentials
live only in the Fly secret store** (`flyctl secrets list -a offloadr-pilot`
shows names and digests but never values).

## 7. Enable object versioning (recoverable deletes — REQUIRED before school pilot starts)

> **Status (2026-05-17):** NOT YET enabled on `offloadr-production`. This
> is a one-time Cloudflare dashboard click that must happen before the
> first real school session. Tracked as follow-up task #238.

R2 buckets do not version objects by default. For the pilot, enable
versioning so an accidental delete or overwrite is recoverable for at
least a short retention window. This is one click in the Cloudflare
dashboard and incurs no extra cost beyond the storage of prior versions.

1. Cloudflare dashboard → **R2** → `offloadr-production` → **Settings**.
2. **Object versioning** → **Enable**.
3. **Lifecycle rules** → add a rule that **expires non-current versions
   after 30 days** so storage doesn't grow unbounded. (Pilot value: 30
   days. Tighten or extend later as the data-retention story matures.)
4. Confirm the bucket's status now shows "Versioning: Enabled" and the
   lifecycle rule is listed.

After enabling, record the confirmation date and the chosen retention
window in `replit.md` under the Offloadr storage paragraph so a future
operator can see at a glance that this safety net exists.

**Verification (~2 min):** in the dashboard, upload a small test object,
overwrite it with the same key, then delete it. The Objects view toggle for
"Show versions" should reveal both prior versions for the configured
retention window.

## 8. Token rotation runbook

The scoped Object Read & Write token issued in § 2 has no expiry. To
rotate it without downtime:

1. Mint a new token (same permissions, same bucket scope).
2. Update both credentials on the Fly app:
   ```bash
   flyctl secrets set \
     "STORAGE_S3_ACCESS_KEY_ID=<new-key>" \
     "STORAGE_S3_SECRET_ACCESS_KEY=<new-secret>" \
     -a offloadr-pilot
   ```
   (Auto-triggers a rolling redeploy.)
3. Verify a fresh upload reaches R2 and the boot log still shows
   `Storage driver ready  driver: "s3"`. Curl healthz:
   `curl https://offloadr-pilot.fly.dev/offloadr/api/healthz` should
   return `storage.ready: true`.
4. Revoke the old token in the Cloudflare dashboard.

If a token is suspected leaked, revoke first then issue a replacement —
better to take the API down for 60 seconds than to leave a leaked token
active. (Follow-up #237 covers the post-pilot-deploy rotation of the
current token because its access key id was pasted into the deploy chat.)
