-- Allow all authenticated users to READ product inventory from any store
-- This enables managers/cashiers to see total stock across all stores
-- Write operations remain restricted to their own store

-- Drop the existing restrictive read policy
DROP POLICY IF EXISTS "Users can view inventory from their store" ON public.product_inventory;

-- Create new policy that allows reading all inventory
CREATE POLICY "Authenticated users can view all inventory"
  ON public.product_inventory
  FOR SELECT
  TO authenticated
  USING (true);

-- Note: Insert/Update/Delete policies remain unchanged - users can only modify their store's inventory

COMMENT ON POLICY "Authenticated users can view all inventory" ON public.product_inventory IS
  'Allows all authenticated users to read inventory from any store. This enables visibility of total stock across all stores for coordination purposes.';
