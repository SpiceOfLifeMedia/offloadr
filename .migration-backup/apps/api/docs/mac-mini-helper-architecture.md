# Offloadr Mac Mini Helper — Architecture Foundation

Status: **proposal**, V1 scope only. Author: agent, on request.
Audience: you, future contributors, and the producer pilot.

> **Critical-thinking note.** Parts of the brief are vague in ways
> that bite later. Before architecture: three things in the brief are
> doing too much work and need to be tightened up.
>
> 1. **"Verify uploads"** is not a feature, it's a contract. We need a
>    precise definition (byte-for-byte hash equality, server-side, with
>    the Helper retaining the source file until the server has
>    persisted and confirmed the digest). This doc defines it.
> 2. **"Real time" Producer Mode** is dangerous shorthand. Real systems
>    have latency. We commit to a numeric target (p95 < 2s for
>    telemetry, p95 < 5s for upload progress) and design for that, not
>    "instant".
> 3. **"Plugin architecture for RØDE/ATEM/OBS"** is a V3 problem at
>    best. V1 ships a single adapter (watched-folder) behind an
>    interface boundary. We will NOT build a plugin loader, hot-swap,
>    or signed plugin manifests on day one. That is a money pit until
>    we have a real second adapter to validate the interface against.
>
> With that pre-empted: the architecture below.

---

## 1. Recommended Helper Architecture

A single long-running **local daemon** on the Mac Mini, supervised by
`launchd`, that does five things and nothing else:

```
┌──────────────────────── Mac Mini ─────────────────────────┐
│                                                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                Offloadr Helper Daemon               │   │
│  │                                                     │   │
│  │  ┌─────────────┐   ┌──────────────┐   ┌──────────┐ │   │
│  │  │  Source     │   │  Ingest      │   │ Telemetry│ │   │
│  │  │  Adapters   │──▶│  Pipeline    │──▶│ Bus      │ │   │
│  │  │ (folder V1) │   │ (stability,  │   │          │ │   │
│  │  └─────────────┘   │  hash, queue)│   └────┬─────┘ │   │
│  │                    └──────┬───────┘        │       │   │
│  │                           ▼                ▼       │   │
│  │                    ┌──────────────┐  ┌───────────┐ │   │
│  │                    │  Uploader    │  │ Reporter  │ │   │
│  │                    │  (resumable, │  │ (batched, │ │   │
│  │                    │   retrying)  │  │  retried) │ │   │
│  │                    └──────┬───────┘  └─────┬─────┘ │   │
│  │                           │                │       │   │
│  │  ┌────────────────────────┴────────────────┴────┐  │   │
│  │  │   Local SQLite state (jobs, events, config)  │  │   │
│  │  └────────────────────────┬─────────────────────┘  │   │
│  │                           │                        │   │
│  │  ┌────────────────────────┴─────────────────────┐  │   │
│  │  │   Device identity (keychain-stored API key)  │  │   │
│  │  └──────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────────────────────┬─────────────────────────────────┘
                           │ HTTPS (mTLS optional later)
                           ▼
              ┌────────────────────────┐
              │  Offloadr API (Fly)    │
              │  /helper/* endpoints   │
              └────────────────────────┘
```

**Single process, single SQLite file, single keychain entry.** No
microservices, no message broker, no Docker. The user is a producer,
not a sysadmin.

Modules inside the daemon:

| Module | Responsibility | Has state? |
|---|---|---|
| Source Adapters | Watch one or more file sources and emit `FileCandidate` events | No (stateless wrt jobs) |
| Ingest Pipeline | Stability detection, hashing, dedupe, enqueue | Reads/writes `jobs` |
| Uploader | Drive uploads through to "verified" terminal state with retries | Reads/writes `jobs` |
| Telemetry Bus | In-process pub/sub of `HelperEvent`s | None (ephemeral) |
| Reporter | Drain telemetry to API, batched, with backoff | Reads/writes `events` outbox |
| Device Identity | Hold and rotate the device API key | Reads keychain |
| Supervisor | Healthcheck, restart adapters, surface fatal config errors | None |

---

## 2. Recommended Language / Framework

**Recommendation: Go 1.22+.** Single static binary, no runtime to
install, `launchd` integration is trivial, native FSEvents via
`fsnotify`, excellent HTTP/2 client, mature SQLite bindings
(`modernc.org/sqlite` for pure-Go, no CGO), and crypto/x509 in stdlib.

