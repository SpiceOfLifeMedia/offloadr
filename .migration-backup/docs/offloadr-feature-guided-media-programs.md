# Feature Spec: Guided Media Programs

**Status:** Roadmap — not started  
**Priority:** Post-pilot (after Producer Mode)  
**Scope:** Offloadr student portal + teacher dashboard

---

## 1. Overview

Guided Media Programs let teachers launch structured on-screen recording activities where
students are guided through a sequence of prompts, countdowns, and recorded answers —
entirely in the browser. At the end, Offloadr assembles the clips into a single finished
video and delivers it to the teacher.

This is a **template-driven student media workflow system**, not a teleprompter. The
distinction matters:

| | Producer Mode (teleprompter) | Guided Media Programs |
|---|---|---|
| Script | Teacher-written, student reads | Prompted questions, student answers |
| Clips | One recording per project | One recording per prompt, many per session |
| Assembly | None — single file upload | Auto-combined into one finished video |
| Access | Requires student account | Student account (MVP); share token (future) |
| Output | Raw take → teacher reviews | Finished video → student reviews first |

Programs are reusable templates. A teacher creates "Get To Know You" once and can assign
it to multiple classes or projects throughout the year.

---

## 2. Example Program: "Get To Know You"

```
Student opens program link
  │
  ├── Prompt 1: "What is your name?"
  │     ├── 5-second countdown
  │     ├── Recording starts (student answers on camera)
  │     └── Recording stops automatically (or student taps Stop)
  │
  ├── Prompt 2: "What are your hobbies?"
  │     ├── 5-second countdown
  │     ├── Recording starts
  │     └── Recording stops
  │
  ├── ... (all remaining prompts)
  │
  ├── Offloadr combines all clips into one video
  │
  ├── Student review screen
  │     ├── "Record Again" (re-do the whole program, or re-do one prompt)
  │     └── "Send to Teacher"
  │
  └── Teacher receives finished video
```

---

## 3. Built-in Program Templates

These ship as org-level templates available to all teachers. Teachers can also create
custom programs from scratch.

| Template | Prompts (example) |
|---|---|
| Get To Know You | Name, hobbies, favourite subject, one fun fact |
| Book Review | Title/author, summary, favourite part, rating and why |
| Science Reflection | What we did, what I noticed, what I learned, my question |
| News Report | Headline, who/what/where/when, why it matters |
| Excursion Recap | Where we went, the best moment, what surprised me, what I'd tell a friend |
| Oral Presentation | Topic intro, main point 1, main point 2, conclusion |
| Culture Interview | Cultural background, a tradition, a food, something you'd like others to know |
| Student Leadership Pitch | The problem, my idea, how it would work, why you should vote for me |
| Weekly PNTV Segment | Opening, local news story, school story, sign-off |
| Graduation Memory | A moment I'll remember, what I learned, my advice to next year's students |

Built-in templates are read-only (`is_system_template = true`). Teachers can duplicate
and customise them.

---

## 4. Personas & Goals

| Persona | Goal |
|---|---|
| **Teacher / Admin** | Select or create a program, assign it to a class or project, receive finished student videos without managing raw footage |
| **Student (account)** | Be guided through the activity without needing to know what to do next; re-record any answer before sending |

---

## 5. User Flow

### 5a. Teacher — Create & Assign a Program

```
Teacher dashboard → Programs tab
  ├── Browse built-in templates (read-only)
  ├── [+ New Program] → program editor
  │     ├── Program title (required)
  │     ├── Description (optional, shown to students)
  │     ├── Prompt list (drag-to-reorder)
  │     │     ├── Prompt text (required)
  │     │     ├── Countdown seconds (default: 5, range: 3–10)
  │     │     └── Max recording seconds (default: 60, 0 = unlimited)
  │     └── [Save Program]
  │
  └── [Assign to Project / Class]
        ├── Select project (or class — creates one session slot per class member)
        ├── Optional due date
        └── [Assign] → generates program_assignments row
              └── Students see "New Program" card in their portal
```

### 5b. Student — Complete a Program

