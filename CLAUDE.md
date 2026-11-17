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

## Competency Review Form (NEW, Nov 2026)

- ICF's Mentor Coaching Competency Review Form (ACC, rev. 06.18.26) sums up a participant's Session Observation Forms #1-#3. One per participant. It lives on the SAME page as the Session Observation Form (`/tools/session-observation`, no separate sidebar link): the "What would you like to create?" card has two toggle buttons, and the bottom half of the start screen is either the observation start card or the review (`mode` state in `SessionObservation.jsx`; the top half with the cohort filter, saved lists, and By participant stays). Component: `src/pages/tools/CompetencyReview.jsx` (no Layout of its own; props `request` = `{ participantId, n }` to open or start a participant's review, `onStageChange`, `onChanged`). While a review is open it takes over the page like an open observation (the parent hides its top half; `crfStage`). The old `/tools/competency-review` URL redirects to `/tools/session-observation?form=review`. Fields shared with the admin viewer live in `src/components/ReviewFields.jsx` (`readOnly` prop); form data, the thresholds, and the pre-fill rule live in `src/lib/crf/crfSpec.js`.
- Where it shows up: (1) Session Observation page > "By participant": a fourth row after Form #3 (Start / Open, with In progress / Complete; it opens the review in place, no page change); (2) the "What would you like to create?" toggle above the start card; (3) Admin > Cohorts: a "Competency Review" column after Form #3 that opens the read-only `ReviewViewer.jsx` (with Word download).
- Pre-fill from the SOFs (`prefillFromObservations`): a statement is **Proficiency Demonstrated** if ANY of the participant's saved SOFs rated it Exceeds or Meets; **Not Yet** if at least one SOF rated it and none reached Meets (Below, Does Not Meet, N/A); left blank if no SOF rated it. Each competency's "at least N of the statements" Yes/No follows the statements (3 of 4 for C3 and C5, 2 of 3 for C4, C6, C7, C8) once every statement is answered, and the coach can still change it. Competency 1 is Yes only when every SOF that answered both qualifiers marked both Observed, No if any was Not Observed. Also pre-fills session log dates (one row per SOF, by form number), observed-session count, and level. Mentor name/email and client name auto-fill when empty (same rule as the SOF). "Refresh from Session Observation Forms" re-applies it after confirmation. A participant with no SOFs gets a blank form. Coaches can edit everything.
- Export: `src/lib/crf/fillCrfDocx.js` fills the ORIGINAL ICF Word file (`public/templates/icf-competency-review-form-acc.docx`) in the browser with JSZip. It maps the template's 88 content controls by document order and checks the count (88): level 0-2, self-review 3-5, Competency 1 Yes/No 6-7 and notes 8, then per competency one Demonstrated/Not-Yet pair per statement followed by one Yes/No pair (9-60), 12 strength/development pairs 61-84, overall 85-86, review confirmation 87. Name/email/date/signature lines are labeled paragraphs; hours are the first table and the session log is the second table (rows 3-7; row 2 is ICF's example). Item 7's total goes only in the hours table. If ICF issues a new template version, re-map the control order.
- Storage: table `competency_reviews` (`migrations/add_competency_reviews.sql`, run once BEFORE deploying): `user_id`, `cohort_id`, `participant_id`, `title`, `data` (`{ review }`), `deleted_at`; a partial unique index allows one review per participant (409 on a second). RLS is on, and nothing is read by browsers directly.
- API (`api/user-actions.js`): `crf-save|list|get|delete` (mentor, tool admin, admin; owner only; first save takes `link: { participantId }`, later saves ignore it), `crf-sofs` (the participant's saved SOF forms #1-#3 for pre-fill; only the assigned mentor coach or a full admin; 403 otherwise), `crf-admin-get` (full admins, read only). `cohort-mine` returns `review: { mine, id } | null` per participant (another mentor's review id is never returned); `cohort-admin-load` returns `reviews`.
- Side panel (Nov 2026): while filling the review for a participant, their saved Session Observation Forms open beside it, read only, with no new tab and no download. Two ways in: "Form #n" buttons in the toolbar, and small rating chips under each behavior (such as "#1 · Meets"; clicking one scrolls the panel to that behavior). The panel is non-modal, so the review stays editable; it opens about 400px wide, the form makes room for it (left-aligned, using the real space to the window edge, never under ~560px), and its left edge can be dragged to resize; it is `ObservationViewer` with `embedded` (no back button, downloads, owner line, or AI note) inside a fixed right-hand `<aside>` in `CompetencyReview.jsx`. Server action `crf-sof-get` (mentor, tool admin, admin) returns one linked SOF's full record, only for a participant assigned to the caller (full admins: any) and never for an unlinked observation; it removes `data.ai` for mentor coaches. No database change.
- Not built: an AI step (the review is pure form logic), a PDF export of the review, and a "completed" flag stored in the database (Complete = `missingReviewItems(review)` is empty, computed when shown).

