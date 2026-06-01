-- Matches schema.sql line 51:
--   category_id uuid REFERENCES public.categories (id) ON DELETE SET NULL
--
-- Run in Supabase SQL Editor on an existing database that still has
--   category_id NOT NULL ... ON DELETE RESTRICT

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_category_id_fkey;

ALTER TABLE public.products
  ALTER COLUMN category_id DROP NOT NULL;

ALTER TABLE public.products
  ADD CONSTRAINT products_category_id_fkey
  FOREIGN KEY (category_id)
  REFERENCES public.categories (id)
  ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';