```
Student portal → My Programs
  └── Program card: "Get To Know You — assigned by Ms Smith"
        └── [Start] or [Continue] (if in_progress session exists)

Guided Recording View
  ├── Header: program title, progress indicator ("2 of 5")
  ├── Prompt text: large, centred (e.g. "What are your hobbies?")
  ├── Camera preview: small PiP in corner
  │
  ├── State: GET_READY
  │     ├── Countdown timer (5…4…3…2…1)
  │     └── [Skip Countdown] button
  │
  ├── State: RECORDING
  │     ├── Red dot + elapsed timer (00:00)
  │     ├── [Stop Recording] button
  │     └── Auto-stop at max_recording_seconds (if set)
  │
  ├── State: CLIP_REVIEW
  │     ├── Inline playback of just-recorded clip
  │     ├── [Use This] → clip saved, advance to next prompt
  │     └── [Record Again] → discard clip, return to GET_READY for same prompt
  │
  ├── State: UPLOADING (background, per clip)
  │     └── Progress indicator in top bar ("Saving…" / "Saved ✓")
  │
  └── State: ALL_DONE → transitions to Session Review

Session Review
  ├── "All done! Here's your video:"
  ├── Final assembled video player (or "Preparing your video…" spinner)
  ├── [Record Again] → which prompt? (individual re-do) or [Start Over]
  └── [Send to Teacher]
        ├── Upload confirmation / progress
        ├── "Sent! 🎉" screen
        └── [Back to My Programs]
```

**Key UX rules:**
- The student never manually assembles or names files.
- Each clip is uploaded to R2 immediately after "Use This" — no waiting until the end.
- The final video is assembled server-side in the background while the student reviews.
- The student cannot send until the render is ready (or a timeout fallback applies — see §9).

---

## 6. Data Model

### 6a. New table: `media_programs`

A reusable program definition. Owned by an org. Built-in templates are seeded at the
system level (`is_system_template = true`) and are read-only; org-level programs can
be cloned from them.

```sql
CREATE TABLE "media_programs" (
  "id"                    serial PRIMARY KEY,
  "organization_id"       integer REFERENCES organizations(id) ON DELETE CASCADE,
                          -- NULL = system template (built-in, org-independent)
  "created_by_user_id"    integer REFERENCES users(id) ON DELETE SET NULL,
  "title"                 varchar(255) NOT NULL,
  "description"           text,
  "is_system_template"    boolean NOT NULL DEFAULT false,
  "cloned_from_id"        integer REFERENCES media_programs(id) ON DELETE SET NULL,
  "is_active"             boolean NOT NULL DEFAULT true,
  "created_at"            timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at"            timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "media_programs_org_idx" ON "media_programs" ("organization_id");
```

### 6b. New table: `media_program_prompts`

Ordered list of prompts within a program. Each prompt becomes one recorded clip per student.

```sql
CREATE TABLE "media_program_prompts" (
  "id"                    serial PRIMARY KEY,
  "program_id"            integer NOT NULL REFERENCES media_programs(id) ON DELETE CASCADE,
  "sequence_order"        integer NOT NULL,            -- 1-based; drives display + assembly order
  "prompt_text"           text NOT NULL,               -- e.g. "What is your name?"
  "countdown_seconds"     integer NOT NULL DEFAULT 5,  -- 3–10
  "max_recording_seconds" integer,                     -- NULL = unlimited
  "hint_text"             text,                        -- optional sub-text shown under prompt
  "created_at"            timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at"            timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "media_program_prompts_order_unique"
  ON "media_program_prompts" ("program_id", "sequence_order");
```

### 6c. New table: `program_assignments`

Links a program to a project (and optionally a class). Creates the slot that appears in
student portals. One assignment can cover all students in a class.