> **Why I'm pushing back on the obvious choice.** Node/TypeScript is
> what the rest of the monorepo uses, and "consistency" is tempting.
> Don't. The Helper is a long-running native daemon that ships to
> machines you don't fully control. Node's failure modes there
> (`node_modules` drift, native module compile errors on macOS arm64
> vs x86_64, npm registry availability during install, event loop
> stalls on a 30 GB hash) are exactly the things that will eat
> producer trust. A 12 MB Go binary that runs the same on every Mac
> from the last six years is the right trade.
>
> If you reject Go on team-skill grounds, the second-best is **Rust**
> with `tokio` + `notify` + `rusqlite` — same single-binary win, more
> verbose. Node/TS is third and only acceptable if you commit to
> shipping it as a `pkg`-bundled binary (no system Node dependency),
> at which point you've reinvented Go with more steps.

Vendored deps to lock in V1: `fsnotify`, `modernc.org/sqlite`,
`crypto/sha256`, stdlib `net/http`, `keybase/go-keychain` (for Apple
Keychain), `log/slog`.

---

## 3. Folder Watcher Strategy

### Watched-folder model

Configurable list of `WatchRoot { path, glob, deviceLabel }`. Producer
configures these via a small local web UI (V1.1) or a YAML config
file (V1.0).

### Stability detection — the only thing that matters in V1

A "completed recording" detector that gets this wrong will upload
half a video or sit on a finished file forever. The rule:

```
A file is "stable" iff
  (mtime has not changed for >= 10s) AND
  (size has not changed for >= 10s) AND
  (file is not exclusively locked) AND
  (file is not in a vendor "in-progress" directory pattern, e.g.
   .tmp, .part, ~, *.rec.tmp, OBS *.mp4.recording sidecar)
```

Implementation:

- Watch with FSEvents (`fsnotify`). On any event for a path,
  schedule a debounced re-poll of `(mtime, size, lock)` 10s later.
- Re-arm the debounce every time we see a fresh write event.
- Use macOS `flock`-style advisory probe (`O_EXLOCK | O_NONBLOCK`) to
  detect an open writer. This is heuristic — some recorders don't
  exclusive-lock — so combine with stat-based quiescence, don't rely
  on lock alone.
- Optional opt-in **"recorder hint" files**: if the source dropped a
  `*.offloadr-ready` sentinel file in the same directory, trust it
  and skip the quiescence wait. This is the clean plugin path for
  later RØDE/ATEM integrations — they can write a sentinel without us
  needing their SDK.

### Crash recovery

On startup, the Helper rescans every `WatchRoot` and runs every file
that doesn't already have a terminal job (`verified` or
`abandoned`) back through the pipeline. **fsnotify misses events
across reboots.** Treat the SQLite job table as the source of truth,
the filesystem as the input.

---

## 4. Telemetry / Event Flow

### Event taxonomy (closed set in V1)

All events share a common envelope:

```ts
type HelperEvent = {
  eventId: string;          // ULID, client-generated, idempotent
  deviceId: string;         // assigned at pairing
  ts: string;               // ISO 8601, monotonic-corrected
  kind: HelperEventKind;
  payload: object;          // per-kind, validated server-side
  sourceLabel?: string;     // e.g. "Studio A camera"
};

type HelperEventKind =
  // lifecycle
  | "helper.started" | "helper.stopped" | "helper.config.changed"
  // ingest
  | "recording.detected"  | "recording.stable"
  | "recording.uploading" | "recording.uploaded" | "recording.verified"
  | "recording.failed"
  // sensors (V1 = filesystem-derived only)
  | "storage.low" | "storage.ok"
  | "device.disk.read_only"
  // V2+ kinds reserved but NOT emitted in V1:
  | "camera.connected" | "camera.disconnected"
  | "audio.activity"   | "audio.silent"
  | "producer.safe_to_close";
```

> **Pushback on the brief's telemetry list.** Half of the examples
> (camera connect, audio activity, "safe to close") require hooks we
> deliberately said we won't build in V1 (no RØDE/ATEM/CoreAudio
> integration). Defining the *event names* now is fine — that's
> forward-compatible — but the V1 Helper will NOT emit them. Promising
> them to producers before they work is worse than not having them.
>
> **"Safe to close"** in particular is a derived signal, not a sensor.
> Its V2 definition should be: *"every stable file in every WatchRoot
> has reached `recording.verified` AND no upload is in progress."*
> The Helper can compute that today from its own state, no hardware
> integration needed. Promote to V1.1 if you want a quick win.

