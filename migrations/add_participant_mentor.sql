-- Assign each cohort participant to ONE mentor coach.
-- A mentor coach only sees the participants assigned to them on the Session Observation Form.
-- Admins set this in Admin > Users / Access Codes > Cohorts (the "Mentor coach" column).
-- Run this once in the Supabase SQL editor, BEFORE deploying this version of the app.

alter table observation_participants
  add column if not exists mentor_id uuid references users(id) on delete set null;

create index if not exists observation_participants_mentor_idx on observation_participants (mentor_id);

-- Keep today's behavior for simple cohorts: if a cohort has exactly ONE mentor coach,
-- give them every participant that has no mentor yet. Cohorts with several mentor coaches are
-- left unassigned, because there is no way to know who works with whom. An admin assigns them.
update observation_participants p
set mentor_id = m.user_id
from (
  select cohort_id, (min(user_id::text))::uuid as user_id
  from observation_cohort_mentors
  group by cohort_id
  having count(*) = 1
) m
where p.cohort_id = m.cohort_id
  and p.mentor_id is null;