```sql
CREATE TABLE "program_assignments" (
  "id"                    serial PRIMARY KEY,
  "program_id"            integer NOT NULL REFERENCES media_programs(id) ON DELETE RESTRICT,
  "organization_id"       integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  "project_id"            integer REFERENCES projects(id) ON DELETE CASCADE,
  "class_id"              integer REFERENCES classes(id) ON DELETE SET NULL,
  "assigned_by_user_id"   integer NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  "due_at"                timestamp with time zone,
  "is_active"             boolean NOT NULL DEFAULT true,
  "created_at"            timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at"            timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "program_assignments_org_idx"     ON "program_assignments" ("organization_id");
CREATE INDEX "program_assignments_project_idx" ON "program_assignments" ("project_id");
CREATE INDEX "program_assignments_class_idx"   ON "program_assignments" ("class_id");
```

### 6d. New table: `program_sessions`

One row per student per assignment. Created when the student starts the program.
Tracks overall completion state and links to the final assembled video.

```sql
CREATE TYPE "program_session_status" AS ENUM (
  'in_progress',   -- student has started, not all clips recorded
  'review',        -- all clips recorded and uploaded; render pending or ready
  'sent',          -- student tapped "Send to Teacher"; teacher notified
  'abandoned'      -- session was never completed; can be restarted (new session row)
);

CREATE TABLE "program_sessions" (
  "id"                    serial PRIMARY KEY,
  "assignment_id"         integer NOT NULL REFERENCES program_assignments(id) ON DELETE CASCADE,
  "program_id"            integer NOT NULL REFERENCES media_programs(id) ON DELETE RESTRICT,
  "organization_id"       integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  "student_account_id"    integer NOT NULL,            -- soft FK to student_accounts
  "status"                program_session_status NOT NULL DEFAULT 'in_progress',
  "render_media_file_id"  integer REFERENCES media_files(id) ON DELETE SET NULL,
                          -- the assembled finished video; NULL until render completes
  "render_status"         varchar(50),                 -- 'pending'|'processing'|'ready'|'failed'
  "render_started_at"     timestamp with time zone,
  "render_completed_at"   timestamp with time zone,
  "sent_at"               timestamp with time zone,
  "created_at"            timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at"            timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "program_sessions_assignment_idx" ON "program_sessions" ("assignment_id");
CREATE INDEX "program_sessions_student_idx"    ON "program_sessions" ("student_account_id");
CREATE INDEX "program_sessions_org_idx"        ON "program_sessions" ("organization_id");
```

### 6e. New table: `program_session_clips`

One row per prompt per session. Tracks recording state and links to the raw clip file.
A student can re-record a prompt — each re-record increments `take_number`; only the
kept clip (status='uploaded') is assembled into the final video.

```sql
CREATE TYPE "program_clip_status" AS ENUM (
  'pending',     -- not yet recorded
  'recorded',    -- captured in browser, awaiting upload
  'uploading',   -- upload in progress
  'uploaded',    -- in R2, ready for render
  'failed'       -- upload failed; student must re-record
);

CREATE TABLE "program_session_clips" (
  "id"                    serial PRIMARY KEY,
  "session_id"            integer NOT NULL REFERENCES program_sessions(id) ON DELETE CASCADE,
  "prompt_id"             integer NOT NULL REFERENCES media_program_prompts(id) ON DELETE RESTRICT,
  "organization_id"       integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  "sequence_order"        integer NOT NULL,            -- copied from prompt at session start
  "status"                program_clip_status NOT NULL DEFAULT 'pending',
  "media_file_id"         integer REFERENCES media_files(id) ON DELETE SET NULL,
  "take_number"           integer NOT NULL DEFAULT 1,  -- incremented each time student re-records
  "duration_seconds"      integer,
  "mime_type"             varchar(100),                -- video/webm | video/mp4 (set at upload)
  "created_at"            timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at"            timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "program_session_clips_unique"
  ON "program_session_clips" ("session_id", "prompt_id");
  -- one active clip row per prompt per session; take_number tracks re-records

CREATE INDEX "program_session_clips_session_idx" ON "program_session_clips" ("session_id");
```

### 6f. Changes to existing tables

