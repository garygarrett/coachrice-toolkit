-- Cohorts, participant names, and mentor-coach assignments for the Session Observation Form.
-- Admins build a cohort in Admin > Users / Access Codes > Cohorts, type in the participant names,
-- and assign mentor coaches. A mentor coach then picks a participant and Form #1, #2, or #3
-- on the Session Observation Form start screen, and the saved observation is linked to that participant.
-- Run this once in the Supabase SQL editor.
--
-- These are NEW tables. The older `cohorts` table (unused by the admin screens) is left alone.

create table if not exists observation_cohorts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- Participants are names only. They do not have accounts and never sign in.
create table if not exists observation_participants (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references observation_cohorts(id) on delete cascade,
  full_name text not null,
  created_at timestamptz not null default now()
);

create index if not exists observation_participants_cohort_idx on observation_participants (cohort_id, full_name);

-- Which mentor coaches (user accounts) work with which cohort.
create table if not exists observation_cohort_mentors (
  cohort_id uuid not null references observation_cohorts(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (cohort_id, user_id)
);

create index if not exists observation_cohort_mentors_user_idx on observation_cohort_mentors (user_id);

-- Link each saved observation to a participant and to Form #1, #2, or #3.
-- If a cohort or participant is deleted, the saved observation stays (the link is just cleared).
alter table observation_drafts add column if not exists cohort_id uuid references observation_cohorts(id) on delete set null;
alter table observation_drafts add column if not exists participant_id uuid references observation_participants(id) on delete set null;
alter table observation_drafts add column if not exists form_number smallint;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'observation_drafts_form_number_check') then
    alter table observation_drafts add constraint observation_drafts_form_number_check check (form_number is null or form_number between 1 and 3);
  end if;
end $$;

-- Each participant has at most one saved observation per form number (Form #1, #2, #3).
-- Deleting the saved observation frees the slot again.
create unique index if not exists observation_drafts_participant_form_uidx
  on observation_drafts (participant_id, form_number)
  where participant_id is not null and form_number is not null and deleted_at is null;

create index if not exists observation_drafts_participant_idx on observation_drafts (participant_id);

-- Lock the new tables: browsers cannot read them directly. Only our server functions
-- (which check who is calling) can reach them.
alter table observation_cohorts enable row level security;
alter table observation_participants enable row level security;
alter table observation_cohort_mentors enable row level security;
