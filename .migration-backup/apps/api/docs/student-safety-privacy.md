# Offloadr — Student Safety, Privacy & Media Protection (Architecture)

**Status:** Architecture reference. Source of truth for safety/privacy/media-protection decisions before wider rollout. Not legal advice — this is platform architecture, risk reduction, and school-safe infrastructure planning. Pair with [`student-auth-plan.md`](./student-auth-plan.md) (Stage 1) and [`pilot-safety.md`](./pilot-safety.md) (current pre-pilot floor).

**Audience:** product (you), this agent, any future agent or engineer touching student-facing flows. Required reading before any change that affects student identity, media access, sessions, storage, or audit.

**Operating posture:** Offloadr is **school infrastructure**, not consumer SaaS, not a social platform, not a public cloud drive. Defaults must be safe; convenience features must opt in, not opt out.

---

## Critical-thinking review of the brief

Before the architecture, calling out where the brief sets the right bar and where it under-constrains us. Per the working agreement: don't agree by default.

1. **"Hashed IPs for minors" — good direction but the threat needs naming.** Hashing isn't a privacy talisman; it raises the bar for *cross-correlating* logs and reduces blast radius if logs leak. It does *not* anonymise: anyone with the salt + an IP can re-derive the hash. So we need (a) a salt that is never committed to source, (b) a documented salt-rotation procedure, and (c) treatment of logs as confidential regardless. Section 6 below specifies this.
2. **"No anonymous uploads in secure mode" — but Quick Upload Mode still exists.** The brief treats these as orthogonal; in practice a project in `access_mode='both'` will accept both. Teachers and ops must be able to tell *at a glance* which lane a file came in by. The data model already encodes this (`media_files.uploader_kind`); the UI contract is reaffirmed in §3.
3. **"Audit trail for media access."** Logging *upload* is cheap and high-value. Logging *every read* of every file by every viewer is expensive and creates its own privacy problem (we end up storing a detailed reading history of children). The pragmatic line: log uploads, deletions, share creation, and export. Log first-time access of a file by a non-uploader. Don't log every authenticated thumbnail render. Justification in §6.
4. **"Watermarking later" and "export restrictions later."** Watermarking student footage is feasible but expensive (re-encode + storage cost + edit-detection by determined attacker). Export restrictions in a web browser are advisory at best — a determined screen-capture defeats anything we ship. We should be honest about this in §9 rather than promising hard controls.
5. **"Storage retention" is the single biggest legal exposure not yet sized.** A pilot school with weekly recording sessions for a term hits hundreds of GB per class. Schools want both *fast deletion when a parent requests* and *long enough retention to actually use the work*. We must pick defaults *now* — see §5.
6. **Shared iPads are a real, named threat surface, not a UX bug.** A child not logging out + the next child uploading under their identity = a real safety incident. The session-isolation work in Stage 2 is necessary but not sufficient; UI must make "switch student" obvious. §4.
7. **What the brief omits.** Five things worth naming up-front: (a) the platform's own staff access to org data (Offloadr-internal break-glass), (b) cross-org leakage if a teacher belongs to two schools, (c) what happens to a student's uploads when they leave the school, (d) how a school terminates the relationship and gets their data out, and (e) how we tell a school within hours of a breach. These are addressed below.

---

## 1. Student identity protection

**Principles**
- Managed accounts are the default for the secure model; consumer email is not required.
- Collect only what's needed to identify a student to their teacher. Nothing else.
- Students are never publicly discoverable. There is no "find a student" surface.

**Implementation (now / Stage 2)**
- `student_accounts` stores: username (lowercased, scoped to org), display name, optional given/family name, optional email (default null), password hash, status. **Nothing else.** No DOB, no address, no parent contact, no school-issued ID by default.
- Username uniqueness is per-organisation only. `ava.t6` at School A and `ava.t6` at School B are different humans; we never accidentally tie them together via a global key.
- Caller IPs on student sessions and student-attributable activity logs are stored as a salted SHA-256 hash (`ip_hash`, see `artifacts/offloadr-api/src/lib/ipHash.ts`). Raw IPs are never persisted for student-attributable rows.
- No public student-account browsing endpoint exists. There is no `GET /students` for unauthenticated callers, and the teacher-side `GET /classes/:id/students` (Stage 4) is scoped to the teacher's own org and is gated by `requireAuth + requireOrganization + role check`.

**Implementation (later)**
- Optional school email (Stage 7+ / Stage 8 SSO) is opt-in per organisation, not per student.
- A periodic job purges `failed_login_count` / `locked_until` after a clean window so the audit trail of failed attempts doesn't accumulate indefinitely (Stage 6).
- An org-admin "data minimisation report" surface that shows exactly what we store about a student — for school transparency. Stage 7+.

