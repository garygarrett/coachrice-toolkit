-- Access codes table for anonymous/guest access to the Transcript Reviewer
-- Run this in the Supabase SQL editor

create table if not exists public.access_codes (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  label       text not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- No RLS needed — all access is through the service-role API function,
-- not via the anon client directly from the browser.
