-- Add agreements acceptance tracking to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS agreements_accepted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS agreements_accepted_at TIMESTAMP WITH TIME ZONE;

-- Create index for faster lookups of users who haven't accepted agreements
CREATE INDEX IF NOT EXISTS idx_users_agreements_accepted ON public.users(agreements_accepted);
