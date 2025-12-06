-- Migration: Allow managers to view all stores for store selection
-- Purpose: Managers need to see all stores to be able to select which one to work at

-- Drop existing policy
DROP POLICY IF EXISTS "Users can view stores" ON public.stores;

-- Create new policy: admins and managers can view all stores, cashiers see only their assigned store
CREATE POLICY "Users can view stores"
  ON public.stores FOR SELECT
  TO authenticated
  USING (
    -- Admins and managers can see all stores
    (SELECT public.get_current_user_role()) IN ('admin', 'manager')
    -- Cashiers can only see their assigned store
    OR id = (SELECT public.get_current_user_store_id())
  );

COMMENT ON POLICY "Users can view stores" ON public.stores IS
  'SELECT policy: admins and managers see all stores, cashiers see only their assigned store. Enables store selection for admins/managers.';
