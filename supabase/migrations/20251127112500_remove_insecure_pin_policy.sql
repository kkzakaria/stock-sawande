-- Remove insecure RLS policy that allows users to check if others have PINs
-- PIN existence should only be checked server-side via API

DROP POLICY IF EXISTS "Users can check if managers have PIN" ON public.manager_pins;

-- Users can ONLY view/manage their own PIN
CREATE POLICY "Users can view own PIN only"
ON public.manager_pins
FOR SELECT
TO authenticated
USING (user_id = auth.uid());
