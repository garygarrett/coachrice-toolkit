-- Competency Review Form (ICF, ACC): one per cohort participant, written by the participant's mentor coach.
-- Run this once in the Supabase SQL editor, BEFORE deploying this version of the app.
-- Like the other mentor-coach tables, it is read and written only through the server (service role); RLS blocks browsers.

create table if not exists competency_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  cohort_id uuid references observation_cohorts(id) on delete set null,
  participant_id uuid references observation_participants(id) on delete set null,
  title text not null default 'Untitled competency review',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists competency_reviews_user_idx on competency_reviews (user_id) where deleted_at is null;

-- A participant has only one Competency Review Form.
create unique index if not exists competency_reviews_one_per_participant
  on competency_reviews (participant_id)
  where participant_id is not null and deleted_at is null;

alter table competency_reviews enable row level security;
