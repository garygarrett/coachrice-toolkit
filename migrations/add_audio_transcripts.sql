-- Saved transcripts from the Audio to Transcript tool.
-- Only the TEXT is stored. The audio file is never saved anywhere.
-- Run this once in the Supabase SQL editor.

create table if not exists audio_transcripts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  title text not null,
  transcript_text text not null,
  turns jsonb,
  speaker_names jsonb,
  duration_seconds integer,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists audio_transcripts_user_idx on audio_transcripts (user_id, created_at desc);

-- Lock the table: browsers cannot read it directly. Only our server functions
-- (which check who is calling) can reach it.
alter table audio_transcripts enable row level security;
