# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CoachRICE Coaching Education Toolkit — a web app for the Doerr Institute for New Leaders at Rice University. Supports ICF ACC credentialing prep for CoachRICE participants via four AI-powered tools.

## Development Commands

```bash
npm install          # Install dependencies (run once after cloning)
npm run dev          # Start local dev server at http://localhost:5173
npm run build        # Production build (outputs to /dist)
npm run preview      # Preview production build locally
npm run lint         # Run ESLint
```

## Stack

| Layer | Tool |
|---|---|
| Frontend | React 18 + Vite |
| Routing | React Router v6 |
| Backend / Auth / DB | Supabase (PostgreSQL + Row Level Security) |
| AI | Anthropic Claude API (all four tools) |
| Audio transcription | OpenAI Whisper API (Tool 3 only) |
| Hosting | Vercel |

## Page Routes

| Route | Component | Who sees it |
|---|---|---|
| `/login` | `src/pages/Login.jsx` | Everyone (unauthenticated entry point) |
| `/dashboard` | `src/pages/CoachDashboard.jsx` | Coaches only |
| `/admin` | `src/pages/AdminPanel.jsx` | Admins only |

The root `/` redirects to `/login`. Route guards enforcing auth and role checks will be added in Phase 3.

## Architecture

**Frontend** (`src/`) handles all UI — pages, tool interfaces, dashboards.

**Auth and data** live entirely in Supabase. Row Level Security (RLS) is enforced at the database level:
- `coach` role: can only read/write their own rows
- `admin` role: full read access across all users, cohorts, and sessions

**No backend server** — the React app calls Supabase and the AI APIs directly from the browser (via environment variables). Never expose secret API keys in client-side code; Supabase anon key is safe for client use.

**Critical Supabase auth rule:** Never call `supabase.from()` or any other Supabase data method inside an `onAuthStateChange` callback. Doing so causes a deadlock — `signInWithPassword` waits for all auth listeners to finish before resolving, but the listener is waiting on another Supabase call. In `AuthContext`, `onAuthStateChange` only calls `setUser()`. Profile fetching happens in a separate `useEffect` that watches the `user` state.

## Core Data Model

Supabase tables (as of May 2026):

**User & org:**
- **`users`** — extends Supabase Auth; includes `role` (`coach`/`admin`), `cohort_id`, `mentor_coach_id`
- **`cohorts`** — program cohort records; coaches are assigned by admins
- **`mentor_coaches`** — reference data only (no system login in v1.0)

**Tool results:**
- **`sessions`** — one row per tool submission; `tool` field is `exam`, `transcript_scorer`, `transcriber`, or `coaching_bot`; `score_category` is `knowledge`, `application`, or `none`
- **`competency_scores`** — one row per ICF competency per session; `proficiency_level` is `Developing`, `Approaching`, `Meeting`, or `Exceeding`; `proficiency_numeric` is 1–4
- **`exam_attempts`** — one row per exam submission; stores overall_score, total_questions, correct_answers
- **`exam_answers`** — per-question detail for each exam attempt
- **`transcript_analyses`** — one row per transcript scored; stores full analysis JSON and competency_scores JSONB
- **`chat_sessions`** — one row per coaching bot session
- **`chat_messages`** — messages within a chat session
- **`chat_analyses`** — feedback/analysis after a chat session
- **`internal_assessments`** — ✓ NEW May 2026; stores assessor evaluations (2021 or 2025); fields: `assessor_type`, `transcript_filename`, `assessment_data` (full JSON), `competency_scores` (JSONB)

The `competency_scores` table is the source of truth for all charts and analytics. It is not populated for `transcriber` sessions.

## The Four Main Tools

| # | Tool | Route | Status |
|---|---|---|---|
| 1 | ACC Practice Exam | `/tools/exam` | ✓ Working |
| 2 | Transcript Scorer | `/tools/transcript` | ✓ Working |
| 3 | Audio Transcriber | `/tools/audio` | ✓ Working (admin only for now; Deepgram) |
| 4 | Coaching Bot | `/tools/ai-client` | ✓ Working |

