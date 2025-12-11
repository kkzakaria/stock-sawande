-- Migration: Fix security and performance advisor warnings
--
-- Security Issues Fixed:
-- 1. active_profiles view with SECURITY DEFINER (security risk)
--
-- Performance Issues Fixed:
-- 1. profiles: Auth RLS Initialization Plan - using SELECT wrapper for auth functions
-- 2. business_settings: Auth RLS Initialization Plan + Multiple Permissive Policies

-- ============================================================================
-- 1. FIX SECURITY: Remove SECURITY DEFINER from active_profiles view
-- ============================================================================

-- Drop the existing view and recreate with explicit SECURITY INVOKER
DROP VIEW IF EXISTS public.active_profiles;

CREATE VIEW public.active_profiles
WITH (security_invoker = true)
AS
SELECT
  id,
  email,
  role,
  store_id,
  full_name,
  avatar_url,
  created_at,
  updated_at
FROM public.profiles
WHERE deleted_at IS NULL;

-- Use SECURITY INVOKER - respects the querying user's permissions
COMMENT ON VIEW public.active_profiles IS
  'View showing only active (non-deleted) user profiles. Uses SECURITY INVOKER.';

GRANT SELECT ON public.active_profiles TO authenticated;

-- ============================================================================
-- 2. FIX PERFORMANCE: Optimize profiles RLS policies
-- ============================================================================
-- Problem: Using auth.uid() directly causes per-row evaluation
-- Solution: Wrap with (SELECT ...) for init plan caching (evaluated once per query)

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;

-- Recreate with optimized expressions (using SELECT wrapper for init plan)
CREATE POLICY "Admins can insert profiles"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT get_current_user_role()) = 'admin');

CREATE POLICY "Admins can delete profiles"
  ON public.profiles FOR DELETE
  TO authenticated
  USING ((SELECT get_current_user_role()) = 'admin');

CREATE POLICY "Users can update profiles"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()) OR (SELECT get_current_user_role()) = 'admin')
  WITH CHECK (id = (SELECT auth.uid()) OR (SELECT get_current_user_role()) = 'admin');

-- Recreate profiles SELECT policy with SELECT wrapper
CREATE POLICY "profiles_select_policy"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    -- Everyone can see their own profile
    id = (SELECT auth.uid())
    OR
    -- Admins can see all profiles (using SECURITY DEFINER function)
    (SELECT get_current_user_role()) = 'admin'
    OR
    -- Managers can see active profiles in their assigned stores
    (
      (SELECT get_current_user_role()) = 'manager'
      AND deleted_at IS NULL
    )
    OR
    -- Cashiers can see active profiles (for display purposes like cashier names)
    (
      (SELECT get_current_user_role()) = 'cashier'
      AND deleted_at IS NULL
    )
  );

-- ============================================================================
-- 3. FIX PERFORMANCE: Fix business_settings multiple permissive policies
-- ============================================================================
-- Problem: "Admins can manage" uses polcmd='*' (all commands) which overlaps
-- with "Authenticated users can read" causing multiple permissive policies
-- Solution: Use specific policies for each action without overlap

DROP POLICY IF EXISTS "Admins can manage business settings" ON public.business_settings;
DROP POLICY IF EXISTS "Authenticated users can read business settings" ON public.business_settings;

-- Single SELECT policy (no overlap) - using SELECT wrapper for init plan
CREATE POLICY "business_settings_select"
  ON public.business_settings FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

-- Admin-only INSERT - using SELECT wrapper for init plan
CREATE POLICY "business_settings_insert"
  ON public.business_settings FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT get_current_user_role()) = 'admin');

-- Admin-only UPDATE - using SELECT wrapper for init plan
CREATE POLICY "business_settings_update"
  ON public.business_settings FOR UPDATE
  TO authenticated
  USING ((SELECT get_current_user_role()) = 'admin')
  WITH CHECK ((SELECT get_current_user_role()) = 'admin');

-- Admin-only DELETE - using SELECT wrapper for init plan
CREATE POLICY "business_settings_delete"
  ON public.business_settings FOR DELETE
  TO authenticated
  USING ((SELECT get_current_user_role()) = 'admin');