**`media_files`** — no schema changes needed.  
New `media_role` conventions (varchar — no enum change):
- `'program_clip'` — individual per-prompt clip uploaded during a session  
- `'program_render'` — the assembled final video  

**`projects`** — no schema changes needed.  
A project receives the finished render via `program_assignments.project_id`, delivered into
the project's file list via the normal upload notification pipeline.

**`render_jobs`** — if the existing `render_jobs` table is used for background work, a new
`job_type = 'program_concat'` row can track the FFmpeg assembly. If not yet used, the
render state lives on `program_sessions.render_status` alone for MVP.

---

## 7. API Routes

All routes follow auth/permission conventions in `src/lib/auth.ts`. Teacher routes require
`requireAuth` + `requireOrganization`. Student routes require `requireStudentAuth`.

### 7a. Program management (teacher)

```
GET    /programs
       List all programs for the org (own + system templates).
       Response: { programs: MediaProgram[] }

POST   /programs
       Body: { title, description?, prompts: [{ promptText, countdownSeconds?, maxRecordingSeconds?, hintText? }] }
       Creates a new org-level program.
       Response: { program: MediaProgram }

GET    /programs/:programId
       Response: { program: MediaProgram & { prompts: MediaProgramPrompt[] } }

PATCH  /programs/:programId
       Body: { title?, description?, isActive? }
       Response: { program: MediaProgram }

DELETE /programs/:programId
       Blocked if active assignments exist (409 Conflict with explanation).
       Response: 204

POST   /programs/:programId/clone
       Duplicates a program (including prompts) into the org.
       Required for cloning system templates.
       Response: { program: MediaProgram }

POST   /programs/:programId/prompts
       Body: { promptText, sequenceOrder, countdownSeconds?, maxRecordingSeconds?, hintText? }
       Response: { prompt: MediaProgramPrompt }

PATCH  /programs/:programId/prompts/:promptId
       Body: { promptText?, sequenceOrder?, countdownSeconds?, maxRecordingSeconds?, hintText? }
       Reordering: updates sequence_order; caller must provide valid non-conflicting order.
       Response: { prompt: MediaProgramPrompt }

DELETE /programs/:programId/prompts/:promptId
       Blocked if sessions exist using this prompt (409 Conflict).
       Response: 204

PUT    /programs/:programId/prompts/reorder
       Body: { order: [{ promptId, sequenceOrder }] }
       Bulk-updates sequence_order for all prompts in one transaction.
       Response: { prompts: MediaProgramPrompt[] }
```

### 7b. Assignment management (teacher)

```
POST   /programs/:programId/assignments
       Body: { projectId?, classId?, dueAt? }
       Creates assignment. If classId provided, creates program_session slots for
       all active class members (optional optimisation — sessions can also be created
       on first student access).
       Activity log: "program_assigned"
       Response: { assignment: ProgramAssignment }

GET    /programs/assignments
       List all assignments for the org.
       Response: { assignments: ProgramAssignment[] }

GET    /programs/assignments/:assignmentId
       Includes session summary: { total, inProgress, sent }.
       Response: { assignment: ProgramAssignment, sessionSummary: SessionSummary }

PATCH  /programs/assignments/:assignmentId
       Body: { dueAt?, isActive? }
       Response: { assignment: ProgramAssignment }

GET    /programs/assignments/:assignmentId/sessions
       All student sessions for this assignment.
       Response: { sessions: ProgramSession[] }

GET    /programs/sessions/:sessionId
       Full session detail: clips, render status, student info.
       Response: { session: ProgramSession & { clips: ProgramSessionClip[] } }
```

### 7c. Student recording routes

