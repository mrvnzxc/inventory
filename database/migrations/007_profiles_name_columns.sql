-- ---------------------------------------------------------------------------
-- Add profile name fields for team management
-- ---------------------------------------------------------------------------
-- Run in Supabase SQL Editor.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text;

NOTIFY pgrst, 'reload schema';
