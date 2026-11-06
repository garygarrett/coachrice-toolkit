-- Mentor coaches and tool-only admins now sign up with a ONE-TIME code and get a real account
-- (email + password). Run this once in the Supabase SQL editor.
--
--   users.role gets two new values:  'mentor'      = mentor coach (Session Observation Form only)
--                                    'admin_tools' = admin with the three tools only (no dashboard)
--   access_codes remember who used them (a mentor/admin code works exactly once).
--   users remember which code they signed up with, so the Access Codes page can keep counting their use.

-- 1. Allow the two new roles on users.role (works whether role is a CHECK-constrained text column or an enum).
do $$
declare
  col_type text;
  enum_name text;
begin
  select data_type, udt_name into col_type, enum_name
  from information_schema.columns
  where table_schema = 'public' and table_name = 'users' and column_name = 'role';

  if col_type = 'USER-DEFINED' then
    execute format('alter type %I add value if not exists %L', enum_name, 'mentor');
    execute format('alter type %I add value if not exists %L', enum_name, 'admin_tools');
  else
    alter table public.users drop constraint if exists users_role_check;
    alter table public.users add constraint users_role_check
      check (role in ('coach', 'admin', 'mentor', 'admin_tools'));
  end if;
end $$;

-- 2. One-time use of sign-up codes.
alter table access_codes add column if not exists used_at timestamptz;
alter table access_codes add column if not exists used_by uuid references users(id) on delete set null;

-- 3. Which code a person signed up with.
alter table users add column if not exists signup_code_id uuid references access_codes(id) on delete set null;
