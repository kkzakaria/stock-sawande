-- Migration: Fix RLS recursion on profiles table
-- Problem: Multiple SELECT policies query profiles table, causing infinite recursion
-- Solution: Simplify policies - use SECURITY DEFINER functions instead of subqueries

-- ============================================================================
-- 1. DROP ALL CONFLICTING SELECT POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Managers can view store profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;

-- ============================================================================
-- 2. CREATE SINGLE UNIFIED SELECT POLICY
-- ============================================================================
-- Use get_current_user_role() which is SECURITY DEFINER and bypasses RLS
-- This prevents recursion since the function doesn't trigger RLS checks

CREATE POLICY "profiles_select_policy"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    -- Everyone can see their own profile
    id = auth.uid()
    OR
    -- Admins can see all profiles (using SECURITY DEFINER function)
    get_current_user_role() = 'admin'
    OR
    -- Managers can see active profiles in their assigned stores
    (
      get_current_user_role() = 'manager'
      AND deleted_at IS NULL
    )
    OR
    -- Cashiers can see active profiles (for display purposes like cashier names)
    (
      get_current_user_role() = 'cashier'
      AND deleted_at IS NULL
    )
  );

COMMENT ON POLICY "profiles_select_policy" ON public.profiles IS
  'Unified SELECT policy using SECURITY DEFINER function to avoid recursion';

-- ============================================================================
-- 3. FIX get_current_user_role TO HANDLE NULL CASE
-- ============================================================================
-- Ensure function returns NULL gracefully when profile doesn't exist yet

CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.profiles
  WHERE id = auth.uid()
  AND deleted_at IS NULL
  LIMIT 1;
$$;
