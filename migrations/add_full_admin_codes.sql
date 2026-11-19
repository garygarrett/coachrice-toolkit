-- Lets an access code create a FULL admin account (everything, including Users, History / Data, Tool Configuration).
-- Run this once in the Supabase SQL editor, BEFORE deploying this version of the app.
-- Existing codes are not changed. The new code type is 'admin_full' (one-time, like Mentor and Admin codes).

alter table access_codes drop constraint if exists access_codes_role_check;
alter table access_codes add constraint access_codes_role_check
  check (role in ('student', 'mentor', 'admin', 'admin_full'));
