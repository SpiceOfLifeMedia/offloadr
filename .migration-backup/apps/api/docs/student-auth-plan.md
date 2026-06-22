# Offloadr — Student Auth + Classroom Account Model

**Status:** Planning only. Nothing in this document has been built. Do not start implementation until the user signs off on the staged plan.

**Owner:** Offloadr core platform
**Reviewers:** product (you) + the agent that picks up implementation in stage 2+
**Goal:** Replace "upload code only" as the *default* student workflow with proper managed student accounts, while keeping upload codes as an explicit Quick Upload Mode fallback. Treat Offloadr like school infrastructure, not consumer SaaS.

---

## 1. Critical-thinking review of the proposed direction

Before the design, calling out where the brief is strong and where it has gaps. Per the working agreement we don't agree by default.

**Where the brief is right:**
- Forcing student email is wrong for Australian primary schools. Username + password + teacher-printed login cards is the standard in classroom tools (Mathletics, Reading Eggs, Seesaw, Education Perfect). The brief is correct.
- Separating teacher and student sessions is non-negotiable. Sharing one session model invites a student opening DevTools and probing teacher routes.
- Keeping upload codes as a fallback rather than ripping them out is the right call — they're already shipped and working, schools mid-pilot would hate a forced migration.

**Where the brief has gaps — flagging now so we decide before building:**

1. **"Class" vs "Project" — these are two different things and the brief blurs them.** A class is a *roster of students* that persists across many projects. A project is a *piece of work* assigned to a class (or a subset of it). We need both, with project access derived from class membership. The brief sometimes uses them interchangeably ("Only students in Year 6 Media can upload to Lunchtime News Segment"). The data model below makes them explicit.

2. **Shared iPads.** The brief mentions them but doesn't address the actual UX problem: a kid sits down, the previous user is still logged in. Real fix: short idle-timeout for student sessions (e.g. 30 min), a one-tap "Switch student" affordance, and a "Quick switch" mode where the teacher's class is pre-selected and the student just picks their own login card. We should bake idle-timeout into Stage 2 and the switch-student UI into Stage 3.

