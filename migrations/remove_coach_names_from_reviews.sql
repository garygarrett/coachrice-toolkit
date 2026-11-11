-- Transcript Reviewer: stop keeping the coach's name ("coach_identifier") in saved results.
-- New results are cleaned by the server (server/privacy.js). This removes the name from results saved earlier.
-- Run this once in the Supabase SQL editor. Safe to run again.

-- Student access code results
update public.guest_analyses
set analysis_data = analysis_data - 'coach_identifier'
where analysis_data ? 'coach_identifier';

-- Participant account results (works whether analysis_text is a text or a jsonb column)
do $$
declare col_type text;
begin
  select data_type into col_type from information_schema.columns
  where table_schema = 'public' and table_name = 'transcript_analyses' and column_name = 'analysis_text';

  if col_type = 'jsonb' then
    execute $q$update public.transcript_analyses set analysis_text = analysis_text - 'coach_identifier' where analysis_text ? 'coach_identifier'$q$;
  elsif col_type is not null then
    execute $q$update public.transcript_analyses set analysis_text = ((analysis_text::jsonb) - 'coach_identifier')::text
               where analysis_text like '%"coach_identifier"%' and analysis_text ~ '^\s*\{'$q$;
  end if;
end $$;