### Transport

- In-process: an unbuffered Go channel feeds the Reporter. Every
  module writes events synchronously; Reporter is the only thing
  allowed to block on the network.
- Reporter writes events to a SQLite `events_outbox` table in the
  same transaction as the state change that produced them
  (exactly-once at the producer, at-least-once on the wire).
- Reporter drains the outbox in batches of up to 50 events / 1 s,
  whichever fills first, to `POST /api/helper/events`.
- Server is idempotent on `eventId`.

### Latency budget

- Telemetry event → server visible: **p95 ≤ 2s** under normal network.
- Upload progress event: **emitted every 5% OR every 2s**, whichever
  comes first. Anything faster melts the API for no human-visible
  benefit.

---

## 5. Upload Pipeline Design

Per-file state machine, persisted in SQLite:

```
DETECTED → STABLE → HASHING → UPLOADING → UPLOADED → VERIFIED
                       │           │           │         │
                       ▼           ▼           ▼         ▼
                     FAILED ←──────┴───────────┴─────────┘  (any → FAILED on terminal error)
                       │
                       ▼
                  ABANDONED (manual or policy-driven)
```

### Definitions

- **HASHING**: compute streaming SHA-256 in 8 MiB chunks. Persist
  partial digest state so a Helper crash doesn't re-hash from zero.
- **UPLOADING**: multipart resumable upload. Three options, in order
  of preference:
  1. Server presigns S3/R2 multipart and the Helper PUTs parts
     directly to R2. Lowest API server load, lowest cost, highest
     throughput. **This is the recommended V1 path** because the
     Offloadr backend already uses R2.
  2. Helper streams through Offloadr API. Easier auth, more API load.
  3. Tus protocol. Nice for resumability but adds a server-side dep.
- **UPLOADED**: all parts confirmed by R2, S3 ETag known.
- **VERIFIED**: Offloadr API has completed its own server-side
  SHA-256 of the persisted object and confirmed equality with the
  Helper-reported digest. **Only then** is the file eligible for the
  Helper's local retention policy to delete or move it.

### Concurrency

- Default 1 upload in-flight. The Mac Mini's NIC and the studio's
  upstream are the bottleneck, not the Helper.
- Configurable to N (≤4) for multi-source setups.
- Hashing happens concurrently with uploading of *other* files but
  never the same file (we need the full hash before we can start a
  signed multipart upload that commits the digest).

### Bandwidth control

- Token-bucket rate limiter, configurable cap (default unbounded).
- Pause uploads if `storage.low` fires AND there's still recording
  happening, so we don't compete with the recorder for disk I/O.

---

## 6. Failure / Retry Handling

A single retry policy table, applied everywhere:

| Failure class | Examples | Retry? | Backoff |
|---|---|---|---|
| Transient network | timeout, 5xx, ECONNRESET | yes | exp, base 2s, cap 5 min, jitter ±20% |
| Auth | 401 from API | refresh device token once, then yes | as above |
| Quota / 429 | API rate limit | yes | honour `Retry-After`, else 60s |
| Permanent client | 4xx other than 401/429/409 | **no**, mark FAILED | n/a |
| Local I/O | disk full, EACCES | yes, with operator-visible alert | 30s |
| Hash mismatch on verify | server SHA ≠ client SHA | **no**, mark FAILED, keep source file, alert | n/a |
| Source file vanished mid-upload | rm during upload | mark ABANDONED with reason | n/a |