```
GET    /student/programs
       All active assignments for the logged-in student (via class membership or direct
       project link). Returns program title, prompt count, due date, and any in-progress
       session for this student.
       Response: { assignments: AssignmentWithSessionState[] }

GET    /student/programs/assignments/:assignmentId
       Full program detail: title, description, ordered prompts (text + countdown + max duration).
       Does NOT return other students' data.
       Response: { program: MediaProgram, prompts: MediaProgramPrompt[], session: ProgramSession | null }

POST   /student/programs/assignments/:assignmentId/sessions
       Start a new session (or resume in_progress session — returns existing row if found).
       Creates program_session_clips rows for all prompts (status='pending').
       Response: { sessionId: number, clipIds: { promptId: number, clipId: number }[] }

POST   /student/programs/sessions/:sessionId/clips/:clipId/upload
       Multipart: { file: Blob, durationSeconds: number, mimeType: string, takeNumber: number }
       Validates student owns this session.
       Uploads to R2: offloadr/programs/:sessionId/clips/:clipId_:timestamp.:ext
       Inserts or updates media_files row (media_role='program_clip').
       Updates program_session_clips: status='uploaded', media_file_id, duration_seconds, mime_type.
       If a prior media_file existed for this clip, mark it for deletion (or soft-delete).
       Response: { ok: true, clipId: number, fileId: number }

POST   /student/programs/sessions/:sessionId/submit
       All clips must be status='uploaded' — returns 422 with missing clip list if not.
       Sets program_sessions.status = 'review'.
       Enqueues render job (see §8).
       Response: { ok: true, renderStatus: 'pending' }

GET    /student/programs/sessions/:sessionId/render
       Poll endpoint — returns current render status and signed playback URL if ready.
       Response: { renderStatus: 'pending'|'processing'|'ready'|'failed', playbackUrl?: string }

POST   /student/programs/sessions/:sessionId/send
       Requires render_status = 'ready' (or 'failed' with fallback — see §9).
       Sets program_sessions.status = 'sent', sent_at = now().
       Fires sendUploadNotification() with the render file (or individual clips on fallback).
       Activity log: "program_session_sent".
       Response: { ok: true }
```

---

## 8. Recording Flow (Client-Side)

```
1. Student opens assignment → GET /student/programs/assignments/:id
   → receives ordered prompts with countdown + max duration settings

2. Student taps [Start]
   → POST /student/programs/assignments/:id/sessions
   → receives { sessionId, clipIds[] }

3. For each prompt (state machine in the browser):

   GET_READY
   ├── Display prompt text
   ├── Run countdown (countdown_seconds from prompt config)
   └── → RECORDING

   RECORDING
   ├── navigator.mediaDevices.getUserMedia({ video: true, audio: true })
   ├── MediaRecorder starts (prefer video/webm;codecs=vp8,opus; fallback video/mp4)
   ├── Display elapsed timer
   ├── Auto-stop at max_recording_seconds (if set)
   └── Student taps [Stop] → MediaRecorder.stop() → CLIP_REVIEW

   CLIP_REVIEW
   ├── Show Blob preview via URL.createObjectURL()
   ├── [Use This] → UPLOADING + advance session cursor
   └── [Record Again] → discard blob, increment take_number in local state → GET_READY

   UPLOADING (background, non-blocking)
   ├── POST /student/programs/sessions/:sessionId/clips/:clipId/upload
   ├── Show "Saving…" in progress bar
   ├── On success → clip row = 'uploaded'; advance to next prompt
   └── On failure → UPLOAD_FAILED state (see §9)

4. After final prompt → POST /student/programs/sessions/:sessionId/submit
   → server enqueues render job

5. Browser polls GET /student/programs/sessions/:sessionId/render every 5s
   → when ready, plays assembled video in review screen

6. Student taps [Send to Teacher]
   → POST /student/programs/sessions/:sessionId/send
```

**Browser MediaRecorder notes:**
- Chrome: `video/webm;codecs=vp8,opus` — reliable, good quality
- Safari iOS 14.3+: `video/mp4` — supported but bitrate control limited
- Check `MediaRecorder.isTypeSupported()` at session start; pick the best available type
- Store selected mimeType in local state; send it with each clip upload so the server
  knows the container format for FFmpeg

---

## 9. Clip Storage

### R2 path convention

```
offloadr/programs/:sessionId/clips/:clipId_:timestamp_:studentSlug.:ext
```

Example:
```
offloadr/programs/12/clips/34_1748200000000_alice-smith.webm
offloadr/programs/12/clips/35_1748200012000_alice-smith.webm
```

