-- Access codes get a role (student, mentor, admin) and an optional expiry date.
-- Mentor and admin codes own the work they save (drafts, saved transcripts, assessments).
-- Run this once in the Supabase SQL editor. Existing codes become 'student' codes.

alter table access_codes add column if not exists role text not null default 'student';
alter table access_codes add column if not exists expires_at timestamptz;

do $$ begin
  alter table access_codes add constraint access_codes_role_check check (role in ('student', 'mentor', 'admin'));
exception when duplicate_object then null; end $$;

-- Saved observation drafts, saved audio transcripts, and saved assessments can belong to a code instead of a user.
alter table observation_drafts alter column user_id drop not null;
alter table observation_drafts add column if not exists access_code_id uuid references access_codes(id) on delete cascade;
do $$ begin
  alter table observation_drafts add constraint observation_drafts_owner_check check (user_id is not null or access_code_id is not null);
exception when duplicate_object then null; end $$;
create index if not exists observation_drafts_code_idx on observation_drafts (access_code_id, updated_at desc);

alter table audio_transcripts alter column user_id drop not null;
alter table audio_transcripts add column if not exists access_code_id uuid references access_codes(id) on delete cascade;
do $$ begin
  alter table audio_transcripts add constraint audio_transcripts_owner_check check (user_id is not null or access_code_id is not null);
exception when duplicate_object then null; end $$;
create index if not exists audio_transcripts_code_idx on audio_transcripts (access_code_id, created_at desc);

alter table internal_assessments alter column user_id drop not null;
alter table internal_assessments add column if not exists access_code_id uuid references access_codes(id) on delete cascade;
do $$ begin
  alter table internal_assessments add constraint internal_assessments_owner_check check (user_id is not null or access_code_id is not null);
exception when duplicate_object then null; end $$;
create index if not exists internal_assessments_code_idx on internal_assessments (access_code_id);

-- A running count of what each access code has used. Stores only the tool name and the time:
-- no transcript, name, or score is kept here. Admins see the totals on the Access Codes page.
create table if not exists access_code_events (
  id uuid primary key default gen_random_uuid(),
  access_code_id uuid not null references access_codes(id) on delete cascade,
  tool text not null,
  created_at timestamptz not null default now()
);
create index if not exists access_code_events_code_idx on access_code_events (access_code_id, created_at desc);
alter table access_code_events enable row level security;
