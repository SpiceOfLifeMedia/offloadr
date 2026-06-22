# Feature Spec: Producer Mode — Script Recording / Teleprompter

**Status:** Roadmap — not started  
**Priority:** Post-pilot  
**Scope:** Offloadr student portal (not a standalone app)

---

## 1. Overview

Producer Mode adds a guided in-browser recording workflow to the existing Offloadr student
project portal. A teacher attaches a script to a project; students open the project on a tablet,
read from a full-screen teleprompter, record their take using the browser's MediaRecorder API,
then send the recorded file directly to the project via the existing upload pipeline.

The feature is an extension of the authenticated student account flow (Stage 2 of the current
roadmap). It does not replace the Quick Upload code flow — it adds a richer in-portal recording
experience for schools that use student accounts.

---

## 2. Personas & Goals

| Persona | Goal |
|---|---|
| **Teacher / Producer** | Attach a script to a project, see which students have submitted takes, re-open a take for re-recording |
| **Student (account)** | Read script without distraction, record at their own pace, discard and re-try freely, deliver with one tap |

---

## 3. User Flow

### 3a. Teacher — Script Setup

```
Project detail page
  └── [+ Attach Script] button  (shows when project has no script)
        └── Script editor modal
              ├── Title (optional, e.g. "Sam's Intro Segment")
              ├── Body (plain text or Markdown, rendered in teleprompter)
              └── [Save Script]  →  script saved, button changes to [Edit Script]
```

- Teacher can update the script at any time before a student submits their take.
- Updating the script after submission is allowed but triggers an activity log warning;
  it does not invalidate existing submitted takes.
- Teacher can delete the script (resets to no-script state; student portal reverts to
  the plain file upload view for that project).

### 3b. Student — Recording Flow

```
Student portal: /student/projects/:projectId
  └── [Producer Mode] card  (only visible when a script is attached and project is open)
        └── [Start Recording] →

Full-screen Teleprompter View
  ├── Script text (auto-scrolls, adjustable speed)
  ├── Text size: S / M / L / XL
  ├── Scroll speed: slow / medium / fast / pause
  ├── [● Record] button  →  MediaRecorder starts, red dot indicator
  │     └── Recording state:
  │           ├── [■ Stop] button  →  recording ends, preview playback appears
  │           └── Timer (MM:SS)
  └── [Exit]  →  confirm dialog ("Recording will be lost. Exit anyway?")

Post-recording Review
  ├── Inline video preview (recorded blob)
  ├── [Record Again]  →  discard blob, return to Teleprompter View
  └── [Send to Teacher]  →  upload flow begins
        ├── Upload progress bar (XHR with progress events)
        ├── ✓ Delivered! confirmation screen
        └── [Back to My Projects]
```

- The recording never leaves the device until the student explicitly taps "Send to Teacher".
- Students can record and discard unlimited times before sending.
- Once sent, the take is locked — re-recording requires the teacher to re-open it
  (sets `script_takes.status` back to `'recording_open'`).
- A student can only have one active take per project per script version. Sending a new take
  supersedes the previous one (previous `media_file` is soft-kept; `script_takes.status`
  set to `'superseded'`).

---

## 4. Data Model

### 4a. New table: `project_scripts`

Holds the script content attached to a project. One active script per project at a time.
A project with no row in this table is in the existing "no script" state — no behaviour change.

```sql
CREATE TABLE "project_scripts" (
  "id"                serial PRIMARY KEY,
  "project_id"        integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  "organization_id"   integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  "created_by_user_id" integer NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  "title"             varchar(255),                    -- optional display label
  "body"              text NOT NULL,                   -- raw script text (Markdown supported)
  "version"           integer NOT NULL DEFAULT 1,      -- incremented on each edit
  "created_at"        timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at"        timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "project_scripts_project_id_unique"
  ON "project_scripts" ("project_id");              -- one active script per project

CREATE INDEX "project_scripts_org_idx"
  ON "project_scripts" ("organization_id");
```