- Each clip goes to R2 immediately on "Use This" — upload is not deferred to submission.
- Re-recorded clips get a new timestamp in the key; the old R2 object is left for 24h
  then swept by a cleanup job (or immediately deleted — TBD).
- `media_files` rows use `media_role='program_clip'`, `uploader_kind='student_account'`.

### Render output path

```
offloadr/programs/:sessionId/renders/:sessionId_:timestamp_final.:ext
```

Example:
```
offloadr/programs/12/renders/12_1748200060000_final.mp4
```

The render is stored as `media_role='program_render'`. If delivered to a project, a
corresponding project-level `media_files` row is also created so it appears in the
teacher's project file list.

---

## 10. Render / Stitching Approach

### MVP: Server-side FFmpeg concat

The recommended MVP approach is server-side concatenation using FFmpeg, triggered after
the student taps submit.

```
Student taps [Submit] (all clips uploaded)
  │
  └── POST /student/programs/sessions/:sessionId/submit
        ├── Sets render_status = 'pending'
        └── Enqueues render_job { type: 'program_concat', sessionId }

Render worker (async, same process or separate worker in MVP)
  ├── Fetch session + clip metadata from DB
  ├── Download each clip from R2 in sequence_order
  ├── Write concat list file:
  │     file '/tmp/clip_34.webm'
  │     file '/tmp/clip_35.webm'
  │     ...
  ├── ffmpeg -f concat -safe 0 -i concat.txt -c:v libx264 -c:a aac output.mp4
  ├── Upload output.mp4 to R2 (render path)
  ├── INSERT media_files (media_role='program_render')
  ├── UPDATE program_sessions: render_status='ready', render_media_file_id, render_completed_at
  └── Return signed URL for student playback
```

**Format considerations:**
- All clips must be the same codec for concat to work cleanly. Since Safari produces
  MP4 and Chrome produces WebM, the worker must transcode to a common format (MP4/H.264)
  unconditionally. This adds ~10–30s processing time for a 5-clip "Get To Know You".
- For MVP, all clips are downloaded from R2 to `/tmp`, processed, and the output
  re-uploaded. This is acceptable for sessions of up to ~10 clips × 60s each.

**Render time expectations (rough):**
| Session | Clips | Total duration | Expected render time |
|---|---|---|---|
| Get To Know You | 4 | ~2 min | 15–25s |
| News Report | 5 | ~3 min | 20–35s |
| Oral Presentation | 5 | ~5 min | 35–60s |

**Student experience during render:**
- "Preparing your video…" spinner with progress estimate
- Poll every 5s via GET render endpoint
- If render takes >90s, show "Still working on it…" message
- If render fails, fallback applies (see §11)

### Future: Client-side pre-stitch (enhancement, not MVP)

Chrome supports `MediaRecorder` with `video/webm` and the blobs can be concatenated by
appending ArrayBuffers before upload. This would eliminate server render time for
Chrome-only sessions. Not pursued in MVP due to Safari incompatibility and complexity.

---

## 11. Failure Handling

| Failure | Detection | Recovery |
|---|---|---|
| Camera/mic permission denied | `getUserMedia()` throws `NotAllowedError` | Full-screen error state with OS-level instructions; cannot proceed without camera |
| Camera unavailable (in use) | `getUserMedia()` throws `NotReadableError` | Error state: "Camera is in use by another app" |
| Clip upload fails (network) | Fetch error or non-2xx response | `UPLOAD_FAILED` state per clip; [Retry] button; student can also re-record to get a fresh blob |
| Browser crash mid-session | Session row stays `in_progress`; clips uploaded before crash have `status='uploaded'` | On re-open, server returns existing session; already-uploaded clips shown as complete; student re-records only missing prompts |
| All clips uploaded, render fails | `render_status='failed'` | **Fallback**: student can still send; `POST /send` detects failed render and delivers individual clips to the project instead of the assembled video; teacher receives email noting "video could not be assembled" |
| Render timeout (>3 min) | Worker sets `render_status='failed'` | Same fallback as render failure |
| Student session expires (long gap) | JWT expiry on student auth | Student re-authenticates; session row is resumed (not lost) |
| Clip R2 object missing at render time | Worker gets 404 on download | Worker marks that clip failed, continues with remaining clips (partial render), logs warning; teacher notified of partial assembly |

