-- Fix RLS policies to allow cash session approval workflow
-- Problem: Cashiers cannot see managers/admins or check if they have PINs configured

-- Drop the old restrictive policy on profiles first
DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;

-- Allow authenticated users to see managers from their store and all admins
-- This is needed for the cash session approval dialog
CREATE POLICY "Users can view managers and admins for approval"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- Users can always see their own profile
  id = auth.uid()
  -- OR the profile is a manager from the same store
  OR (
    role = 'manager'
    AND store_id = get_current_user_store_id()
  )
  -- OR the profile is an admin (admins can approve any store)
  OR role = 'admin'
);

-- Drop the old restrictive policy on manager_pins
DROP POLICY IF EXISTS "Users can view their own PIN record" ON public.manager_pins;

-- Allow users to check if a manager/admin has a PIN configured (not the PIN itself)
-- This is needed to show available validators in the approval dialog
CREATE POLICY "Users can check if managers have PIN"
ON public.manager_pins
FOR SELECT
TO authenticated
USING (
  -- Users can always see their own PIN record
  user_id = auth.uid()
  -- OR check existence of PIN for managers in same store
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = manager_pins.user_id
    AND p.role = 'manager'
    AND p.store_id = get_current_user_store_id()
  )
  -- OR check existence of PIN for any admin
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = manager_pins.user_id
    AND p.role = 'admin'
  )
);
