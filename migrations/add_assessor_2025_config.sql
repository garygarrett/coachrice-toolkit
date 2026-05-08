-- Add configuration entries for Internal Assessor (2025)
-- Run this in your Supabase SQL editor

-- Add API key entry for the 2025 assessor
INSERT INTO config (key, value)
VALUES ('api_key_assessor_2025', '')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Add system prompt entry for the 2025 assessor
INSERT INTO config (key, value)
VALUES ('ai_assessor_2025_prompt', '')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
