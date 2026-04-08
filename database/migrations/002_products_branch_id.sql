-- ---------------------------------------------------------------------------
-- Add products.branch_id (FK → public.branches) + refresh PostgREST schema cache
-- ---------------------------------------------------------------------------
-- Run this in Supabase: Dashboard → SQL → New query → Run.
--
-- Use when you see: "Could not find the 'branch_id' column of 'products' in the schema cache"
-- or when your live DB was created before branch_id existed on products.
--
-- The app already sends branch_id from the sidebar branch (owner); this migration
-- aligns the database with database/schema.sql.
-- ---------------------------------------------------------------------------

-- 1) Column + FK (nullable first so we can backfill)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches (id) ON DELETE RESTRICT;

-- 2) Backfill: prefer Calumpang, else any branch (must exist)
UPDATE public.products p
SET branch_id = COALESCE(
  (SELECT id FROM public.branches WHERE name = 'Calumpang Branch' LIMIT 1),
  (SELECT id FROM public.branches ORDER BY name LIMIT 1)
)
WHERE p.branch_id IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.products WHERE branch_id IS NULL) THEN
    RAISE EXCEPTION 'Could not backfill products.branch_id: add at least one row to public.branches before running.';
  END IF;
END $$;

ALTER TABLE public.products ALTER COLUMN branch_id SET NOT NULL;

-- 3) Keep inventory rows aligned with product branch
DELETE FROM public.inventory i
USING public.products p
WHERE i.product_id = p.id
  AND p.branch_id IS NOT NULL
  AND i.branch_id <> p.branch_id;

-- 4) RLS (same as schema.sql)
DROP POLICY IF EXISTS products_select ON public.products;
CREATE POLICY products_select ON public.products FOR SELECT TO authenticated
  USING (public.is_owner() OR branch_id = public.my_branch_id());

DROP POLICY IF EXISTS sales_insert_owner ON public.sales;
CREATE POLICY sales_insert_owner ON public.sales FOR INSERT TO authenticated
  WITH CHECK (
    public.is_owner()
    AND EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id AND p.branch_id = branch_id
    )
  );

-- 5) Trigger uses NEW.branch_id
CREATE OR REPLACE FUNCTION public.seed_inventory_for_product()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.inventory (product_id, branch_id, stock)
  VALUES (NEW.id, NEW.branch_id, 0)
  ON CONFLICT (product_id, branch_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_product_seed_inventory ON public.products;
CREATE TRIGGER trg_product_seed_inventory
  AFTER INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.seed_inventory_for_product();

CREATE OR REPLACE FUNCTION public.sales_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stock integer;
BEGIN
  SELECT i.stock INTO v_stock
  FROM public.inventory i
  WHERE i.product_id = NEW.product_id AND i.branch_id = NEW.branch_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No inventory row for this product at this branch';
  END IF;

  IF v_stock < NEW.quantity THEN
    RAISE EXCEPTION 'Insufficient stock (available %)', v_stock;
  END IF;

  IF NEW.branch_id <> (SELECT p.branch_id FROM public.products p WHERE p.id = NEW.product_id) THEN
    RAISE EXCEPTION 'Sale branch must match the product''s branch';
  END IF;

  RETURN NEW;
END;
$$;

-- 6) Tell PostgREST to reload (fixes "schema cache" errors for API)
NOTIFY pgrst, 'reload schema';
