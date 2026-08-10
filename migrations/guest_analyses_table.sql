-- Guest analyses table — stores anonymous transcript evaluation results
-- from participants who access the tool via an access code (no user account).
-- No transcript text is stored, only the evaluation output.
-- Run this in the Supabase SQL editor.

create table if not exists public.guest_analyses (
  id                  uuid primary key default gen_random_uuid(),
  access_code_label   text not null,
  analysis_data       jsonb not null,
  competency_scores   jsonb,
  created_at          timestamptz not null default now()
);
