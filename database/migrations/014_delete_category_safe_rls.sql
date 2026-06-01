-- Fix delete_category_safe: bypass RLS inside the function and fail clearly if products remain.

CREATE OR REPLACE FUNCTION public.delete_category_safe(p_category_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_branch_id uuid;
  v_fallback_id uuid;
  v_active integer;
  v_remaining integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

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
      BEGIN
        INSERT INTO public.categories (branch_id, name)
        VALUES (v_branch_id, 'General')
        RETURNING id INTO v_fallback_id;
      EXCEPTION
        WHEN unique_violation THEN
          SELECT id INTO v_fallback_id
          FROM public.categories
          WHERE branch_id = v_branch_id
            AND id <> p_category_id
          ORDER BY name
          LIMIT 1;
      END;
    END IF;

    IF v_fallback_id IS NULL THEN
      RAISE EXCEPTION 'Need another category in this branch before deleting this one';
    END IF;

    UPDATE public.products
    SET
      category_id = v_fallback_id,
      subcategory_id = NULL,
      branch_id = v_branch_id
    WHERE category_id = p_category_id;

    SELECT COUNT(*)::integer INTO v_remaining
    FROM public.products
    WHERE category_id = p_category_id;

    IF v_remaining > 0 THEN
      RAISE EXCEPTION 'Could not reassign % product(s) off this category', v_remaining;
    END IF;
  END IF;

  DELETE FROM public.categories WHERE id = p_category_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_category_safe(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_category_safe(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_category_safe(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