All tools that produce scores must parse Claude's response and write rows to `competency_scores`. Prompt engineering must produce consistently structured output for this to work reliably.

## Internal Assessor Tools (NEW)

Two AI-powered tools for coaches to evaluate teaching transcripts against ICF standards:

| Tool | Route | Assessor Type | Output |
|---|---|---|---|
| Internal Assessor (2025) | `/tools/assessor2025` | AI (Claude Opus 4.7) | Full JSON with 20 behavioral statements, competency averages, pass/fail result |
| Internal Assessor (2021) | `/tools/assessor` | AI (Claude Opus 4.7) | Full JSON with behavioral statements, competency averages, pass/fail result |

**Assessor features:**
- Upload PDF or .txt coaching transcript
- AI evaluates against ICF ACC BARS standards (nov 2025 or March 2024)
- Generates full assessment with evidence citations, competency scores, strengths, suggestions
- Can download as PDF (print-to-PDF via browser print dialog)
- Can save to History for later viewing
- Saved assessments store full JSON + competency breakdown

**Scoring Gate (IMPORTANT):**
- Every ethical practice qualifier must be marked "Observed" to pass: two for the 2021 version (ICF Code of Ethics alignment, coach role alignment) and three for the 2025 version (adds "uses key coaching skills")
- If any qualifier = "Not Observed", result is automatically "Below Passing Standard"
- This is a hard requirement gate — qualifiers override numerical score ≥ 3.4

## Scoring Framework

Proficiency levels used everywhere: **Developing (1) → Approaching (2) → Meeting (3) → Exceeding (4)**

Knowledge scores (exam) and Application scores (transcript scorer + coaching bot) are always displayed separately — never averaged or combined.

The 8 ICF Core Competencies tracked per session:
1. Demonstrates Ethical Practice
2. Embodies a Coaching Mindset
3. Establishes and Maintains Agreements
4. Cultivates Trust and Safety
5. Maintains Presence
6. Listens Actively
7. Evokes Awareness
8. Facilitates Client Growth

## User Onboarding Flow

Coaches **cannot self-register**. An admin creates their account via the admin panel → Supabase sends an email invite → coach sets password → gains immediate access.

The Agreements/Terms screen (`/agreements`) is turned off for now: `Login.jsx` and `SetPassword.jsx` send users straight to the dashboard. The page, the route, and the `agreements_accepted` / `agreements_accepted_at` columns remain, so past acceptances stay saved and the screen can be turned back on by restoring the redirect.

## Flagging Rule

A coach is auto-flagged when any single competency scores `Developing` in **two or more consecutive scored sessions**. Admins see flags as badges in the user list and in a dedicated Flags tab.

## Environment Variables

