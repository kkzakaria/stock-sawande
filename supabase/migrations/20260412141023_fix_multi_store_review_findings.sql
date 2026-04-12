-- Migration: fix_multi_store_review_findings
-- C1: Add deleted_at IS NULL to user_has_store_access fallback branches
-- - user_stores branch: join to profiles to exclude soft-deleted users
-- - profiles.store_id fallback branch: filter deleted_at IS NULL

CREATE OR REPLACE FUNCTION public.user_has_store_access(target_store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
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
    WHEN (SELECT store_id FROM public.profiles WHERE id = (SELECT auth.uid()) AND deleted_at IS NULL) = target_store_id THEN true
    ELSE false
  END;
$$;
