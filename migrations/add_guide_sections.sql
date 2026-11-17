-- FAQ / Guide: sections that admins write and edit. Each section says which kinds of accounts can read it.
-- Run this once in the Supabase SQL editor, BEFORE deploying this version of the app.
-- Like the other newer tables, it is read and written only through the server (service role); RLS blocks browsers.

create table if not exists guide_sections (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  -- Who can read it. Allowed values: 'participant', 'mentor', 'tool_admin'. Full admins always see every section.
  audiences text[] not null default '{}',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists guide_sections_order_idx on guide_sections (sort_order, created_at);

alter table guide_sections enable row level security;
