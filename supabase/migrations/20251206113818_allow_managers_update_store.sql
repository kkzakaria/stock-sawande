-- Migration: Allow managers to update their store_id, prevent cashiers from changing it
-- Purpose: Enable store selection for admins and managers in POS system

-- Function to validate store_id updates based on user role
CREATE OR REPLACE FUNCTION public.validate_store_id_update()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  user_role public.user_role;
BEGIN
  -- Get the current user's role
  SELECT role INTO user_role
  FROM public.profiles
  WHERE id = auth.uid();

  -- If store_id is being changed
  IF NEW.store_id IS DISTINCT FROM OLD.store_id THEN
    -- Admins can always update (their own or others)
    IF user_role = 'admin' THEN
      RETURN NEW;
    END IF;

    -- Only allow users to update their own profile
    IF NEW.id != auth.uid() THEN
      RAISE EXCEPTION 'Cannot update store_id for other users';
    END IF;

    -- Managers can update their own store_id
    IF user_role = 'manager' THEN
      RETURN NEW;
    END IF;

    -- Cashiers cannot update their store_id
    IF user_role = 'cashier' THEN
      RAISE EXCEPTION 'Cashiers cannot change their assigned store. Contact an administrator.';
    END IF;
  END IF;

  -- If store_id is not being changed, allow the update
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.validate_store_id_update() IS
  'Validates store_id updates: admins can update any, managers can update their own, cashiers cannot update their store_id';

-- Create trigger on profiles table
DROP TRIGGER IF EXISTS validate_store_id_update_trigger ON public.profiles;

CREATE TRIGGER validate_store_id_update_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_store_id_update();

COMMENT ON TRIGGER validate_store_id_update_trigger ON public.profiles IS
  'Enforces store_id update rules: prevents cashiers from changing their assigned store, allows managers and admins';
