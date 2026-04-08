-- ---------------------------------------------------------------------------
-- Add products.image_url + refresh PostgREST schema cache
-- ---------------------------------------------------------------------------
-- Run this in Supabase: Dashboard -> SQL -> New query -> Run
-- ---------------------------------------------------------------------------

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS image_url text;

NOTIFY pgrst, 'reload schema';
