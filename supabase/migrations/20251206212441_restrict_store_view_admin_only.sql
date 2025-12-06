-- Migration: Restrict store selection to admins only
-- Purpose: Only administrators can see all stores and select which one to work at
-- Managers and cashiers are restricted to their assigned store

-- Drop existing policy
DROP POLICY IF EXISTS "Users can view stores" ON public.stores;

-- Create new policy: only admins can view all stores, others see only their assigned store
CREATE POLICY "Users can view stores"
  ON public.stores FOR SELECT
  TO authenticated
  USING (
    -- Admins can see all stores
    (SELECT public.get_current_user_role()) = 'admin'
    -- Managers and cashiers can only see their assigned store
    OR id = (SELECT public.get_current_user_store_id())
  );

COMMENT ON POLICY "Users can view stores" ON public.stores IS
  'SELECT policy: only admins see all stores, managers and cashiers see only their assigned store. Store selection restricted to admins.';