**Why `version`:** Logged in `script_takes` so the teacher can see if a student's take was
recorded against an outdated version of the script after an edit.

### 4b. New table: `script_takes`

Tracks each student's recording attempt for a given project script. Links to `media_files`
once the recording has been uploaded.

```sql
CREATE TYPE "script_take_status" AS ENUM (
  'recording_open',   -- student has not yet submitted; can re-record
  'uploaded',         -- recording delivered, awaiting teacher review
  'superseded',       -- student submitted a newer take (old file kept for audit)
  'approved',         -- teacher reviewed and accepted
  'rejected'          -- teacher sent back for re-recording (returns to recording_open)
);

CREATE TABLE "script_takes" (
  "id"                    serial PRIMARY KEY,
  "project_id"            integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  "organization_id"       integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  "script_id"             integer NOT NULL REFERENCES project_scripts(id) ON DELETE CASCADE,
  "script_version"        integer NOT NULL,            -- snapshot of script.version at time of recording
  "student_account_id"    integer NOT NULL,            -- soft FK (no cascade) to student_accounts
  "take_number"           integer NOT NULL DEFAULT 1,  -- increments per student per project
  "status"                script_take_status NOT NULL DEFAULT 'recording_open',
  "media_file_id"         integer REFERENCES media_files(id) ON DELETE SET NULL,
  "teleprompter_settings" jsonb,                       -- { fontSize: "M", scrollSpeed: "medium" }
  "duration_seconds"      integer,                     -- recorded take length
  "submitted_at"          timestamp with time zone,
  "reviewed_at"           timestamp with time zone,
  "reviewed_by_user_id"   integer,
  "teacher_note"          text,                        -- optional feedback on rejection
  "created_at"            timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at"            timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "script_takes_project_idx" ON "script_takes" ("project_id");
CREATE INDEX "script_takes_student_idx" ON "script_takes" ("student_account_id");
CREATE INDEX "script_takes_org_idx"     ON "script_takes" ("organization_id");
```

### 4c. Changes to existing tables

**`media_files`** — no schema changes needed.  
Convention: set `media_role = 'teleprompter_take'` and `uploader_kind = 'student_account'`
on files uploaded via Producer Mode. The `uploaderStudentAccountId` and `submittedAt`
fields already exist and apply naturally. The `script_takes.media_file_id` FK provides the
link back to the take context.

**`projects`** — no schema changes needed.  
The existing `student_instructions` field (text) becomes the teacher's general brief shown
above the teleprompter. The script body lives in `project_scripts`.

**`recording_session_status` enum** — not used. Browser-recorded takes bypass the existing
hardware recording session flow; `recording_sessions` is for in-studio capture.

---

## 5. API Routes

All new routes follow the existing auth/permission conventions in `src/lib/auth.ts` and
`src/lib/permissions.ts`. Teacher routes require `requireAuth` + `requireOrganization`.
Student routes require the existing `requireStudentAuth` middleware.

### 5a. Teacher-facing routes

```
POST   /projects/:id/script
       Body: { title?: string, body: string }
       Creates or replaces the project's script. Increments version on update.
       Activity log: "script_attached" | "script_updated"
       Response: { script: ProjectScript }

GET    /projects/:id/script
       Returns current script or 404 if none attached.
       Response: { script: ProjectScript | null }

DELETE /projects/:id/script
       Removes the script. Any takes in 'recording_open' state are unaffected
       (the student sees a "script was removed" message on next open).
       Activity log: "script_removed"
       Response: 204

GET    /projects/:id/takes
       List all script takes for the project (all students).
       Sorted by student name, then take_number DESC.
       Response: { takes: ScriptTake[] }

PATCH  /projects/:id/takes/:takeId
       Body: { action: "approve" | "reject", teacherNote?: string }
       State machine: uploaded → approved | rejected → recording_open
       Activity log: "take_approved" | "take_rejected"
       Response: { take: ScriptTake }
```

### 5b. Student-facing routes (under /student)