3. **Brute force on student usernames.** A class roster is a known small set (`ava.t6`, `noah.t6`, `mia.t6`). An attacker on the school wifi could spray passwords. We need rate limiting *and* lockout *per username* (not just per IP, because all students share the school's NAT). Spelled out in Section 6.

4. **Password reset chaos.** The brief says "no email = no inbox/password-reset chaos," which solves one problem but creates another: when a student forgets their password, *only the teacher* can reset it. That's fine, but it must be a one-click action in the teacher UI and produce a new printable login card. If the teacher leaves and isn't replaced, an admin must also be able to reset. Covered in Section 3 (roles) and Section 5 (UI).

5. **Audit trail for under-13s is a legal exposure, not just a feature.** Australian Privacy Act + state-level education data rules. If we log "Ava uploaded interview_v3.mp4 at 10:23am from IP x.x.x.x", we are now storing PII about a minor. We should log enough to be defensible (who uploaded what, when, which project) but **not** raw client IPs by default — store a salted hash, with the option for an org admin to enable raw IPs for incident response. Flagging now; doesn't change Stage 2 schema but changes what `activity_logs` writes.

6. **Quick Upload Mode coexistence.** If a project has *both* assigned students AND Quick Upload Mode enabled, who uploaded what? The brief implies "Teacher can see which student uploaded which files" but Quick Upload uploads are anonymous-by-name. The plan is: when both modes are on, `media_files.uploader_kind` clearly distinguishes (`student_account` vs `quick_upload`), and the teacher UI groups them in two visually distinct lanes. We do **not** try to reconcile a Quick Upload student-name string with a real student account — too error-prone.

7. **"Optional Microsoft/Google SSO later" for students.** Realistic only for high school with managed Microsoft 365 tenancies. Don't promise this on the marketing site until we've actually built it; suggest framing it as "coming in 2027" rather than a checklist item.

---

## 2. Schema plan

All new tables go in `lib/db/src/schema/`. All tables get `id` (uuid, gen_random_uuid), `created_at`, `updated_at` columns by convention — omitted below for clarity.

### 2a. New tables

```text
classes
  organization_id    fk → organizations (REQUIRED — tenancy boundary)
  name               text                   -- "Year 6 Media"
  year_level         text NULL              -- "6", "9", "Mixed"
  subject            text NULL              -- "Media Studies"
  external_ref       text NULL              -- school SIS id if imported
  archived_at        timestamptz NULL
  created_by         fk → users             -- teacher/admin who made it
  INDEX (organization_id, archived_at)

student_accounts
  organization_id    fk → organizations
  username           citext                 -- "ava.t6"; unique per org, NOT global
  display_name       text                   -- "Ava Thompson"
  given_name         text NULL
  family_name        text NULL
  password_hash      text                   -- bcrypt
  password_must_change boolean default true -- true for generated temp passwords
  email              citext NULL            -- optional, opt-in per org
  status             text                   -- 'active' | 'suspended' | 'archived'
  archived_at        timestamptz NULL
  last_login_at      timestamptz NULL
  failed_login_count int default 0
  locked_until       timestamptz NULL
  created_by         fk → users
  UNIQUE (organization_id, username)
  INDEX (organization_id, status)

class_memberships
  class_id           fk → classes
  student_account_id fk → student_accounts
  role               text default 'student' -- room for 'media_leader' later
  added_by           fk → users
  removed_at         timestamptz NULL       -- soft remove preserves audit
  UNIQUE (class_id, student_account_id) WHERE removed_at IS NULL

project_class_access            -- replaces "open to the world via code"
  project_id         fk → projects
  class_id           fk → classes
  can_upload         boolean default true
  can_view_own       boolean default true
  can_view_class     boolean default false  -- "let students see each other's work"
  opens_at           timestamptz NULL       -- scheduled open
  closes_at          timestamptz NULL       -- scheduled close
  added_by           fk → users
  UNIQUE (project_id, class_id)

project_student_access          -- one-off per-student additions/exceptions
  project_id         fk → projects
  student_account_id fk → student_accounts
  can_upload         boolean default true
  can_view_own       boolean default true
  added_by           fk → users
  UNIQUE (project_id, student_account_id)

student_sessions               -- SEPARATE from teacher express-session table
  id                 text primary key       -- opaque cookie value
  student_account_id fk → student_accounts
  organization_id    fk → organizations     -- denormalised for fast checks
  created_at         timestamptz
  last_seen_at       timestamptz
  expires_at         timestamptz
  ip_hash            text NULL              -- salted, see §1.5
  user_agent         text NULL
  INDEX (student_account_id, expires_at)

student_password_resets
  student_account_id fk → student_accounts
  issued_temp_password_hash text             -- so a teacher can re-print the card
  issued_by          fk → users
  issued_at          timestamptz
  consumed_at        timestamptz NULL
  -- NOT a token; just a record of "teacher reset Ava's password at X"
```

### 2b. Changes to existing tables

```text
media_files
  + uploader_student_account_id  fk → student_accounts NULL
  + (keep existing studentUploaderName + studentUploadCodeId for Quick Upload Mode)
  + uploader_kind  -- expand enum: 'user' | 'quick_upload' | 'student_account'

projects
  + access_mode  -- 'student_accounts' | 'quick_upload' | 'both' | 'closed'
                 -- replaces studentWorkflowChoice for new projects
  + (keep classGroup/lessonType as legacy metadata for old projects)

activity_logs
  + actor_kind        -- 'user' | 'student_account' | 'system'
  + actor_student_account_id fk → student_accounts NULL
  + ip_hash           -- replace raw IP storage; see §1.5
  + (existing userId stays, now NULL when actor is student or system)
```

### 2c. What we deliberately do NOT add

- No global student username uniqueness. `ava.t6` at School A and `ava.t6` at School B are different humans. Uniqueness scoped to `organization_id` only.
- No `school` table separate from `organizations`. The existing `organizations` table already plays that role. Don't proliferate.
- No "parent account" model. Out of scope. Schools handle parent comms.

---

## 3. Role and permission model

Three primary roles; the fourth is a deferred extension.

| Capability | admin | teacher | student | media_leader (later) |
|---|---|---|---|---|
| Manage org / billing / storage | ✅ | ❌ | ❌ | ❌ |
| Create/archive classes | ✅ | ✅ | ❌ | ❌ |
| Add/remove students from a class | ✅ | ✅ (own classes) | ❌ | ❌ |
| Reset student password | ✅ | ✅ (own classes) | ❌ | ❌ |
| Create project | ✅ | ✅ | ❌ | ❌ |
| Assign project to class | ✅ | ✅ (own projects) | ❌ | ❌ |
| Toggle Quick Upload Mode | ✅ | ✅ (own projects) | ❌ | ❌ |
| Approve / finalise project | ✅ | ✅ (own projects) | ❌ | ✅ (own class only, scoped) |
| Log into student-login | ❌ | ❌ | ✅ | ✅ |
| See assigned projects only | n/a | n/a | ✅ | ✅ |
| Upload to a project | via teacher workflow | ✅ | ✅ (assigned only) | ✅ (assigned only) |
| See own upload status | n/a | ✅ | ✅ | ✅ |
| See classmates' uploads | n/a | n/a | only if `can_view_class=true` | only if `can_view_class=true` |
| See other classes' projects | n/a | n/a | **never** | **never** |
| See teacher dashboard / settings / storage / devices | n/a | ✅ | **never** | **never** |
| See audit log | ✅ | ✅ (own projects) | ❌ | ❌ |

Two distinct session systems:
- **`user_sessions`** (existing `express-session` + `connect-pg-simple`) — teachers/admins only.
- **`student_sessions`** (new table above) — students only. **Different cookie name** (`offloadr_sid` vs `offloadr_student_sid`), **different middleware** (`requireStudent` vs `requireAuth`), **different route prefix** (`/api/student/*` vs `/api/*`). A student session cookie must never authenticate a teacher route, and vice versa.

---

## 4. Route plan

### 4a. New API routes

Under `/api/student/` (all guarded by `requireStudentSession`):
```
POST   /api/student/auth/login           { username, password }            → sets student session
POST   /api/student/auth/logout                                            → clears student session
GET    /api/student/me                                                     → { id, displayName, classes[] }
POST   /api/student/auth/change-password { currentPassword, newPassword }  → required if password_must_change

GET    /api/student/projects                                               → only projects the student has access to
GET    /api/student/projects/:id                                           → 403 if not authorised, NEVER 404 (avoid id-enumeration leak — see §6)
POST   /api/student/projects/:id/uploads (multipart)                       → upload tied to student_account_id
GET    /api/student/projects/:id/my-uploads                                → student's own uploads only
GET    /api/student/projects/:id/class-uploads                             → only if can_view_class
```

Under `/api/` (existing teacher prefix, guarded by `requireAuth` + `requireOrganization`):
```
POST   /api/classes                                                        → create class
GET    /api/classes                                                        → list classes in org
GET    /api/classes/:id
PATCH  /api/classes/:id
POST   /api/classes/:id/archive

POST   /api/classes/:id/students                  { displayName, username? }  → create student in class
POST   /api/classes/:id/students/bulk             { csv | array }            → import roster
DELETE /api/classes/:id/students/:studentId                                  → soft remove from class
POST   /api/students/:id/reset-password                                       → returns new temp password ONCE
POST   /api/students/:id/archive
GET    /api/students/:id/login-card                                          → printable PDF/PNG

POST   /api/projects/:id/class-access            { classId, can_view_class? }
DELETE /api/projects/:id/class-access/:classId
POST   /api/projects/:id/student-access          { studentId }
DELETE /api/projects/:id/student-access/:studentId
```

Existing `/api/student-upload/codes/...` routes stay exactly as they are. They become Quick Upload Mode and are unchanged.

### 4b. New web routes (frontend)

```
/student-login                       student username/password form
/student/change-password             forced when password_must_change
/student/projects                    "My Media Projects"
/student/projects/:id                project detail (student view: only own uploads + brief)
/student/projects/:id/upload         upload UI

/classes                             teacher: list classes
/classes/new                         teacher: create class
/classes/:id                         teacher: class detail (roster + assigned projects)
/classes/:id/import                  teacher: CSV import
/classes/:id/login-cards             teacher: print all login cards for class

/projects/:id/access                 teacher: assign classes/students, toggle Quick Upload Mode
```

`/student-upload` and `/student-upload/:code` (Quick Upload Mode) stay, just relabelled in UI copy and demoted from the primary CTA.

---

## 5. UI flow

**Teacher first-time onboarding (after this is built):**
1. Teacher logs in, lands on dashboard, sees a new "Classes" item in the sidebar.
2. Empty state on `/classes` invites them to "Create your first class" with a one-screen form (name, year level, subject).
3. Inside a class, two big actions: **Add students one-by-one** and **Import from CSV** (template provided).
4. After adding students, banner appears: "Print login cards for this class" → A4 PDF with username, temp password, and a friendly graphic. One card per student.

**Teacher project assignment:**
1. On a project, new "Access" tab next to existing tabs.
2. Two sections: **Classes with access** (most common) and **Individual students** (exceptions).
3. Toggle: "Also allow Quick Upload Mode" (off by default for new projects; on by default for any project migrated from the old system — see §7).
4. Per-class checkboxes: "Students can see each other's uploads" (default off).

**Student flow:**
1. Goes to `https://app.useoffloadr.com/offloadr/student-login` (note: today this would be `offloadr-pilot.fly.dev/offloadr/student-login` until the DNS change lands).
2. Types username + password from their printed card.
3. If `password_must_change`, forced to set a new one. Skippable only by teacher reset, not by student.
4. Lands on "My Media Projects" — a clean grid of assigned projects, with class label.
5. Picks a project → sees title, teacher's brief, due-date if any, and a big upload area.
6. Uploads (with progress, verification, success states already implemented in the Quick Upload session page; reuse that component).
7. Sees only their own uploads listed below (or their class's, if `can_view_class=true`).
8. Header has a "Switch student" link for shared-iPad use.

**Teacher review:**
1. Existing project file list, but each file row now shows uploader badge: 👤 "Ava Thompson (Year 6 Media)" or 🔑 "Quick Upload — name typed: Noah" with visual distinction.
2. Filter dropdown: by student, by class, by upload mode.
3. Per-file: "remove from project," "request re-upload from this student," "approve."

---

## 6. Security risks — explicit threat list

Mapping each risk to the mitigation. This is the bar for "done" on Stage 2+.

| Risk | Mitigation |
|---|---|
| **Project ID enumeration** (`/student/projects/123` then `/124`) | Use uuids (already in schema). Server returns the same response code (403) whether project doesn't exist or student lacks access — never differentiate 403 vs 404. |
| **Shared/guessable passwords across a class** | Temp passwords are 8 random chars from a no-look-alike alphabet (`23456789ABCDEFGHJKLMNPQRSTUVWXYZ` — no 0/O/1/I/l). Force change on first login. |
| **Username spray / brute force** | Per-username rate limit (5 failed attempts → 15 min lockout), per-org rate limit, per-IP rate limit. `locked_until` column already in schema. **Important:** lockout must be by username, not just IP, because the whole school NATs through one IP. |
| **Cross-class access by URL hacking** | Every student route resolves access via `project_class_access` JOIN `class_memberships` WHERE `student_account_id = session.student_id`. Single SQL helper `studentCanAccessProject(studentId, projectId)` reused everywhere. Default deny. |
| **Student → teacher privilege escalation** | Different cookie name, different middleware. `requireAuth` rejects student cookies; `requireStudent` rejects teacher cookies. Belt-and-braces: a top-level Express middleware blocks any request from a student cookie hitting a path that doesn't start with `/api/student/`. |
| **Exposed teacher routes via direct URL** | Frontend route guard `<RequireTeacher>` redirects to `/login`. Backend never relies on frontend guards — every route re-checks. |
| **Audit trail gaps** | Every state-changing student route writes to `activity_logs` with `actor_kind='student_account'`. Read routes don't log by default to avoid noise; reads on projects flagged "sensitive" (configurable per org later) can opt in. |
| **PII on minors in logs** | Store `ip_hash = sha256(ip + per-org-salt)`. Raw IP only stored if org admin opts in for incident response. Display names of students never leave the org in any external service (no Sentry tags, no analytics events). |
| **Session fixation / theft** | Student cookies: `HttpOnly`, `Secure` (in prod), `SameSite=Lax`, `Path=/offloadr/`. New session id issued on login. Idle timeout 30 min, absolute timeout 8 hours. |
| **CSRF on student state-changing routes** | Existing teacher CSRF approach (whatever it is — to confirm in Stage 2) extended to student routes. If none exists, add `SameSite=Lax` + double-submit token. |
| **Quick Upload Mode still being abused** | Unchanged from today, but: per-org toggle "Quick Upload Mode allowed at all" so a security-conscious school can globally disable it. |
| **Bulk roster import as XSS / CSV injection vector** | All imported names HTML-escaped on render (React does this). On CSV *export* of rosters (for printing), prefix any cell starting with `=`, `+`, `-`, `@` with a single quote. |
| **Insecure direct object reference on uploads** | Media file download URLs are signed and short-lived (existing pattern — verify). Students get signed URLs scoped to files they own. |

---

## 7. Migration plan — moving off "upload code only" without breaking the pilot

The pilot school is live. We cannot break it. Migration is **additive then opt-in**.

**Step A — additive (Stages 2–4):**
- New tables created. Old `student_upload_codes` table untouched.
- New routes added under `/api/student/*` and `/api/classes/*`. Old routes untouched.
- Frontend gains `/student-login`, `/classes`, etc. Existing `/student-upload` page stays as the headline CTA on the home page so primary school teachers in the pilot see no change.

**Step B — coexistence (Stage 5):**
- Existing projects get `access_mode = 'quick_upload'` by default via migration — they keep working exactly as today.
- New projects default `access_mode = 'student_accounts'` IF the creating org has at least one class with students. Otherwise default `quick_upload` and prompt: "Want to set up classes for a more secure workflow?"

**Step C — pilot opt-in (Stage 6):**
- Show the pilot school a per-org toggle: "Use Quick Upload Mode by default for new projects? [yes/no]". They choose.
- Migration tooling for teachers: "Convert this project to use student accounts" → links existing project to a class, future uploads use new path, historical Quick Upload uploads stay intact and visible.

**Step D — defaults flip (later):**
- Once 80% of active projects are on student accounts, flip the new-project default org-wide to `student_accounts`. Quick Upload Mode remains available, just no longer the default.

**Step E — never:**
- Never delete `student_upload_codes` or break old URLs. They're permanent quick-upload infrastructure.

---

## 8. Staged implementation plan

Each stage is independently shippable behind a feature flag (`OFFLOADR_STUDENT_ACCOUNTS_ENABLED` per-org). Order matters; later stages depend on earlier.

**Stage 1 — Planning (this document).**
Done when you sign off on this. Confirm or revise: §1 gaps, §2 schema, §3 roles table, §7 migration approach. Specifically I want explicit answers on:
- Class vs Project model (§1.1) — accept or revise?
- IP hashing for under-13 audit (§1.5) — accept or default to raw IP?
- Org-level "Quick Upload Mode allowed at all" toggle (§6 table) — accept or always-on?

**Stage 2 — Schema + backend auth foundation.**
- Drizzle migrations for §2 tables + column additions.
- `requireStudent` middleware, student session table, login/logout/me/change-password routes.
- Per-username lockout logic.
- Unit tests for: login, lockout, session isolation (student cookie cannot hit teacher route).
- No UI yet.

**Stage 3 — Student login UI + "My Media Projects."**
- `/student-login`, `/student/change-password`, `/student/projects` pages.
- Switch-student affordance.
- 30-min idle timeout, browser warning at 25 min.
- E2E test: login → see only assigned projects → log out.

**Stage 4 — Teacher class/student management.**
- `/classes`, `/classes/:id`, single + bulk student creation, archive, reset password.
- Printable login cards (A4 PDF).
- CSV import.

**Stage 5 — Project assignment and permission checks.**
- `/projects/:id/access` tab.
- `project_class_access` / `project_student_access` writes.
- `studentCanAccessProject()` helper enforced on every student route.
- Migration of existing projects to `access_mode='quick_upload'`.

**Stage 6 — Upload flow tied to student identity.**
- Student upload routes write `uploader_student_account_id`.
- Teacher file list shows uploader badge, filter by student/class/mode.
- Refactor existing upload session component to be reusable between Quick Upload Mode and student-account mode.

**Stage 7 — Password reset / printable login cards / QR login.**
- Teacher one-click reset → new temp password → printable card regenerated.
- QR login cards (encodes username + one-time password, valid 15 min, single-use).
- Decide: do we want QR cards in Stage 7 or punt to a later stage? They need careful threat modelling for shared-iPad scenarios.

**Stage 8 — Optional Microsoft/Google SSO for students (later).**
- Only for orgs that opt in. Maps SSO subject claim to `student_accounts.external_ref`.
- Not committed; on the roadmap, not the marketing site.

---

## 9. Open questions for the user before Stage 2

1. **Class vs Project model** (§1.1) — confirm.
2. **IP hashing for minors' audit log** (§1.5) — confirm or override.
3. **"Quick Upload Mode allowed at all" org toggle** (§6) — keep or drop.
4. **QR login cards** — Stage 7 or later?
5. **Pilot school behaviour** — should existing in-flight projects at the pilot school stay 100% Quick Upload (zero change), or do we offer them the new system on day 1 of Stage 6?
6. **Naming.** "Class" is the right word in AU. Confirm we use "Class" not "Group/Cohort/Section" in the UI.
7. **Username convention.** Brief suggests `ava.t6` (firstname.initial+year). Some schools want `tho001` (initials + sequence). We should support either at creation time with a per-org default format string — confirm or override.

---

## 10. What stays unchanged

- `organizations`, `users`, `organization_memberships`, `projects` (other than added columns), `media_files` (other than added columns), `activity_logs` (other than added columns), `student_upload_codes`.
- The existing teacher session system (`express-session` + `connect-pg-simple`).
- The existing upload-code public flow and its pages, including URL paths.
- All existing API contracts continue to function.

---

**End of plan. Awaiting sign-off on Section 9 before any Stage 2 work begins.**
