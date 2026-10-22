-- =====================================================================
-- Hide AI API keys from the browser  (Step B of the API-key lockdown)
--
-- !! DO NOT RUN THIS until ALL of these are true:
--    1. The "ai-proxy" pull request is merged AND deployed on Vercel.
--    2. You tested the AI tools in production (they now call /api/ai).
--    3. Fluid Compute is on (Vercel > Settings > Functions).
--
-- Running it before then breaks every AI tool, because the old browser
-- code still reads the keys from the `config` table.
--
-- What it does: adds ONE "restrictive" rule to the `config` table.
-- A restrictive rule works on top of your existing rules, so nothing
-- else about `config` changes (prompts, tool colors, visibility all
-- keep working). Rows whose key starts with `api_key_` become invisible
-- and unwritable from the browser for everyone, admins included.
-- The server (service role) still reads and writes them.
-- Admins now save keys through /api/user-actions?action=api-key-save.
--
-- BEFORE running, check Row Level Security is ON for `config`:
--   select relrowsecurity from pg_class where relname = 'config';
-- It must say "true". If it says "false", STOP and ask for help:
-- turning it on without other rules would block the whole table.
--
-- TO UNDO, run:
--   drop policy "config_hide_api_keys_from_browser" on public.config;
-- =====================================================================

create policy "config_hide_api_keys_from_browser"
  on public.config
  as restrictive
  for all
  to anon, authenticated
  using (left(key, 8) <> 'api_key_')
  with check (left(key, 8) <> 'api_key_');

-- AFTER running, check it worked (should return 0 rows):
--   set local role authenticated;
--   select key from public.config where key like 'api_key_%';
