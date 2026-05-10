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
| 3 | Audio Transcriber | `/tools/audio-to-transcript` | ✓ Working |
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
- Can download as PDF or text
- **NEW:** Can save to History for later viewing
- Saved assessments store full JSON + competency breakdown

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

**Admin History** (`/pages/AdminHistory.jsx`):
- View by User: select a coach, see all their results across all tools
- View by Tool: select a tool, see all uses across all coaches; competency breakdown for exams
- Internal Assessments tab: admin-only view of 2021 and 2025 assessor evaluations with full assessment details and PDF downloads

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
- `src/pages/AdminPanel.jsx` — admin user management
- `src/pages/AdminHistory.jsx` — admin analytics: view user history or tool-wide stats
- `src/pages/tools/Exam.jsx` — practice exam tool
- `src/pages/tools/TranscriptScorer.jsx` — transcript scoring tool
- `src/pages/tools/AudioToTranscript.jsx` — audio transcriber
- `src/pages/tools/AIClient.jsx` — coaching bot
- `src/pages/tools/Assessor.jsx` — internal assessor 2021
- `src/pages/tools/Assessor2025.jsx` — internal assessor 2025 (Nov 2025 BARS)

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
