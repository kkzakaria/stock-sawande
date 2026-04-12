-- CR2: Fix user_has_store_access fallback to only fire when user has NO user_stores rows
CREATE OR REPLACE FUNCTION public.user_has_store_access(target_store_id uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
  SELECT CASE
    WHEN target_store_id IS NULL THEN false
    WHEN (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid()) AND deleted_at IS NULL) = 'admin'::public.user_role THEN true
    WHEN EXISTS (
      SELECT 1 FROM public.user_stores us
      JOIN public.profiles p ON p.id = us.user_id AND p.deleted_at IS NULL
      WHERE us.user_id = (SELECT auth.uid()) AND us.store_id = target_store_id
    ) THEN true
    WHEN NOT EXISTS (
      SELECT 1 FROM public.user_stores WHERE user_id = (SELECT auth.uid())
    ) AND (
      SELECT store_id FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND deleted_at IS NULL
    ) = target_store_id THEN true
    ELSE false
  END;
$$;

-- CR6: Partial UNIQUE index to enforce at most one is_default=true per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_stores_one_default_per_user
  ON public.user_stores (user_id) WHERE is_default = true;
