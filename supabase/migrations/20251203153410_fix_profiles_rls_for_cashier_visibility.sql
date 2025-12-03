-- Fix profiles RLS policy to allow viewing cashier names in sales table
-- The previous policy was too restrictive and blocked joins from sales to profiles

-- Drop the restrictive SELECT policy
DROP POLICY IF EXISTS "Users can view managers and admins for approval" ON profiles;

-- Create a new policy that allows authenticated users to see all profiles
-- This is needed for joins (e.g., seeing cashier names in sales table)
CREATE POLICY "Authenticated users can view all profiles" ON profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Add comment explaining the change
COMMENT ON POLICY "Authenticated users can view all profiles" ON profiles IS
  'Allows authenticated users to view all profiles. Required for displaying user names in related tables (sales, etc.)';