**No data loss rule:** a student's recorded clip is committed to R2 and the database
before the browser moves to the next prompt. If the session is interrupted at any point,
no already-completed work is lost.

---

## 12. Permissions

| Action | Admin | Producer / Teacher | Student (own session) | Student (other) |
|---|---|---|---|---|
| Create program template | ✅ | ✅ | ❌ | ❌ |
| Edit own program | ✅ | ✅ | ❌ | ❌ |
| Clone system template | ✅ | ✅ | ❌ | ❌ |
| Delete program | ✅ | ✅ (own) | ❌ | ❌ |
| Assign program to project | ✅ | ✅ | ❌ | ❌ |
| View all sessions for assignment | ✅ | ✅ | ❌ | ❌ |
| View individual session + clips | ✅ | ✅ | ✅ | ❌ |
| Start / resume session | — | — | ✅ | ❌ |
| Upload clip | — | — | ✅ | ❌ |
| Submit session | — | — | ✅ | ❌ |
| Send finished video | — | — | ✅ | ❌ |
| Download render (teacher) | ✅ | ✅ | ❌ | ❌ |
| Download individual clips | ✅ | ✅ | ❌ | ❌ |

**Notes:**
- "Own session" = the `program_sessions.student_account_id` matches the authenticated student.
- Teachers cannot record on behalf of a student. A session only progresses through student-authenticated routes.
- Admin can view and manage all sessions across the org. Producer/Teacher can only see
  sessions for projects/classes they have access to (enforced by existing project membership
  checks in `src/lib/permissions.ts`).

---

## 13. How This Fits Into the Current Upload / Send-to-Teacher Workflow

Guided Media Programs deliver their final output **through the existing upload and
notification pipeline** — no new notification system is required.

```
Student taps [Send to Teacher]
  │
  └── POST /student/programs/sessions/:sessionId/send
        ├── Retrieves render_media_file_id from program_sessions
        ├── Links render file to program_assignments.project_id:
        │     creates or updates project-level media_files reference
        │
        └── Calls sendUploadNotification({
                projectId:     assignment.projectId,
                uploaderName:  student.displayName,
                uploaderKind:  'student_account',
                files: [{
                  fileName: 'Get To Know You — Alice Smith.mp4',
                  fileSize: renderFile.fileSizeBytes,
                  mediaRole: 'program_render'
                }]
              })

Teacher receives email: "New upload — [Project Name]"
  └── Same email template, no changes needed
        Body includes: "Alice Smith submitted a Guided Media Program: Get To Know You"

Teacher opens project → file list shows assembled video
  └── Clicks to download or preview (same media_files viewer)
```

**For the render-failure fallback:**
```
POST /student/programs/sessions/:sessionId/send (render_status = 'failed')
  └── Calls sendUploadNotification() with each clip as a separate file entry
        Subject: "New upload — [Project Name] (video could not be assembled)"
```

**Relationship to existing features:**
- Guided Programs do not conflict with Producer Mode (teleprompter). A project can have
  a script take (Producer Mode) and also receive a program render — they are distinct
  media_files with different `media_role` values.
- The `recording_sessions` table (in-studio hardware flow) is unaffected.
- Quick Upload codes are not used — Guided Programs require student account authentication.
- `student_accounts_enabled` feature flag must be true for the org for programs to be
  accessible.

---

## 14. Frontend Pages / Components

