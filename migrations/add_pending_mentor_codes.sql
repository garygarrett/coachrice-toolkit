-- Pre-assign participants to a mentor coach who has an access code but has not signed up yet.
-- In Admin > Cohorts you can check an unused Mentor Coach (or Admin) access code for a cohort and
-- give participants to it. When that person signs up with the code, the cohort and its participants
-- move to their new account on their own. Nothing else for you to do.
-- Run this once in the Supabase SQL editor, BEFORE deploying this version of the app.
-- (Run add_participant_mentor.sql first if you have not already.)

-- A participant belongs to a signed-up mentor coach (mentor_id) OR to a not-yet-signed-up
-- access code (mentor_code_id), never both.
alter table observation_participants
  add column if not exists mentor_code_id uuid references access_codes(id) on delete set null;

create index if not exists observation_participants_mentor_code_idx on observation_participants (mentor_code_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'observation_participants_one_mentor_check') then
    alter table observation_participants
      add constraint observation_participants_one_mentor_check check (mentor_id is null or mentor_code_id is null);
  end if;
end $$;

-- Access codes (not yet used) that are assigned to a cohort, waiting for the person to sign up.
-- If the access code is deleted, this row goes away and its participants become unassigned.
create table if not exists observation_cohort_mentor_codes (
  cohort_id uuid not null references observation_cohorts(id) on delete cascade,
  code_id uuid not null references access_codes(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (cohort_id, code_id)
);

create index if not exists observation_cohort_mentor_codes_code_idx on observation_cohort_mentor_codes (code_id);

alter table observation_cohort_mentor_codes enable row level security;