```
GET    /student/projects/:projectId/script
       Returns the project's script if attached, or 404.
       Student must have access to the project (class/project membership check).
       Teleprompter settings from the student's last take (if any) are included
       so the UI can restore their preferred font size and scroll speed.
       Response: { script: ProjectScript, lastSettings: TeleprompterSettings | null }

POST   /student/projects/:projectId/takes
       Initiates a new take record for this student + project.
       Creates script_takes row with status='recording_open'.
       Returns a signed upload grant (same JWT mechanism as existing uploadGrant.ts)
       scoped to this specific take, valid 60 min.
       Response: { takeId: number, uploadGrant: string }

POST   /student/projects/:projectId/takes/:takeId/upload
       Multipart: { file: Blob, teleprompterSettings: JSON, durationSeconds: number }
       Validates uploadGrant (same verify() call as student-uploads.ts).
       Uploads recording to R2: offloadr/projects/:projectId/takes/:takeId_<filename>
       Inserts media_files row (uploader_kind='student_account', media_role='teleprompter_take').
       Updates script_takes: media_file_id, status='uploaded', submitted_at, duration_seconds,
         teleprompter_settings, script_version snapshot.
       Supersedes any prior uploaded take for this student+project (marks old row 'superseded').
       Fires sendUploadNotification() (existing function, no changes needed).
       Logs activity: "take_submitted".
       Response: { ok: true, takeId: number, fileId: number }
```

**No Quick Upload (code) variant for this feature.** Producer Mode requires student account
authentication — the identity of the recording student must be confirmed. The anonymous
Quick Upload code flow is retained for simpler file handoff but will not surface the
teleprompter or take-tracking features.

---

## 6. Permissions

| Action | Admin | Producer | Student (own project) | Student (other) |
|---|---|---|---|---|
| Attach/edit script | ✅ | ✅ | ❌ | ❌ |
| Delete script | ✅ | ✅ | ❌ | ❌ |
| Read script (teacher view) | ✅ | ✅ | ❌ | ❌ |
| Read script (student teleprompter) | — | — | ✅ | ❌ |
| Initiate/upload take | — | — | ✅ | ❌ |
| View own take status | — | — | ✅ | ❌ |
| View all takes for project | ✅ | ✅ | ❌ | ❌ |
| Approve/reject take | ✅ | ✅ | ❌ | ❌ |
| Re-open rejected take | ✅ | ✅ | ❌ | ❌ |

"Student (own project)" = student has a class/project membership row for this project.

---

## 7. Upload Lifecycle Impact

Producer Mode recording follows the same storage and notification pipeline as existing
student account uploads, with these additions:

```
Student taps "Send to Teacher"
  │
  ├── POST /student/projects/:projectId/takes          → creates script_takes row
  │     └── returns { takeId, uploadGrant }
  │
  ├── POST /student/projects/:projectId/takes/:takeId/upload   (multipart, same as student-uploads.ts)
  │     ├── Validate uploadGrant (uploadGrant.ts verify())
  │     ├── multer → /tmp/...webm or .mp4
  │     ├── getStorageDriver().upload(storageKey, stream, mime)
  │     │     storageKey: offloadr/projects/:id/takes/:takeId_<timestamp>_<studentName>.webm
  │     ├── INSERT media_files (uploader_kind='student_account', media_role='teleprompter_take')
  │     ├── UPDATE script_takes SET status='uploaded', media_file_id=...
  │     ├── Supersede prior uploaded take (if any)
  │     ├── logActivity(projectId, 'take_submitted', '...')
  │     └── void sendUploadNotification({ projectId, uploaderName, uploaderKind: 'student_account', files: [...] })
  │
  └── Teacher receives email: "New upload — [Project Name]" (same template, no changes)
        Teacher opens project → sees take in "Awaiting Review" state
```

**MediaRecorder output format:** Chrome/Safari produce `video/webm` (Chrome) or `video/mp4`
(Safari iOS). The API accepts both — `file_type` enum `'video'` covers both. The
`original_file_name` should include the correct extension (`.webm` or `.mp4`) derived from
the MIME type at recording time.

