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

## Core Data Model

Five key tables in Supabase:

- **`users`** — extends Supabase Auth; includes `role` (`coach`/`admin`), `cohort_id`, `mentor_coach_id`
- **`cohorts`** — program cohort records; coaches are assigned by admins
- **`mentor_coaches`** — reference data only (no system login in v1.0)
- **`sessions`** — one row per tool submission; `tool` field is `exam`, `transcript_scorer`, `transcriber`, or `coaching_bot`; `score_category` is `knowledge`, `application`, or `none`
- **`competency_scores`** — one row per ICF competency per session; `proficiency_level` is `Developing`, `Approaching`, `Meeting`, or `Exceeding`; `proficiency_numeric` is 1–4

The `competency_scores` table is the source of truth for all charts and analytics. It is not populated for `transcriber` sessions.

## The Four Tools

| # | Tool | Route (planned) | Score category | APIs used |
|---|---|---|---|---|
| 1 | ACC Practice Exam | `/tools/exam` | `knowledge` | Claude |
| 2 | Transcript Scorer | `/tools/transcript` | `application` | Claude |
| 3 | Audio Transcriber | `/tools/transcriber` | `none` | Whisper → Claude |
| 4 | Coaching Bot | `/tools/coaching-bot` | `application` | Claude |

All tools that produce scores must parse Claude's response and write rows to `competency_scores`. Prompt engineering must produce consistently structured output for this to work reliably.

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

## Build Phases (reference)

Phase 3 = Auth + User Management | Phase 4 = DB setup | Phases 5–8 = individual tools | Phase 9 = Coach Dashboard | Phase 10 = Admin Dashboard | Phase 11 = Polish/branding
