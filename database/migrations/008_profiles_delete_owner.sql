-- ---------------------------------------------------------------------------
-- Allow owner to delete team member profiles
-- ---------------------------------------------------------------------------
-- Run in Supabase SQL Editor.

CREATE POLICY profiles_delete_owner ON public.profiles FOR DELETE TO authenticated
  USING (public.is_owner());

NOTIFY pgrst, 'reload schema';