**What we do not do**
- We do not maintain student "profiles" with avatars, bios, follow lists, or any social feature.
- We do not run student names through third-party services (no analytics, no error reporting, no AI assistants) without an explicit per-org opt-in.

---

## 2. Media access control

**Principles**
- Project-level + class-level permissions; no public-by-default for any uploaded media.
- Teachers control visibility; students never can.
- Every read of an upload by an account other than the uploader resolves through a server-side authorisation check.

**Implementation (Stage 2 schema, Stage 5 enforcement)**
- A student's read access to a file is the conjunction of:
  1. The file's project is one the student has access to (via `project_class_access` joined through `class_memberships`, or `project_student_access`), AND
  2. The student is the uploader OR `project_class_access.can_view_class` is true for the class link they used.
- Class-mate visibility defaults **off** (`can_view_class = false`). Teachers must explicitly turn it on per project per class.
- Project upload state is gated by `project_access_mode` (`quick_upload | student_accounts | both | closed`). `closed` returns 403 even for authorised students.
- Schedules: `project_class_access.opens_at` / `closes_at` are honoured server-side. The frontend never decides whether uploads are open.
- Download/preview URLs are signed and short-lived, scoped to a specific media file. The signing key is server-side only. Today's implementation uses S3/R2 presigned URLs; we keep TTLs short (≤ 1 hour) and never embed long-lived URLs in shared HTML. To verify in code: `artifacts/offloadr-api/src/lib/storage.ts`.

**Audit trail for media access**
- Every upload writes an `activity_logs` row.
- Every deletion of a media file writes a row, including the actor and the file id.
- Creation of a teacher-shared review link writes a row.
- Export (download a finished MP4) writes a row.
- First-read of a file by a non-uploader writes a row. Subsequent reads in the same session do not (avoids logging every thumbnail). This is a Stage 6 deliverable.

**What we do not do**
- No file is ever served on a public, unauthenticated URL by default. Public share links are opt-in, time-bounded, and audited.
- No "share to social" surface ships in v1.

---

## 3. School-safe upload architecture

**Principles**
- In secure mode, every upload is tied to an authenticated identity.
- Teachers can disable uploads instantly.
- Quick Upload Mode is isolated, clearly distinguishable, and explicitly opt-in per project.

**Implementation (Stage 6 onwards, but contract begins Stage 2 schema)**
- `media_files.uploader_kind` enum:
  - `user` — staff via the teacher dashboard.
  - `student` — legacy Quick Upload Mode (typed name only, no identity). Retained unchanged so existing rows keep their meaning.
  - `student_account` — authenticated student via the new flow.
- `media_files.uploader_student_account_id` is populated only for `student_account` uploads. It is intentionally **not** a foreign key — deleting a student account doesn't cascade-delete the teacher's project work. The file row keeps the integer id as a historical fact.
- The teacher UI groups files by uploader_kind in two visually distinct lanes when both are present in one project. We never silently merge a Quick Upload typed-name string with a real student account, even when they look alike.
- Closing uploads is two-tier: per-project (`access_mode='closed'`) and per-org (`organizations.quick_upload_mode_allowed=false` shuts off the Quick Upload lane org-wide).
- Per-project teacher action "close uploads now" lands as a single column update; no migration of in-flight uploads — files mid-stream complete then no new ones begin.

**What we do not do**
- We do not allow an unauthenticated POST in secure-mode projects, ever. Even with a leaked project id, the request 401s.
- We do not let a student account "claim" prior Quick Upload uploads. That would let a student rewrite history. If a teacher wants this, they do it via their own dashboard with full audit.

---

## 4. Student session safety

**Principles**
- Strict route isolation between student and teacher/admin sessions.
- Rate limiting and brute-force protection at both the HTTP edge and the DB.
- Session lifetime bounded by both idle and absolute timeout.
- Shared-device scenarios are first-class.

**Implementation (Stage 2 — shipped)**
- Separate cookie (`offloadr_student_sid`), separate session table (`student_sessions`), separate middleware (`requireStudent`). Teacher middleware (`requireAuth`) only reads `req.session.userId` (express-session) and never inspects the student cookie. A student cookie sent to a teacher route returns 401.
- Session token: 32 random bytes (256 bits) hex-encoded. Only the SHA-256 hash is stored in the DB; the raw token lives in the cookie only. DB compromise does not yield session-stealing material.
- Cookie flags: `HttpOnly`, `Secure` in production, `SameSite=Lax`.
- Idle timeout: 30 minutes since last seen. Absolute timeout: 8 hours since issue.
- DB-backed per-username lockout: 5 failed attempts → 15-minute lock, reset on success. This is independent of the HTTP rate limiter and holds even if the attacker rotates IPs.
- HTTP rate limiter: per-IP (100 per 15 min) AND per-IP+username (10 per 15 min) — two limits in series so a school's NAT IP doesn't lock out the whole school but a single hammered account is throttled fast.
- Login response is the same generic message for "no such user," "locked," and "wrong password," with constant-ish bcrypt work in all three branches so timing doesn't leak existence.
- Account suspended/archived by teacher takes effect on the student's very next request (re-check on every `requireStudent`), not on next login.

