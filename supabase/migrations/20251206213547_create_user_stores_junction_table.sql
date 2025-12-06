-- Migration: Create user_stores junction table for multi-store assignments
-- Purpose: Allow managers to be assigned to multiple stores
-- Architecture: profiles.store_id = current active store, user_stores = all assigned stores

-- ============================================================================
-- CREATE TABLE: user_stores
-- ============================================================================
-- Junction table for many-to-many relationship between users and stores

CREATE TABLE IF NOT EXISTS public.user_stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Each user can be assigned to a store only once
  CONSTRAINT user_stores_user_store_unique UNIQUE (user_id, store_id)
);

COMMENT ON TABLE public.user_stores IS
  'Junction table for user-store assignments. Managers can have multiple stores, cashiers typically one.';

COMMENT ON COLUMN public.user_stores.is_default IS
  'Indicates the default/preferred store for this user among their assigned stores.';

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_user_stores_user_id ON public.user_stores(user_id);
CREATE INDEX idx_user_stores_store_id ON public.user_stores(store_id);
CREATE INDEX idx_user_stores_default ON public.user_stores(user_id) WHERE is_default = true;

-- ============================================================================
-- MIGRATE EXISTING DATA
-- ============================================================================
-- Copy existing store assignments from profiles.store_id to user_stores

INSERT INTO public.user_stores (user_id, store_id, is_default)
SELECT
  id as user_id,
  store_id,
  true as is_default
FROM public.profiles
WHERE store_id IS NOT NULL
ON CONFLICT (user_id, store_id) DO NOTHING;

COMMENT ON CONSTRAINT user_stores_user_store_unique ON public.user_stores IS
  'Prevents duplicate user-store assignments';

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE public.user_stores ENABLE ROW LEVEL SECURITY;

-- Admins can see all assignments
-- Users can see their own assignments
CREATE POLICY "Users can view their store assignments"
  ON public.user_stores FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (SELECT public.get_current_user_role()) = 'admin'
  );

-- Only admins can insert store assignments
CREATE POLICY "Admins can create store assignments"
  ON public.user_stores FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT public.get_current_user_role()) = 'admin'
  );

-- Only admins can update store assignments
CREATE POLICY "Admins can update store assignments"
  ON public.user_stores FOR UPDATE
  TO authenticated
  USING (
    (SELECT public.get_current_user_role()) = 'admin'
  )
  WITH CHECK (
    (SELECT public.get_current_user_role()) = 'admin'
  );

-- Only admins can delete store assignments
CREATE POLICY "Admins can delete store assignments"
  ON public.user_stores FOR DELETE
  TO authenticated
  USING (
    (SELECT public.get_current_user_role()) = 'admin'
  );

-- ============================================================================
-- UPDATED STORES VIEW POLICY
-- ============================================================================
-- Now managers can see their assigned stores, not all stores

DROP POLICY IF EXISTS "Users can view stores" ON public.stores;

CREATE POLICY "Users can view stores"
  ON public.stores FOR SELECT
  TO authenticated
  USING (
    -- Admins can see all stores
    (SELECT public.get_current_user_role()) = 'admin'
    -- Users can see stores they are assigned to
    OR id IN (
      SELECT store_id
      FROM public.user_stores
      WHERE user_id = auth.uid()
    )
    -- Fallback: users can see their currently active store (for backwards compatibility)
    OR id = (SELECT public.get_current_user_store_id())
  );

COMMENT ON POLICY "Users can view stores" ON public.stores IS
  'SELECT policy: admins see all stores, users see stores they are assigned to via user_stores table.';

-- ============================================================================
-- HELPER FUNCTION: Get user assigned stores
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_assigned_stores(p_user_id UUID)
RETURNS TABLE (
  store_id UUID,
  store_name TEXT,
  is_default BOOLEAN,
  address TEXT,
  phone TEXT,
  email TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id as store_id,
    s.name as store_name,
    us.is_default,
    s.address,
    s.phone,
    s.email
  FROM public.user_stores us
  INNER JOIN public.stores s ON us.store_id = s.id
  WHERE us.user_id = p_user_id
  ORDER BY us.is_default DESC, s.name;
END;
$$;

COMMENT ON FUNCTION public.get_user_assigned_stores IS
  'Returns all stores assigned to a user, with default store first';

-- ============================================================================
-- UPDATED AT TRIGGER
-- ============================================================================

CREATE TRIGGER update_user_stores_updated_at
  BEFORE UPDATE ON public.user_stores
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
