-- Saved work-in-progress from the Session Observation Form Mentor Coaching tool.
-- Stores the transcript text, the form answers, and the evidence. Audio is never saved.
-- Run this once in the Supabase SQL editor.

create table if not exists observation_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  title text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists observation_drafts_user_idx on observation_drafts (user_id, updated_at desc);

-- Lock the table: browsers cannot read it directly. Only our server functions
-- (which check who is calling) can reach it.
alter table observation_drafts enable row level security;