**Shared-iPad considerations**
- Idle timeout of 30 min is deliberately tight for shared-device safety.
- Stage 3 UI: a persistent "Switch student" affordance in the header that logs the current student out and pre-fills nothing.
- Stage 7 (planned): QR login cards — single-use, 15 min validity — so a student doesn't have to type their password in front of classmates.

**What we do not do**
- We do not implement "remember me" for students. Sessions never extend beyond the absolute 8-hour cap.
- We do not let a student route ever escalate into a teacher route via a privilege check the server doesn't perform itself.

---

## 5. Storage and retention

**Principles**
- Defaults bias safe (deletion is recoverable for a short window; long-term retention is opt-in).
- Teachers can delete; admins can purge; org admins can configure retention windows.
- Storage assumptions: encrypted at rest (provider-managed), accessed via signed URLs only, located in a region the school accepts.

**Current state**
- Offloadr production storage is Cloudflare R2 (bucket `offloadr-production`). Encryption at rest is provided by R2. Object ACLs are private; access is via signed URLs only.
- Region: data lives in R2's default global object storage. For Australian school procurement we should be able to answer "where does the data physically live?" — flagged as an open question for the next external-dependencies review.

**Retention defaults (proposed; for sign-off before Stage 5/6 ships)**
- **Per project:** project files are retained for the lifetime of the project, plus 90 days after the project is archived. After 90 days they move to "purgeable" status; a daily job permanently deletes objects in that state.
- **Per organisation:** an org admin can configure a stricter retention window (e.g. 30 days post-archive) or a longer one (e.g. 12 months post-archive). Hard cap: 24 months without explicit support intervention.
- **Per parental-request deletion:** when a parent or school requests deletion of a specific student's work, the action is performed within 7 business days. Audit log written. We retain only enough metadata to prove the deletion happened.
- **Per school exit:** when an org cancels, they have 60 days to export all data via a one-click teacher-side export. After 60 days, the org's storage tree is hard-deleted within 7 business days. We retain billing/audit metadata indefinitely as is legally required, with no media.

**Implementation (later)**
- A `retention_settings` column on `organizations` (Stage 7+).
- A daily reaper job that walks "purgeable" rows older than the org's window and deletes objects + DB rows.
- A teacher-visible "Files scheduled for deletion" view so deletions never feel like silent data loss.

**What we do not do**
- We do not promise "never deleted." We do not promise immutable backups for student work without a billing tier that funds it.
- We do not commingle media across orgs in storage. Bucket prefix `org/<id>/project/<id>/file/<id>` is hard, with no shared paths.

---

## 6. Audit logging

**What we log** (target state — Stage 2 schema in place, write-path filled in across Stages 5/6)
- Login: success, failure (with reason category), lockout. Includes student id (or 'unknown' for failures pre-account-lookup), `ip_hash`, user-agent prefix, timestamp.
- Logout: explicit.
- Upload: project id, uploader kind, uploader student id (if applicable), file id, size, timestamp, `ip_hash`.
- File deletion: who, what, when.
- Project access change: who added/removed which class/student to which project.
- Class roster change: who added/removed which student from which class.
- Password reset: teacher who triggered, student affected, timestamp. Never the issued password (only its hash).
- Export / share link creation: who, what, scope, expiry.
- First-read of a file by a non-uploader: who, what, when (Stage 6).

**What we do NOT log**
- Raw IP addresses for student-attributable rows. `ip_hash` only.
- File contents, transcripts, or any derivative of media itself in the activity log.
- Subsequent reads of an already-accessed file in the same session (noise:value too poor).
- Search queries or browse trails.

**Storage and access**
- `activity_logs` lives in the same Postgres as the rest of the app data. Access is via the same auth-gated routes; org admins see only their org's rows.
- Retention: rolling 24 months by default. Older rows are pruned by a monthly job. Justification: long enough for an incident response window, short enough that we're not the world's record-holder of children's media-handling logs.
- Export: org admins can export their org's activity log to CSV at any time (Stage 5+). The export is itself an `activity_logs` event ("admin X exported the audit log on date Y").

**Salt management for `ip_hash`**
- Salt source priority: `IP_HASH_SALT` env var (preferred, rotate independently), falling back to `SESSION_SECRET`, falling back to a documented dev string (never used in production).
- Salt rotation invalidates the ability to correlate old hashes with new ones — that's by design. When rotated, document the rotation date so investigators know the cutoff.

---

## 7. Classroom operational safety

