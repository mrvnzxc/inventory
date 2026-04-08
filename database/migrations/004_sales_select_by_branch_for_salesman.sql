-- ---------------------------------------------------------------------------
-- Sales history visibility: salesmen can see all sales in their assigned branch
-- ---------------------------------------------------------------------------
-- Run in Supabase SQL Editor.

DROP POLICY IF EXISTS sales_select ON public.sales;
CREATE POLICY sales_select ON public.sales FOR SELECT TO authenticated
  USING (
    public.is_owner()
    OR branch_id = public.my_branch_id()
  );

NOTIFY pgrst, 'reload schema';
