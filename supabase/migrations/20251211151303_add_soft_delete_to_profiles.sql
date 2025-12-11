-- Migration: Add soft delete to profiles
-- Purpose: Allow "deleting" users while preserving referential integrity for sales/cash_sessions history
-- Architecture: deleted_at field + RLS policies exclude deleted users from normal queries

-- ============================================================================
-- 1. ADD SOFT DELETE COLUMN TO PROFILES
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN public.profiles.deleted_at IS
  'Soft delete timestamp. NULL = active user, NOT NULL = deleted user. Preserves sales/session history.';

-- Index for filtering active users efficiently
CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at
  ON public.profiles(deleted_at)
  WHERE deleted_at IS NULL;

-- ============================================================================
-- 2. UPDATE FOREIGN KEY CONSTRAINTS
-- ============================================================================
-- Change cash_sessions.approved_by to SET NULL on delete

ALTER TABLE public.cash_sessions
  DROP CONSTRAINT IF EXISTS cash_sessions_approved_by_fkey;

ALTER TABLE public.cash_sessions
  ADD CONSTRAINT cash_sessions_approved_by_fkey
    FOREIGN KEY (approved_by) REFERENCES public.profiles(id)
    ON DELETE SET NULL;

-- ============================================================================
-- 3. SOFT DELETE FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.soft_delete_user(target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_role public.user_role;
  target_email TEXT;
  sales_count INTEGER;
  sessions_count INTEGER;
BEGIN
  -- Check if current user is admin
  SELECT role INTO current_user_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF current_user_role != 'admin' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only admins can delete users'
    );
  END IF;

  -- Prevent self-deletion
  IF target_user_id = auth.uid() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cannot delete your own account'
    );
  END IF;

  -- Get user info
  SELECT email INTO target_email
  FROM public.profiles
  WHERE id = target_user_id AND deleted_at IS NULL;

  IF target_email IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found or already deleted'
    );
  END IF;

  -- Count related records for info
  SELECT COUNT(*) INTO sales_count
  FROM public.sales
  WHERE cashier_id = target_user_id;

  SELECT COUNT(*) INTO sessions_count
  FROM public.cash_sessions
  WHERE cashier_id = target_user_id;

  -- Perform soft delete
  UPDATE public.profiles
  SET
    deleted_at = NOW(),
    updated_at = NOW()
  WHERE id = target_user_id;

  -- Remove from user_stores (clean up assignments)
  DELETE FROM public.user_stores
  WHERE user_id = target_user_id;

  -- Remove manager PIN
  DELETE FROM public.manager_pins
  WHERE user_id = target_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'User soft deleted successfully',
    'user_email', target_email,
    'preserved_records', jsonb_build_object(
      'sales', sales_count,
      'cash_sessions', sessions_count
    )
  );
END;
$$;

COMMENT ON FUNCTION public.soft_delete_user IS
  'Soft deletes a user by setting deleted_at. Preserves sales/session history. Admin only.';

GRANT EXECUTE ON FUNCTION public.soft_delete_user TO authenticated;

-- ============================================================================
-- 4. RESTORE USER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.restore_deleted_user(target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_role public.user_role;
  target_email TEXT;
BEGIN
  -- Check if current user is admin
  SELECT role INTO current_user_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF current_user_role != 'admin' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only admins can restore users'
    );
  END IF;

  -- Get deleted user info
  SELECT email INTO target_email
  FROM public.profiles
  WHERE id = target_user_id AND deleted_at IS NOT NULL;

  IF target_email IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found or not deleted'
    );
  END IF;

  -- Restore user
  UPDATE public.profiles
  SET
    deleted_at = NULL,
    updated_at = NOW()
  WHERE id = target_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'User restored successfully',
    'user_email', target_email
  );
END;
$$;

COMMENT ON FUNCTION public.restore_deleted_user IS
  'Restores a soft-deleted user. Admin only.';

GRANT EXECUTE ON FUNCTION public.restore_deleted_user TO authenticated;

-- ============================================================================
-- 5. UPDATE RLS POLICIES TO EXCLUDE DELETED USERS
-- ============================================================================

-- Drop existing policies that need updating
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Managers can view store profiles" ON public.profiles;

-- Users can view their own profile (even if deleted, for edge cases)
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Admins can view all profiles (including deleted for management)
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- Managers can view active profiles in their store only
CREATE POLICY "Managers can view store profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles AS manager
      WHERE manager.id = auth.uid()
      AND manager.role = 'manager'
      AND manager.store_id = profiles.store_id
      AND manager.deleted_at IS NULL
    )
  );

-- ============================================================================
-- 6. HELPER FUNCTION: Check if user is active
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_user_active(check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = check_user_id AND deleted_at IS NULL
  );
$$;

COMMENT ON FUNCTION public.is_user_active IS
  'Returns true if user exists and is not soft-deleted';

GRANT EXECUTE ON FUNCTION public.is_user_active TO authenticated;

-- ============================================================================
-- 7. VIEW FOR ACTIVE USERS ONLY
-- ============================================================================

CREATE OR REPLACE VIEW public.active_profiles AS
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

COMMENT ON VIEW public.active_profiles IS
  'View showing only active (non-deleted) user profiles';

GRANT SELECT ON public.active_profiles TO authenticated;

-- ============================================================================
-- 8. UPDATE get_current_user_role TO CHECK DELETED STATUS
-- ============================================================================

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
  AND deleted_at IS NULL;
$$;

COMMENT ON FUNCTION public.get_current_user_role IS
  'Returns current user role, NULL if user is deleted or not found';