**File size estimates:** A 2-minute 720p WebM at typical MediaRecorder quality is ~20–40 MB.
Within Cloudflare R2's single-upload limit (5 GB). No chunked upload needed for MVP.
The existing `multer` config should confirm its `limits.fileSize` is set generously (≥200 MB
recommended for longer segments).

**R2 path convention:**
```
offloadr/projects/:projectId/takes/:takeId_:timestamp_:studentName.:ext
```
Example: `offloadr/projects/42/takes/7_1748123456789_Alice_Smith.webm`

**No processing pipeline change:** Producer Mode files land in `processing_status='uploaded'`
same as all other student files. They are eligible for future render-job processing (AI
first-cut, highlight reel) without any schema changes.

---

## 8. Frontend Pages / Components

These are the surfaces that need to be built — listed for roadmap awareness, not scoped for
this ticket:

| Surface | Route | Notes |
|---|---|---|
| Script editor modal | Teacher project detail | Reuse existing modal shell |
| Takes list (teacher) | Teacher project detail tab | Inline in Files tab or new "Takes" tab |
| Take status badge | Teacher file list row | Reuse existing badge components |
| Student project card | `/student/projects/:id` | Show "Producer Mode" entry when script exists |
| Teleprompter view | `/student/projects/:id/record` | Full-screen, landscape-optimised, tablet-first |
| Recording controls overlay | Inside teleprompter view | Timer, stop button, mic/camera indicators |
| Post-recording review | Inside teleprompter view | Preview, "Record Again", "Send to Teacher" |
| Upload progress screen | Inside teleprompter view | Progress bar + confirmation |

**Tablet-first design notes:**
- Minimum touch target: 44×44 pt (Apple HIG)
- Teleprompter text should default to 24px, top-to-bottom auto-scroll
- Camera preview should be PiP in corner (small, so script remains readable)
- Landscape orientation preferred for recording; portrait acceptable for script reading

---

## 9. Open Questions (to resolve before implementation)

1. **Script format:** Plain text only, or Markdown with basic formatting (bold, line breaks)?
   Markdown is more flexible for stage directions `[pause]` but adds a renderer dependency.

2. **Camera/mic permissions UX:** If the browser denies camera access, what is the fallback?
   (Audio-only take? Error state with instructions?) Needs a UX decision for each
   browser/OS combo (Safari iOS is strictest).

3. **Take limit per student:** Should a student be able to submit multiple takes (teacher
   chooses the best), or does each new submission supersede the last? Current spec: supersede.
   Change to multi-take would require relaxing the unique constraint in `script_takes`.

4. **Script versioning on update:** If the teacher updates the script after a student has
   started recording (status='recording_open'), should the student see the new version
   immediately? Current spec: yes (script is fetched fresh on each teleprompter open).

5. **Offline/interrupted recording:** MediaRecorder produces a valid partial blob if the
   browser crashes mid-recording. Should the student portal detect and recover a partial
   recording from localStorage? Out of scope for MVP.

6. **Access mode gate:** Should Producer Mode require `project.accessMode` to be
   `'student_accounts'` or `'both'`? Current spec: yes — Quick Upload codes do not get the
   teleprompter view.

---

## 10. Migration Checklist (when implementation begins)

- [ ] `drizzle-kit generate` for new `project_scripts` and `script_takes` tables
- [ ] Apply migration to production Neon DB before deploying
- [ ] Add `'teleprompter_take'` as a documented `media_role` convention (no enum — it's a varchar)
- [ ] Confirm `multer` `limits.fileSize` supports large video blobs (≥200 MB)
- [ ] Add `STUDENT_ACCOUNTS_ENABLED=true` gate check to new student take routes
- [ ] Add `script_take_status` enum to `0001_producer_mode.sql` migration file
- [ ] Update `sendUploadNotification` to include take context in email subject if desired
   (optional — existing template works as-is)
