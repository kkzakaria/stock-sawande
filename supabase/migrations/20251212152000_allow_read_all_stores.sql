-- Allow all authenticated users to READ store information
-- This enables managers/cashiers to see store names in inventory breakdown
-- Write operations remain restricted to admins

-- Drop the existing restrictive read policy
DROP POLICY IF EXISTS "Users can view stores" ON public.stores;

-- Create new policy that allows reading all stores
CREATE POLICY "Authenticated users can view all stores"
  ON public.stores
  FOR SELECT
  TO authenticated
  USING (true);

-- Note: Insert/Update/Delete policies remain unchanged - only admins can modify stores

COMMENT ON POLICY "Authenticated users can view all stores" ON public.stores IS
  'Allows all authenticated users to read all stores. This enables visibility of store names in inventory breakdown for coordination purposes.';
