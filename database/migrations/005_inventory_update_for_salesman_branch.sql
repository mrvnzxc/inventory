-- ---------------------------------------------------------------------------
-- Allow salesmen to update stock for their assigned branch
-- ---------------------------------------------------------------------------
-- Run in Supabase SQL Editor.

DROP POLICY IF EXISTS inventory_write ON public.inventory;

CREATE POLICY inventory_write ON public.inventory FOR ALL TO authenticated
  USING (
    public.is_owner()
    OR branch_id = public.my_branch_id()
  )
  WITH CHECK (
    public.is_owner()
    OR branch_id = public.my_branch_id()
  );

NOTIFY pgrst, 'reload schema';