Hard rule: **a file is never deleted from local disk by the Helper
until VERIFIED.** No exceptions. Local retention policy (e.g. "delete
after 7 days verified" or "move to /Archive after verified") is
applied by a separate sweeper that only looks at VERIFIED rows.

Operator visibility: every failed job is queryable via local CLI
(`offloadr-helper jobs --failed`) and surfaced as a
`recording.failed` event the Producer Mode dashboard can render.

---

## 7. Local Cache / Temp Storage Strategy

The Helper writes nothing important to ephemeral locations.

| Path | Purpose | Lifetime |
|---|---|---|
| `~/Library/Application Support/Offloadr/helper.db` | SQLite (jobs, events outbox, config snapshot) | persistent |
| `~/Library/Application Support/Offloadr/parts/<jobId>/` | Multipart chunk staging (only if presigned path needs local repack) | until VERIFIED |
| `~/Library/Logs/Offloadr/helper.log` | Rolling slog output (10 MB × 5) | rolling |
| Apple Keychain item `com.offloadr.helper` | Device API key | persistent, OS-protected |

Source recordings are **never copied** into Helper-owned storage.
They are read in place, streamed to R2, then optionally moved by the
sweeper. Doubling 30 GB videos on a producer's SSD is unacceptable.

Disk health monitor polls `statfs` on every WatchRoot's volume every
30s. `storage.low` fires at <10% free or <20 GB free, whichever is
larger. `storage.ok` fires on recovery (with hysteresis: >15% AND
>30 GB).

---

## 8. API Contract Recommendations

New namespace on the Offloadr API: `/api/helper/*`. Add to
`lib/api-spec/openapi.yaml` as a new tag `helper`. All endpoints
require device auth (see Auth below), not user auth.

### Endpoints (V1)

```
POST   /api/helper/pair
       Body: { pairingCode, hostname, osVersion, helperVersion }
       Returns: { deviceId, apiKey, organizationId }
       One-shot. Pairing code is generated in the teacher/admin web UI
       (Producer Mode → Devices → "Pair a Mac Mini"), single-use,
       valid 10 minutes, tied to an org.

POST   /api/helper/heartbeat
       Body: { deviceId, helperVersion, uptimeSec, watchRootStats[] }
       Returns: { configRevision, serverTime }
       Called every 30s. Server uses it to mark device online/offline.

POST   /api/helper/events
       Body: { events: HelperEvent[] }   // batched, ≤50, ≤256 KB
       Returns: { acceptedEventIds: string[] }
       Idempotent on eventId.

POST   /api/helper/uploads
       Body: { sourceFingerprint, fileName, sizeBytes, sha256,
               projectId?, watchRootId, capturedAt }
       Returns: { uploadId, parts: [{partNumber, presignedPutUrl, sizeBytes}],
                  completeUrl }
       Server creates the multipart upload in R2 and hands back the
       presigned URLs. projectId may be assigned by routing rules
       server-side based on watchRootId.

POST   /api/helper/uploads/{uploadId}/complete
       Body: { parts: [{partNumber, etag}] }
       Returns: { mediaFileId, status: "uploaded" }

GET    /api/helper/uploads/{uploadId}/verify
       Returns: { status: "verifying" | "verified" | "mismatch",
                  serverSha256?: string }
       Long-poll or poll-with-backoff. Server-side hash is async.

GET    /api/helper/config
       Returns: { watchRoots[], retentionPolicy, telemetryFilters,
                  configRevision }
       Helper applies on change. Local YAML is the fallback /
       seed; server is the source of truth once paired.
```

### Auth

- **Pairing flow**: producer logs into Offloadr web, opens Devices,
  clicks "Pair", gets a 6-character one-time code (reuse the
  student-code generator's alphabet for consistency). They type it
  into the Helper's first-run prompt. Helper calls `POST /pair` with
  the code + machine identity, receives a long-lived random
  `deviceApiKey` (32 bytes b64url), stores it in Apple Keychain.
- **Subsequent requests**: `Authorization: Bearer <deviceApiKey>`.
  Server middleware `requireDevice` resolves it to a
  `device + organization` context. Treat it exactly like a service
  account: scoped to that org, cannot impersonate users.
- **Rotation**: `POST /api/helper/devices/{deviceId}/rotate-key`
  (user-authed, admin-only on the org). Old key remains valid for a
  24-hour grace window so a deployed Helper can pick up the new key
  via `/config` before the old one is revoked.
- **Revocation**: an admin closes a device and the API key is
  immediately rejected. Helper falls back to "unpaired" state and
  surfaces a one-line error to the local log.
- **Defense in depth (V2)**: mTLS with a per-device client cert
  issued at pairing. Not V1 — Fly's TLS layer + a long random bearer
  is plenty for the pilot.

### Why NOT cookies / Clerk

The Helper is not a human session. Reusing the web auth path would
pull session middleware, CSRF tokens, and a refresh dance into a
headless daemon that doesn't need any of it. Keep it boring: bearer
token, server-side device registry, audit log on every helper action.

---

## 9. Future Plugin Architecture (V3+)

Define the seam now, do NOT build the loader.

```go
type SourceAdapter interface {
    Name() string                            // "folder", "rode-central", "atem", "obs-websocket"
    Start(ctx context.Context, bus EventBus) error
    Stop(ctx context.Context) error
    HealthCheck(ctx context.Context) AdapterHealth
}

type EventBus interface {
    Emit(e HelperEvent)
}
```

V1 has exactly one implementation: `FolderAdapter`. V2 adds
`SafeToCloseAdapter` (pure derived, no hardware). V3 is when we
revisit. By the time RØDE/ATEM/OBS adapters are actually being
written, we'll know which of the following bad ideas to avoid:

- ❌ In-process dynamic plugin loading (Go plugins are a known
  footgun, Node native modules worse).
- ❌ "Plugin marketplace" — there will be 3 plugins, total, ever.
- ❌ JSON-RPC sidecar processes for plugins (over-engineered for V3
  scope).
- ✅ **Sub-process adapter** model: each adapter is a separate small
  binary the Helper spawns and talks to over stdin/stdout NDJSON or
  a UNIX socket. A misbehaving RØDE SDK can't crash the Helper.
  Adapters are versioned and signed by us. Build this when there's a
  real second adapter to validate it against, not before.

Reserved telemetry kinds (see §4) are part of the V3 contract today
so dashboards can render them as "unsupported" gracefully when V1
Helpers report no such events.

---

## 10. Recommended V1 Scope vs Future Scope

### V1 — pilot-ready (target: 2 weeks of focused work)

**In:**

- Single FolderAdapter watching N configured roots.
- Stability detection (mtime + size + lock + sentinel-file opt-in).
- SHA-256 hashing with resumable state.
- Presigned R2 multipart upload through Offloadr API.
- Server-side verify (SHA-256 equality), `recording.verified` event.
- SQLite-backed job + events outbox, crash-safe.
- Pair / heartbeat / events / uploads endpoints on the API server.
- Apple Keychain device key storage.
- launchd plist + first-run pairing CLI.
- Operator CLI: `status`, `jobs`, `pair`, `unpair`, `rotate-key`.
- Storage low/ok telemetry.
- Producer Mode dashboard tile: "Devices" with online/offline +
  last 10 events per device.

**Out:**

- Any hardware SDK (RØDE, ATEM, OBS, CoreAudio).
- Plugin loader.
- Local web UI (CLI + server-side config is enough).
- Auto-update (manual `brew upgrade offloadr-helper` for the pilot).
- mTLS.
- Multi-tenant per machine (one device row = one org).

### V1.1 — quick follow-ups (1 week)

- Local web UI on `127.0.0.1:<port>` for config + live status,
  protected by a localhost-only token.
- `producer.safe_to_close` derived event.
- Bandwidth throttle config.
- Auto-update via Sparkle or `brew tap`.

### V2 — sensors without hardware lock-in (target: after pilot)

- CoreAudio-based audio-activity sensor (still hardware-agnostic).
- USB device enumeration → `camera.connected/disconnected` for
  generic UVC devices.
- Configurable per-WatchRoot routing rules
  (folder → project assignment).
- mTLS device certs.

### V3 — vendor adapters

- Sub-process adapter model (see §9).
- First targets, ranked by ROI: OBS (WebSocket, free, well-documented)
  → ATEM (Blackmagic SDK, well-documented) → RØDE Central
  (last, least open, most fragile).
- Adapter SDK + integration test harness.

### Explicitly punted forever (unless evidence emerges)

- Windows / Linux builds. Mac Mini is the pilot hardware. Don't
  spend a sprint on cross-platform until a paying customer asks.
- "Plugin marketplace".
- In-Helper editing / transcoding. The Helper moves bytes. Anything
  that touches frames lives on the Offloadr backend or downstream.

---

## Open questions for you

Things I should not decide alone:

1. **Pairing UX location**: do we add the "Devices" admin page to
   the existing teacher web app (`artifacts/offloadr-app`) or a new
   admin-only artifact? Recommendation: same app, behind a new RBAC
   permission `canManageHelperDevices` (default: admin only).
2. **Distribution**: Homebrew tap (clean, requires `brew`) vs signed
   `.pkg` installer (Mac-native, requires Apple Developer ID, ~$99/yr).
   Recommendation: Homebrew for pilot, signed pkg before any paid
   customer.
3. **Project routing**: should the Helper know the `projectId`
   upfront (config-driven), or should the server assign one based on
   watch-root rules at upload time? Recommendation: server-side
   rules, so reconfiguring a producer's workflow doesn't require
   editing the Helper's local config.
4. **Pilot scope**: which Mac Mini, which producer, which calendar
   week? Architecture is fine in the abstract, but commit to a real
   first install before shipping V1 or this becomes shelf-ware.
