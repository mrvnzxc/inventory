-- Safe category delete: block if active products exist; reassign archived (or any remaining) products, then delete.
-- Run in Supabase SQL Editor if category delete hits products_category_id_fkey.

CREATE OR REPLACE FUNCTION public.delete_category_safe(p_category_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_branch_id uuid;
  v_fallback_id uuid;
  v_active integer;
BEGIN
  IF NOT public.is_owner() THEN
    RAISE EXCEPTION 'Only owners can delete categories';
  END IF;

  SELECT branch_id INTO v_branch_id
  FROM public.categories
  WHERE id = p_category_id;

  IF v_branch_id IS NULL THEN
    RAISE EXCEPTION 'Category not found';
  END IF;

  SELECT COUNT(*)::integer INTO v_active
  FROM public.products
  WHERE category_id = p_category_id
    AND deleted_at IS NULL;

  IF v_active > 0 THEN
    RAISE EXCEPTION 'Cannot delete: % active product(s) still use this category', v_active;
  END IF;

  IF EXISTS (SELECT 1 FROM public.products WHERE category_id = p_category_id) THEN
    SELECT id INTO v_fallback_id
    FROM public.categories
    WHERE branch_id = v_branch_id
      AND id <> p_category_id
    ORDER BY name
    LIMIT 1;

    IF v_fallback_id IS NULL THEN
      INSERT INTO public.categories (branch_id, name)
      VALUES (v_branch_id, 'General')
      RETURNING id INTO v_fallback_id;
    END IF;

    UPDATE public.products
    SET category_id = v_fallback_id,
        subcategory_id = NULL
    WHERE category_id = p_category_id;
  END IF;

  DELETE FROM public.categories WHERE id = p_category_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_category_safe(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_category_safe(uuid) TO authenticated;
