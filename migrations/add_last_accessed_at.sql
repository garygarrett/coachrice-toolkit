-- Add last_accessed_at column to track user login times
ALTER TABLE users ADD COLUMN last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create an index for efficient sorting
CREATE INDEX idx_users_last_accessed_at ON users(last_accessed_at DESC NULLS LAST);
