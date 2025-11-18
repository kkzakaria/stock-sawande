-- ============================================================================
-- FIX handle_new_user() FUNCTION - Correct invalid 'employee' enum value
-- ============================================================================
-- The handle_new_user() function was using 'employee' which doesn't exist in
-- the user_role enum. Valid values are: 'admin', 'manager', 'cashier'
-- This migration corrects the default role to 'cashier'
-- ============================================================================

DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (
    NEW.id,
    NEW.email,
    'cashier'::public.user_role  -- FIXED: Changed from 'employee' to 'cashier'
  );
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;

COMMENT ON FUNCTION public.handle_new_user() IS
  'Trigger function - automatically creates profile for new users with default cashier role. Internal use only. SET search_path prevents schema injection attacks.';

-- Recreate trigger for handle_new_user
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
