-- Allow deleting a category while keeping products + sales history.
-- Products lose category_id (and subcategories cascade away); archived rows are no longer blocked by FK.

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_category_id_fkey;

ALTER TABLE public.products
  ALTER COLUMN category_id DROP NOT NULL;

ALTER TABLE public.products
  ADD CONSTRAINT products_category_id_fkey
  FOREIGN KEY (category_id)
  REFERENCES public.categories (id)
  ON DELETE SET NULL;

-- Simpler delete: block only when active (non-archived) products still use the category.
CREATE OR REPLACE FUNCTION public.delete_category_safe(p_category_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_active integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_owner() THEN
    RAISE EXCEPTION 'Only owners can delete categories';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.categories WHERE id = p_category_id) THEN
    RAISE EXCEPTION 'Category not found';
  END IF;

  SELECT COUNT(*)::integer INTO v_active
  FROM public.products
  WHERE category_id = p_category_id
    AND deleted_at IS NULL;

  IF v_active > 0 THEN
    RAISE EXCEPTION 'Cannot delete: % active product(s) still use this category', v_active;
  END IF;

  DELETE FROM public.categories WHERE id = p_category_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_category_safe(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_category_safe(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_category_safe(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