## FAQ / Guide (NEW, Nov 2026)

- Page `/guide` (`src/pages/FAQGuide.jsx`), titled "FAQ / Guide". Sections live in the table `guide_sections` (`migrations/add_guide_sections.sql`, run once BEFORE deploying): `title`, `body`, `audiences text[]` (`participant` = role `coach`, `mentor`, `tool_admin` = role `admin_tools`), `sort_order`. RLS is on; browsers never read it directly.
- Who sees what: each section lists the account types that may read it. Full admins (`admin`) always see every section, with audience badges, and get the **Edit guide** button (add, edit, delete, move up/down, choose audiences, preview). **If an account type has no section marked for it, the sidebar "FAQ / Guide" link does not appear for those accounts** (`useGuideAvailable` in `src/lib/guideAvailability.js`; the page itself then says there is nothing yet). Admins always get the link (Admin Tools group); other roles get a "Help" group at the bottom of the sidebar.
- API (`api/user-actions.js`): `guide-list` (any signed-in account; returns only what that account may read and never the audiences list, except for admins), `guide-save|delete|reorder|seed` (full admins only). `guide-seed` only works while the table is empty.
- Text format (`src/lib/guideMarkdown.jsx`, no innerHTML): `##` / `###` headings, `-` bullets, `1.` steps, `**bold**`, `[text](url)`, `![caption](/guide/file.png)`. Links and images accept only http(s), mailto, or a path on this site. The editor (`src/components/GuideEditor.jsx`) has a toolbar (bold, heading, subheading, bullets, steps, link, picture) and a live preview beside the text box. Pictures can be added with the Picture button, by pasting a screenshot, or by dragging a file onto the box. The browser shrinks each picture first (`src/lib/resizeImage.js`: max 1600px wide, 2.5 MB), then `guide-upload-image` (full admins only, 3 MB cap, PNG/JPG/WEBP/GIF) stores it in the public Supabase Storage bucket `guide-images` (the server creates the bucket the first time; no SQL) under a random file name and returns its address. Pictures are public by address, and deleting a section does not delete its pictures. The starter sections use pictures shipped in `public/guide/`.
- Starter content (`src/lib/guideDefaults.js`): 12 mentor coach sections with screenshots in `public/guide/`. An admin loads them once with "Load the starter mentor coach guide" on an empty guide; after that the database copy is the real one and this file is only a starting point.
- PDF: "Print / Save as PDF" (everyone who can read the guide) opens a clean, branded copy of the sections THEY can see in a new window and starts the browser print dialog, so the PDF is always current. The same renderer (`guideDocumentHtml`) was used to make the delivered `CoachRICE-Mentor-Coach-Guide.pdf`. Every version ends with "For any questions, email CoachRICE@rice.edu".

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

## Tool Configuration cleanup and editable sign-in text (Nov 2026)

- `/admin/config` tabs now match what is published. Published: Transcript Reviewer, Session Observation Form (info only: it uses the Transcript Reviewer API key and built-in AI instructions), Internal Assessor (one tab with the 2021 and 2025 prompts and keys), Audio to Transcript. In progress: ACC Practice Exam, AI Client. Plus a Sign-in Pages tab. The tool list is the `TOOLS` array in `AdminPanel.jsx` (`group`, `pageContent`, `dashboard` flags decide which sections show).
- Bug fixed: the Transcript Reviewer and 2025 assessor prompt boxes used to share one state variable with the 2021 prompt, so they showed (and could overwrite) the wrong prompt. `prompts` is now keyed by config key, and each tab saves only its own tool's keys.
- The "Participant dashboard tile" settings (tile text, colors, visible/hidden) sit in a collapsed section and appear only for tools that have a participant tile (Transcript Reviewer, Exam, AI Client). The participant dashboard no longer shows an Audio to Transcript tile (that tool is admin only). "Start Page Text" appears only for tools whose pages read it (Transcript Reviewer, Exam, AI Client). The Transcript Reviewer's built-in start text lives in `src/lib/transcriptStartDefaults.js`, shared by the student page, the participant page, and the admin form.
- Sign-in pages: text comes from `site_content` keys that start with `login_` (field list and standard text in `src/lib/loginContent.js`, hook `useLoginContent`). Signed-out visitors read it through `GET /api/access-codes?action=login-content` (service role, only `login_` keys). A blank box means "use the standard text". Edit it in Tool Configuration > Sign-in Pages.

## Cohorts and participants for the Session Observation Form (Nov 2026)