**Principles**
- Teachers, not platform defaults, decide when and how students can act.
- All operational levers are reversible without ops intervention.

**Levers a teacher controls (target state across Stages 4–6)**
- Open / close uploads on a project (immediate).
- Add / remove a class from a project's access list.
- Add / remove a single student from a project's access list (exception path).
- Add / remove a student from a class.
- Reset a student's password (one click → new temp password → new printable card).
- Suspend a student account (preserves history; blocks login).
- Archive a class (read-only for review, no new activity).

**Levers an org admin controls**
- Toggle Quick Upload Mode allowed org-wide.
- Toggle student-accounts enabled org-wide (`organizations.student_accounts_enabled`).
- Set per-org default username format.
- (Later) Set retention window.
- (Later) Export audit log.

**Moderation / review queue (later)**
- Optional org-level setting: "All student uploads go to a review queue before they're visible to the wider class." Off by default. Stage 7+.

**What we do not do**
- We do not allow students to delete each other's uploads.
- We do not allow students to invite other students.
- We do not allow students to create projects or classes.

---

## 8. Future compliance considerations

Not implementing today. Documenting so future decisions are anchored.

- **Australian school procurement.** Schools will ask: data residency, breach-notification SLA, sub-processors, privacy-impact assessment, IT security review pack. We should be able to produce a one-page security overview pulled from this document on request.
- **COPPA-style considerations.** Even though Offloadr targets school-managed accounts (which sidestep US COPPA's "directed to children under 13" surface), we should treat under-13 student data as if COPPA applies: minimal collection, no third-party advertising integrations, parental-request deletion within 7 business days.
- **Department of Education IT reviews.** Some Australian state departments require a formal data-handling assessment before procurement. The artefacts they ask for: this document, a current data-flow diagram, the threat model, and a recent vulnerability scan summary.
- **Consent workflows.** Future: per-project "media-release acknowledgement" capture from teachers (and optionally parents) before students upload. Tracked on the project row.
- **Media-release integrations.** Future: hook to a school's existing media-release tracking (often a paper form) so the project can refuse uploads from students whose release isn't on file. Schema reservation only at this stage.

---

## 9. Security roadmap

Staged, no commitments outside this list.

| Stage | Item | Notes |
|---|---|---|
| Now (Stage 2) | Separate student session system, per-username lockout, hashed IP logging | Implemented in `lib/student-auth.ts`, `lib/ipHash.ts`, `lib/rateLimit.ts`. |
| Stage 4 | Printable login cards, bulk roster import with CSV-injection-safe export | Per the student-auth plan. |
| Stage 5 | Server-side access checks for every student route; project access tab UI | `studentCanAccessProject(studentId, projectId)` helper as the single chokepoint. |
| Stage 6 | First-read audit log for files; org-level retention setting; org-level Quick Upload toggle UI | DB-side flags already in place. |
| Stage 7 | QR login cards (one-time, 15 min); MFA for staff (TOTP); per-org username format override UI | QR threat-modelled separately before build. |
| Stage 8 | SSO for staff (Google Workspace + Microsoft 365); optional SSO for students at high schools | External-config; gated by per-org enablement. |
| Later | Device trust (a teacher device "remembers" longer than a public iPad) | Requires reliable device-id story; out of scope until business case justifies. |
| Later | Watermarking on student preview renders | Cost vs benefit unclear; document but don't promise. |
| Later | Export restrictions (right-click disable etc.) | **Advisory at best in a browser**; we will not claim this is a hard control. |
| Later | Internal break-glass access logging for Offloadr staff | When/if any Offloadr staff role exists with cross-org read access, every read must be auditable to the org admin. |

---

## 10. Product philosophy

Offloadr should feel like **school infrastructure**: predictable, defensive, teacher-controlled, boring-in-a-good-way. The platform's job is to make the *teacher* look competent in front of their school's IT department.

Offloadr is **not**:
- a social network
- a public cloud drive
- a creator platform
- a consumer SaaS

Where convenience and safety conflict, safety wins by default; convenience is opt-in.

**Decision filter for new features (use this before shipping any student-facing change):**
1. Is the default behaviour safe for the youngest, least technical student on the platform?
2. Can a teacher reverse it without contacting support?
3. Is every state-change auditable to the org admin?
4. Does it introduce any new third-party processing of student PII? (If yes, gate behind explicit per-org opt-in.)
5. Does it create a path for a student to discover, contact, or be discovered by another student outside their class? (If yes, do not ship.)

If any answer is "no" or unclear, the feature is not ready.

---

**End of document. Update this file when:**
- a new student-facing feature lands that changes the access, identity, retention, or audit story,
- a third-party dependency is added that touches student data,
- a security incident requires updating the response posture,
- a school surfaces a compliance requirement we hadn't anticipated.
