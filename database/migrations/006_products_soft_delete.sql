-- ---------------------------------------------------------------------------
-- Products soft-delete support
-- ---------------------------------------------------------------------------
-- Run in Supabase SQL Editor.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

NOTIFY pgrst, 'reload schema';