- Admin > Users / Access Codes > **Cohorts** tab (`src/components/CohortsTab.jsx`). An admin creates a cohort, types in participant names (one per line; names only, participants have no accounts and never sign in), and checks which mentor coaches (`mentor`, `admin_tools`, or `admin` accounts) are assigned to it. The table shows each participant's Form #1, #2, #3 as Not started / In progress / Complete, with the mentor coach and date. Clicking a cell opens the read-only `ObservationViewer`. Complete uses the same rule as elsewhere: `missingItems(form)` is empty.
- Tables (`migrations/add_cohorts_and_participants.sql`, run once): `observation_cohorts`, `observation_participants`, `observation_cohort_mentors` (many-to-many, so a mentor can have several cohorts). These are NEW tables; the older `cohorts` table and `users.cohort_id` are untouched and still unused. `observation_drafts` gains `cohort_id`, `participant_id`, `form_number` (1 to 3). A unique index allows one saved observation per participant per form number (deleting the observation frees the slot). Deleting a cohort or participant keeps saved observations and only clears the link.
- Session Observation Form start screen: an assigned mentor sees a "Who is this observation for?" card (cohort picker only if they have more than one cohort, participant dropdown, Form #1/#2/#3 buttons). It is REQUIRED for `mentor` accounts that have a cohort. Admins and tool admins see it only if assigned, and may choose "Not for a cohort participant". Mentors with no cohort see no change. All three form buttons are always selectable and each shows "Not started" or "Already saved". Picking a form number that already exists shows a warning (saved by you, with an "Open saved form" button, or by another mentor coach) and blocks Continue until a different number is chosen; the server still refuses a duplicate with 409. Choosing a participant pre-fills the form's client name.
- API (`api/user-actions.js`): admin only: `cohort-admin-load`, `cohort-save`, `cohort-delete`, `participants-add`, `participant-update`, `participant-delete`, `cohort-mentors-set`. `cohort-mine` (mentor, tool admin, admin) returns only the caller's assigned cohorts and never another mentor's observation id or content. `obs-save` takes `link: { participantId, formNumber }` on the FIRST save only (later saves ignore it); a non-admin must be assigned to that participant's cohort, and a taken slot returns 409. `obs-link` (owner only) changes the participant and form number of a saved observation, including older unlinked ones, or unlinks it when `participantId` is empty; a taken slot returns 409. `obs-list` and `obs-get` return `participant_id` / `form_number`; `obs-get` also returns `participant_name`.
- Not linked to participants: Transcript Reviewer results (they belong to student access codes, not named participants) and Internal Assessor results.
- Automatic name: a linked observation is named `<participant> - Session Observation Form #n (Complete|Incomplete)` (`autoNameFor` in `SessionObservation.jsx`; Complete = `missingItems(form)` is empty). The name box becomes read-only, and the saved list, the annotated PDF and the admin viewer all use it. The status is refreshed on each save (autosave every 30 seconds), so the saved list can lag the form by up to that long. Unlinked observations keep the typed name.
- "Participant and form" panel (form screen, above the toolbar): a mentor can change who a saved observation is for and its form number, or link an older one. A form number the participant already has is shown as "Already saved" and cannot be chosen (this observation's own slot shows "Current"). Changing the participant also swaps the form's Client name if it was empty or still held the old participant's name. Mentors who must pick a participant cannot unlink.
- Saved observations list (start screen): two dropdowns, "In progress" (open by default) and "Completed" (closed by default), each with a count. An observation counts as Completed when `missingItems(form)` is empty, the same rule used everywhere else; `obs-list` now returns each saved form (`form:data->form`) so the screen can tell. Moving between the two happens on its own when a form's last missing field is filled and saved.
- Each participant belongs to ONE mentor coach (Nov 2026; `observation_participants.mentor_id`, `migrations/add_participant_mentor.sql`, run once BEFORE deploying; it gives every unassigned participant to the cohort's mentor when the cohort has exactly one, and leaves multi-mentor cohorts unassigned). Admin > Cohorts: a "Mentor coach" dropdown on each participant row (choices are only the cohort's checked mentors), a mentor picker next to "Add participants", and an orange notice counting unassigned participants. Action `participants-mentor-set` (admin; `ids` all in one cohort, `mentorId` must be assigned to that cohort, empty clears it). Unchecking a mentor in `cohort-mentors-set` clears that mentor from their participants and returns `unassigned`.
- Visibility rule: `cohort-mine` returns ONLY participants whose `mentor_id` is the caller (admins too), grouped by cohort. `resolveObservationLink` (obs-save first save, obs-link) refuses with 403 unless the participant's `mentor_id` is the caller (full admins are exempt). An unassigned participant is visible to no mentor. If an admin reassigns a participant, the old mentor's saved observations stay theirs (still in their lists), but they cannot link new ones; the new mentor sees those form numbers as "Saved by another mentor coach".
- Start screen, third dropdown "By participant" (under In progress and Completed): pick a participant to see just their Form #1, #2, #3 (status, Open, Delete; "Saved by another mentor coach"; "Start Form #n" fills in the start card below). It also shows for a mentor who has participants but no saved observations yet.
- Alphabetical: participants (admin table, every dropdown, `cohort-mine`) and cohorts and mentor lists sort A to Z ignoring capitals, by the name as typed (type "Smith, Jane" to sort by last name). The In progress / Completed lists stay newest first.

- Cohort selector at the TOP of the start screen (shown only when the account has more than one cohort; `cohortFilter` state, "All cohorts" default). It limits the In progress / Completed lists (by `cohort_id`, which `obs-list` now returns), the By participant dropdown, and the participants offered in the "Who is this observation for?" card (which has no cohort picker of its own anymore; the cohort comes from the chosen participant). Forms not linked to a cohort show only under "All cohorts".
- Session Observation Form layout (Nov 2026): each competency card (3 to 8) now ends with "Observation feedback for Competency N", holding that competency's Areas of Strength and Areas for Development (Statement for Feedback + Feedback Comments). The separate "Observation Feedback" card is gone. The data is unchanged (`form.strengths[i]` / `form.development[i]`, same order as `COMPETENCIES`), so the .docx fill, `missingItems`, the annotated PDF and the admin viewer are untouched. The form stage has three columns: transcript, a narrow "Jump to" side bar, and the form. The side bar lists Form details, Competency 1, 3 to 8 (with rated counts), and Signature & save; a click scrolls to that card (ids `sec-info`, `sec-c1`, `sec-c3`..`sec-c8`, `sec-sign`) and selects that competency's first behavior in the transcript. The highlighted item follows scrolling (IntersectionObserver in `SessionObservation.jsx`).
- Mentor coach vs admin on the Session Observation Form (Nov 2026): `isAdmin` = role `admin` or `admin_tools`. Only admins see the AI's suggested ratings (the "AI suggestion" boxes under each behavior and the two Competency 1 qualifiers) and get the "Not for a cohort participant" / "Not linked to a participant" option; everyone else (mentor coaches) must pick a participant when they have any assigned. For non-admins `withoutSuggestions()` drops the suggested ratings and notes as soon as the AI result arrives (and when an old draft is opened), so they are never shown or saved; the evidence highlights still work. The AI request itself is unchanged and still returns suggestions to the browser. While the profile is still loading the person is treated as a mentor coach.
- Auto-fill: an effect in `SessionObservation.jsx` fills EMPTY "1. Mentor Coach Name" and "2. Mentor Coach Email" from the signed-in profile (`users.full_name`, `email`) and EMPTY "3. Client Name" from the linked participant, on the setup and form screens (also for older drafts). Anything already typed is never overwritten. The signature section is not pre-filled.
- Pre-assigning to a mentor who has not signed up (Nov 2026; `migrations/add_pending_mentor_codes.sql`, run once BEFORE deploying, after `add_participant_mentor.sql`): `observation_participants.mentor_code_id` (a participant has `mentor_id` OR `mentor_code_id`, never both; check constraint) and the table `observation_cohort_mentor_codes` (unused Mentor Coach / Admin access codes checked for a cohort). Admin > Cohorts shows a "Has an access code, not signed up yet" group in the mentor checklist (`cohort-mentors-set` takes `codeIds`; when `codeIds` is not sent the waiting codes are left alone) and offers those people, labeled "(not signed up yet)", in every mentor dropdown (`participants-mentor-set` and `participants-add` take `mentorCodeId`; the code must be checked for that cohort). `cohort-admin-load` returns `pendingCodes` (unused, active, unexpired mentor/admin codes; label = the person's name) and `codeAssignments`. In `code-signup` (api/user-actions.js), after the account exists: each pending cohort becomes an `observation_cohort_mentors` row for the new account, the pending rows are deleted, and the participants get `mentor_id = new account`, `mentor_code_id = null`. A failure there is logged and does not block sign-up (admin can assign by hand). Deleting an access code unassigns its participants (FK set null / cascade). Until sign-up, nobody sees those participants (`cohort-mine` uses `mentor_id` only).
- "Back to my observations" button (left of Save progress in the form's top bar, `goBack` in `SessionObservation.jsx`): saves any unsaved changes first (`saveDraft` now returns true/false), asks before leaving if that save fails, then returns to the start screen and refreshes the lists. Also fixed a stale `setConsent(false)` call in `resetAll` (the consent checkbox was removed earlier) that threw partway through and left the old draft id and participant link in place after Close / Start over.