| Surface | Route | Notes |
|---|---|---|
| Programs library | `/teacher/programs` | Grid of org programs + system templates; [+ New] |
| Program editor | `/teacher/programs/new` and `/teacher/programs/:id/edit` | Prompt drag-list, per-prompt settings |
| Assignment modal | Inside project / class view | Dropdown to select program; due date picker |
| Assignment sessions list | `/teacher/programs/assignments/:id` | Per-student row: status, sent date, [View] |
| Session detail (teacher) | `/teacher/programs/sessions/:id` | Clips list + render video + student info |
| Student programs home | `/student/programs` | Cards for each active assignment |
| Guided recording view | `/student/programs/:assignmentId/record` | Full-screen; prompt, countdown, camera PiP |
| Clip review | Inline in recording view | Per-prompt playback; Use This / Record Again |
| Session review | `/student/programs/:assignmentId/review` | Final video player; Send / Re-do |
| Render polling screen | Inline in session review | Spinner + "Preparing your video…" |

**Design notes:**
- Guided recording view must work on tablet in portrait and landscape.
- Prompt text: minimum 28px on tablet, high-contrast on dark background.
- Progress indicator ("2 of 5 prompts") must be visible during recording without
  distracting from the answer.
- Camera preview PiP: 120×90 px minimum, corner-anchored, tap to hide.
- All tap targets ≥ 44×44 pt (Apple HIG).

---

## 15. Open Questions (resolve before implementation)

1. **Render worker architecture:** Does the render job run in-process (setTimeout + async)
   or as a separate worker process? In-process is simpler for MVP but blocks if the server
   is under load. A queue (BullMQ or similar) is cleaner for production.

2. **Mixed format handling:** If some clips are WebM (Chrome) and others are MP4 (Safari),
   FFmpeg must transcode all to a common format. Should we normalise at upload time (lighter
   server load spread across clips) or at render time (single processing pass)?

3. **Partial re-do:** Can a student re-record a single prompt after all others are uploaded,
   or must they start the whole program over? Current spec supports per-prompt re-do at any
   point before submit. After submit (status='review' or later), teacher must re-open.

4. **Teacher re-open:** If the teacher rejects a sent program, how does the student re-do?
   Options: (a) whole session restart (new session row), (b) re-do individual clips.
   Current spec defers this question — MVP does not include teacher rejection of programs.

5. **Program versioning:** If a teacher edits a program's prompts after it has been
   assigned, do in-progress sessions see the new prompts? Current spec: prompts are
   snapshotted at session start (sequence_order copied to clips table). Editing a prompt
   after sessions exist is blocked via 409 for active assignments.

6. **Clip size limits:** The existing multer `limits.fileSize` applies. A 60-second 720p
   WebM is ~30–60 MB. With 10 clips, that is ~300–600 MB per session. R2 cost is negligible
   but the API's multer limit must be confirmed (≥200 MB per file recommended).

7. **Student-facing program link (no login):** The current spec requires student account
   login. A future version could use a share token (similar to Quick Upload codes) to allow
   anonymous or class-code access. Out of scope for MVP.

8. **Offline / interrupted mid-clip recording:** If the browser crashes during a recording
   (before the student taps "Stop"), the partial blob is lost. No recovery mechanism for
   the in-progress clip is planned for MVP — the student simply re-records that prompt on
   resume.

---

## 16. Migration Checklist (when implementation begins)

- [ ] `drizzle-kit generate` for `media_programs`, `media_program_prompts`, `program_assignments`, `program_sessions`, `program_session_clips`
- [ ] Seed system template rows for all 10 built-in programs (`is_system_template = true`, `organization_id = NULL`)
- [ ] Add `program_session_status` and `program_clip_status` enums to migration SQL
- [ ] Add `media_role='program_clip'` and `media_role='program_render'` to documentation / code comments (no enum change needed)
- [ ] Confirm multer `limits.fileSize` supports ≥200 MB per file
- [ ] Confirm FFmpeg is available in the API deployment environment (Railway nixpacks)
- [ ] Gate all program routes behind `STUDENT_ACCOUNTS_ENABLED=true` env flag
- [ ] Add `program_concat` job type to render_jobs table (or confirm in-process approach)
- [ ] Update `sendUploadNotification` to include program context in email body (optional — existing template works as-is)
- [ ] Add `student_programs` link to student portal nav