All secrets go in `.env.local` (never committed). Keys needed:
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_ANTHROPIC_API_KEY=
VITE_OPENAI_API_KEY=
```

## API Endpoints

Vercel serverless functions in `/api/`:

| Endpoint | Methods | Purpose |
|---|---|---|
| `exam-history` | GET, POST, DELETE | Store and retrieve exam attempts |
| `transcript-history` | GET, POST, DELETE | Store and retrieve transcript analyses |
| `chat-history` | GET, POST, DELETE | Store and retrieve chat sessions |
| `internal-assessments` | GET, POST, DELETE | Store and retrieve internal assessor evaluations |
| `invite-user`, `delete-user`, `update-user`, `resend-invite`, `reset-password` | Various | User management |

All endpoints enforce RLS: coaches see only their own data, admins see all.

## History Pages

**User-facing History** (`/pages/History.jsx`):
- Exams (with scoring breakdown)
- Transcript Analyses (with competency details)
- Chat Sessions (messages + feedback)
- Transcripts uploaded to audio transcriber

**Admin History / Data** (`/admin/history`, `src/pages/AdminHistory.jsx`), full admins only, three tabs:
- **By person**: one list of every user account plus every student access code (search and type filter). Student code → its transcript evaluations (same cards as before, from `guest_analyses`). Mentor coach → counts only (observations run, saved in progress). Admin (tools or full) → table of what is saved by tool and times run. Participant (`coach`) → exam, transcript and chat history as before. The summary comes from `POST /api/user-actions?action=history-summary` (admin accounts only; counts, never text).
- **Competency by access code** (`src/components/CompetencyByCode.jsx`, replaces the old Analytics page): each behavior the Transcript Reviewer marks Observed earns one point for its competency (Competency 1 uses its 3 qualifiers). Bars show points earned out of possible as a percent, per student code and for all codes combined, so competencies with different numbers of behaviors compare fairly. Competency 2 is not scored by the Reviewer, so it is not shown.
- **Delete data**: the permanent-delete panel (`DataPurgePanel`).
The old "By Tool" and "Internal Assessments" views and the `/api/admin-analytics` endpoint were removed. `/admin/analytics` redirects to `/admin/history`.

## Recent Work (May 2026)

**Completed:**
- ✓ Both assessor tools (2021 & 2025) functional and downloadable
- ✓ History pages show past exam, transcript, and chat results
- ✓ Admin can view user-specific history and tool-wide analytics
- ✓ Added auto-save for internal assessments (no manual save button needed)
- ✓ Internal assessments stored in DB with full JSON + competency scores
- ✓ Admin panel displays full assessment reports identical to assessor tools
- ✓ Download internal assessments as PDF (matching assessor output)
- ✓ Moved internal assessments to separate admin tab (not in user history)
- ✓ Admin user table with sorting, role management, email customization
- ✓ Last Accessed timestamps tracking user login activity
- ✓ "Added" column shows when users were invited to the system
- ✓ Simplified account status tracking to use created_at column
- ✓ **NEW:** Bulk analyzer for Internal Assessor (2021) — upload multiple files, run all sequentially, view/download PDFs per result

**Bulk Analyzer Features:**
- Toggle between Single and Bulk mode in assessor input stage
- Multi-file queue with add/remove capability
- Sequential processing with progress bar and real-time status updates
- Results gallery displaying all assessments with scores and actions
- Individual View Report and Download PDF buttons per result
- Auto-save of all results to internal_assessments table
- Error handling with per-file error messages

**May 2026 Updates (Phase 2 Polish):**
- ✓ Professional PDF export using print-to-PDF (browser print dialog)
- ✓ Fixed ethical practice scoring: qualifiers now gate pass/fail regardless of numerical score
- ✓ Excel export for assessment history with dynamic competency calculations
- ✓ Agreement/Terms acceptance flow for new users
- ✓ Improved PDF styling with boxes, visual hierarchy, proper text wrapping
- ✓ Download PDF button moved to top of expanded assessments in history
- ✓ Ethical practice rationale notes display in history view (matching direct report view)

**Next Phase:**
- Apply bulk analyzer to Assessor2025.jsx (2025 BARS guide)
- Exam results viewing for participants & admins
- Real-time notifications / activity feed
- Admin dashboard analytics

## Deployment Notes

- **Vercel** hosts the React app + API functions
- **Supabase** hosts PostgreSQL database + Auth
- API keys in `.env.local` (dev) and Vercel env vars (prod)
- Build: `npm run build` → outputs to `/dist`
- All RLS policies in Supabase enforce data isolation at the DB layer

## Key File Locations

**Pages (routes & UI):**
- `src/pages/Login.jsx` — login form
- `src/pages/CoachDashboard.jsx` — coach home (activity feed)
- `src/pages/History.jsx` — coach's past results (exams, transcripts, chats, internal assessments)
- `src/pages/AdminPanel.jsx` — `/admin` (prop `section="users"`: Users and Access Codes tabs) and `/admin/config` (`section="config"`: one tab per tool, Tool Configuration)
- `src/pages/AdminHistory.jsx` — History / Data (see Admin History / Data above)
- `src/pages/tools/Exam.jsx` — practice exam tool
- `src/pages/tools/TranscriptScorer.jsx` — transcript scoring tool
- `src/pages/tools/AIClient.jsx` — coaching bot
- `src/pages/tools/InternalAssessor.jsx` — combined internal assessor (2021 + 2025), route `/tools/assessor`, admin only; logic in `src/lib/assessor/`
- `src/pages/tools/AudioToTranscript.jsx` — audio transcriber (Deepgram), route `/tools/audio`, admin only

**Components:**
- `src/components/Layout.jsx` — page wrapper with nav
- `src/components/LoadingBar.jsx` — loading indicator

**Context & Auth:**
- `src/context/AuthContext.jsx` — user auth state management

**Utilities:**
- `src/lib/supabase.js` — Supabase client init

**API / Backend:**
- `api/*.js` — Vercel serverless functions
- `migrations/*.sql` — DB schema

**Config:**
- `.env.local` — dev secrets (never commit)
- `CLAUDE.md` — this file

## Build Phases (reference)

Phase 3 = Auth + User Management | Phase 4 = DB setup | Phases 5–8 = individual tools | Phase 9 = Coach Dashboard | Phase 10 = Admin Dashboard | Phase 11 = Polish/branding

## Session Observation Form Mentor Coaching (NEW)

- Tool at `/tools/session-observation` for `mentor`, `admin_tools`, and `admin` accounts (`src/pages/tools/SessionObservation.jsx`; logic in `src/lib/sof/`). Mentor coaches add a transcript (.txt, .pdf, or pasted). An optional recording can be added to play along with the transcript (plays only in the browser, never uploaded or stored; clicking a timestamp seeks to it). A recording can NOT replace the transcript: Deepgram transcription is not part of this tool. The coach names the speakers (coach and client), and the AI (`observation-evidence` tool in `server/aiTools.js`, uses the transcript API key) finds evidence for each of the 20 ICF ACC behaviors plus the Competency 1 qualifiers.
- The coach edits all evidence (click `+` on a transcript turn, or select words), picks every rating, and completes every field of the ICF form. The AI only suggests; nothing is pre-selected.
- Save fills the ORIGINAL ICF Word form (`public/templates/icf-session-observation-form-acc.docx`) in the browser with JSZip (`src/lib/sof/fillDocx.js`). It maps the template's 151 content controls by document order and checks the count (151) before filling. A4.3's five rating symbols are plain text in ICF's file (not checkboxes), and the code handles that. If ICF releases a new template version, re-map the control order in `fillDocx.js`.
- "Save progress" stores a draft (transcript text, speaker roles, evidence, answers, AI suggestions; never audio) in `observation_drafts` (`migrations/add_observation_drafts.sql`) via actions `obs-save|list|get|delete` in `api/user-actions.js` (admin only, per user, soft delete). A first draft saves automatically when the form opens, then autosaves 30 seconds after any change. "Download form" produces the .docx. Mentor coach profiles are not built yet.

## Admin sidebar (full admins)

Groups, top to bottom: **Student** (Transcript Reviewer), **Mentor Coach** (Session Observation Form), **Admin** (Internal Assessor, Audio to Transcript), **In progress** (ACC Practice Exam, AI Client), **Admin Tools** (Users / Access Codes → `/admin`, History / Data → `/admin/history`, Tool Configuration → `/admin/config`). Full admins no longer see the participant Dashboard or History links, and sign-in sends them to `/admin` (`homeFor`). The Users tab no longer has Cohort or Mentor Coach fields (the `cohorts` and `mentor_coaches` tables and `users.cohort_id` / `mentor_coach_id` columns remain, unused by the admin screens). Participant (`coach`) accounts keep the old Dashboard / History / Toolkit sidebar.

## Sign-in: Student, Mentor Coach, Admin (NEW, Nov 2026)

- Home page `/access` (`src/pages/LoginHome.jsx`) has three boxes. **Student** → `/access/student` (access code, no account, Transcript Reviewer only; `AccessCodeEntry.jsx`). **Mentor Coach** → `/access/mentor` and **Admin** → `/access/admin` (`src/pages/AccountSignIn.jsx`): a "Sign in" tab (default: email + password, Forgot password sends a Supabase reset link to `/set-password`) and a "First time signing in" tab at the top (one-time code, then email + password twice). `/login` still exists for CoachRICE participant accounts.
- Mentor coaches and tool-only admins are REAL Supabase accounts. New `users.role` values: `mentor` (Session Observation Form only) and `admin_tools` (Internal Assessor, Audio to Transcript, Session Observation Form; no dashboard, users, history, analytics). Full admins keep `admin` and sign in through the same Admin returning form. `homeFor(role)` in `src/lib/roles.js` decides where each role lands; `ProtectedRoute` accepts `'any'` (coach + admin), a role, or a list of roles; `Layout` shows the limited sidebar for `mentor`/`admin_tools`.
- Codes: `access_codes.role` is `student` (reusable), `mentor`, or `admin` (both ONE-TIME). Admin > Access Codes creates them; one code per person. `used_at` / `used_by` record use; `users.signup_code_id` remembers which code created the account (`migrations/add_mentor_admin_accounts.sql`, must be run once). Mentor/admin codes never open a tool directly: `/api/access-codes?action=verify` returns `reason: 'signup'` for them and `lookupCode` rejects used codes.
- Sign-up is server-side in `api/user-actions.js`: `code-check` (does not use the code up) then `code-signup` (claims the code atomically, creates the auth user with `email_confirm: true`, writes the `users` row, moves any work saved under the code to the new account; on any failure it releases the code and removes the half-made account). No email confirmation by the owner's choice: admins fix a mistyped email in Admin > Users (the `profile` action updates the auth email too). Passwords are reset by the user (Forgot password) or by an admin (Reset password in the user list).
- Server rule: `requireCaller(req,res,supabase,{accountRoles})` in `server/auth.js` checks the Bearer token and `users.role`/`is_active`. `api/ai.js` tools: `access: 'admin'` → `admin`, `admin_tools`; `'mentor'` → also `mentor`; `'user'` → any account except `mentor`/`admin_tools`; `'guest'` → student codes only. `audio-*` allow `admin`/`admin_tools`; `obs-*` also allow `mentor`. Purge actions allow `admin` only. `GuestRoute` and `Layout` only decide what is SHOWN; the server decides what is ALLOWED.
- Work saved by mentor/tool-admin accounts belongs to the account (`user_id`). The `access_code_id` columns remain for work saved under old codes; it moves to the account at sign-up.
- Usage counts: `access_code_events` records only the tool name and time. Account calls are logged against the code the person signed up with (`users.signup_code_id`); student codes log directly. Admin > Access Codes shows totals per code, plus "used by <email>".
- Saved prompts reach tool admins and student-code users through `POST /api/user-actions?action=code-prompts` (returns only `ai_assessor_prompt`, `ai_assessor_2025_prompt`, `transcript_reviewer_prompt`). The Internal Assessor and Transcript Reviewer use it.
- By design (owner's choice): tool-only admins have no list or viewer of their past Internal Assessor results.
- Observation drafts are deleted for real (`obs-delete`), by the mentor coach (list or the form's Delete button) or by an admin (Delete saved data per code, which now also removes the work of the person who used that code).
- Admin > History / Data > Delete data (`src/components/DataPurgePanel.jsx`, actions `purge-counts|purge-data|purge-code` in `api/user-actions.js`) shows record counts and deletes transcript and scoring data for good, after the admin types DELETE. Admin accounts only.

## Audio to Transcript (Deepgram)

- Admin-only at first. The Deepgram key is stored in `config` as `api_key_audio` (set in Admin > Audio to Transcript; write-only, hidden from browsers by RLS).
- `POST /api/user-actions?action=audio-token` (admin) trades that key for a 1-hour Deepgram token. The browser uploads audio **straight to Deepgram** with that token, so audio never touches our server (Vercel Hobby caps bodies at 4.5MB) and is never stored.
- Request uses `model=nova-3`, `diarize`, `utterances`, `smart_format`, and `mip_opt_out=true` (Deepgram may not train on the audio).
- Only transcript text is saved, in `audio_transcripts` (`migrations/add_audio_transcripts.sql`) via actions `audio-save|list|get|delete`.
- "Send to Transcript Reviewer" hands the text over through `sessionStorage` (`pendingTranscript`, `pendingTranscriptName`), read on mount by `TranscriptScorer.jsx`.
- AI calls go through the server proxy `/api/ai` (browser holds no Anthropic key); admin helpers live in `server/`.

## Pauses and page layout (Nov 2026)

- Audio to Transcript marks pauses of 3+ seconds as `[pause N sec]` lines in the downloaded, copied, saved, and sent text. The "Mark pauses" box is now ticked by default.
- The Session Observation Form reads those lines (`RE_PAUSE` in `src/lib/sof/transcript.js`): the pause is stored as `pauseBefore` on the next turn, not as speech. The AI evidence step sees it as `(pause before: Ns)` and uses it for A5.4 (silence); the transcript panel shows it in orange.
- All Session Observation Form screens are centered (960px wide; the two-column form stage is 1400px).
- Audio to Transcript has two PDF buttons: "Download PDF" (with the speaker breakdown and silence line at the top) and "Download PDF (transcript only)" (`hideBreakdown` in `src/lib/audioTranscriptPdf.js`), for feeding the PDF to the Transcript Reviewer.
- Long pauses INSIDE one speaker's turn (same speaker keeps talking after 3+ seconds of quiet) are written into that turn's text as `[pause N sec]` by `buildTurns`. They show in the editor, the .txt, PDF and copy when "Mark pauses" is ticked, and are stripped (also from word counts) when it is not. "Remove all pauses" deletes them from the text.
- Session Observation Form reading a PDF made by Audio to Transcript: `cleanAudioToolPdfText` in `SessionObservation.jsx` drops the PDF header (file name, date, optional speaker breakdown) and the page footers before parsing. The PDF's speaker cells now read `Coach:` so the parser finds each speaker.

## Annotated transcript export (Session Observation Form, Nov 2026)

- The form's top bar has "Download annotated transcript (PDF)". `src/lib/sof/annotatedTranscriptPdf.js` builds it with jsPDF in the browser (same header band, Montserrat, footer, and table look as the Audio to Transcript PDF; shared loaders in `src/lib/pdfLibs.js`). Nothing is uploaded.
- Every evidence quote the coach selected is highlighted (soft lime) in its turn, followed by an orange tag with the behavior code(s), like `[A6.1, A7.2]`. If an evidence quote was edited so it no longer matches the transcript text, the turn still gets the tag at its end, without a highlight. Long pauses (3+ sec) print as `[ pause N sec ]` rows.
- The last section is an "Evidence index": each of the 20 behaviors with the chosen rating and the times of its evidence.
- The form has a "Name of this observation" box at the top (`form.title`, `draftTitle()` in `SessionObservation.jsx`). It names the saved draft in the "Continue a saved observation" list and the annotated PDF. If left blank, the name falls back to the client name plus session, then "Untitled observation".

## Admin view of saved observations, and no coach names in Reviewer results (Nov 2026)

- Admin > History / Data > By person: picking a mentor coach, tool admin, or admin shows "Saved Session Observation Forms" (`src/components/SavedObservations.jsx`). Each row is Complete or In progress (Complete = `missingItems(form)` is empty, computed when viewing; there is no stored status). Clicking opens `ObservationViewer.jsx`: every field the database holds (admin info, qualifiers, ratings, evidence, AI suggestions, strengths and development, attestation, the full transcript with highlights), read only, plus downloads of the ICF .docx and the annotated PDF (shared code in `src/lib/sof/annotatedExport.js`).
- Server: `obs-admin-list` and `obs-admin-get` in `api/user-actions.js`, full admins only (`requireAdmin`; mentors and tool admins cannot call them). They only read.
- Transcript Reviewer results no longer keep the coach's name: `server/privacy.js` removes `coach_identifier` before `guest_analyses` (`api/access-codes.js` save-analysis) and `transcript_analyses` (`api/transcript-history.js`) are written. The person running the review still sees the name on screen. The admin list shows "Transcript review — <code label>". Run `migrations/remove_coach_names_from_reviews.sql` once to clean results saved earlier.
- The Reviewer never stores the transcript text. It does store the AI's evidence quotes (under 15 words each) and notes, which can still contain a name the AI copied from the transcript.
