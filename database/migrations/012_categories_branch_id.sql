-- ---------------------------------------------------------------------------
-- Add categories.branch_id (FK -> public.branches) + branch-aware category RLS
-- ---------------------------------------------------------------------------
-- Run this in Supabase SQL Editor.

-- 1) Add column (nullable first so old rows can be backfilled)
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches (id) ON DELETE RESTRICT;

-- 2) Backfill existing categories to a valid branch
UPDATE public.categories c
SET branch_id = COALESCE(
  (SELECT id FROM public.branches WHERE name = 'Calumpang Branch' LIMIT 1),
  (SELECT id FROM public.branches ORDER BY name LIMIT 1)
)
WHERE c.branch_id IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.categories WHERE branch_id IS NULL) THEN
    RAISE EXCEPTION 'Could not backfill categories.branch_id: add at least one row to public.branches before running.';
  END IF;
END $$;

ALTER TABLE public.categories
  ALTER COLUMN branch_id SET NOT NULL;

-- 3) Helpful indexes and branch-level uniqueness
CREATE INDEX IF NOT EXISTS idx_categories_branch_id ON public.categories (branch_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_categories_branch_name ON public.categories (branch_id, lower(name));

-- 4) RLS: restrict categories/subcategories visibility by branch for salesmen
DROP POLICY IF EXISTS categories_select ON public.categories;
CREATE POLICY categories_select ON public.categories FOR SELECT TO authenticated
  USING (public.is_owner() OR branch_id = public.my_branch_id());

DROP POLICY IF EXISTS subcategories_select ON public.subcategories;
CREATE POLICY subcategories_select ON public.subcategories FOR SELECT TO authenticated
  USING (
    public.is_owner()
    OR EXISTS (
      SELECT 1
      FROM public.categories c
      WHERE c.id = category_id
        AND c.branch_id = public.my_branch_id()
    )
  );

-- 5) Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
