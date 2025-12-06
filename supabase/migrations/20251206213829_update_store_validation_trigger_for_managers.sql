-- Migration: Update store validation trigger to allow managers to change to assigned stores
-- Purpose: Managers can switch between their assigned stores (from user_stores table)

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS validate_store_id_update_trigger ON public.profiles;
DROP FUNCTION IF EXISTS public.validate_store_id_update();

-- Create updated validation function
CREATE OR REPLACE FUNCTION public.validate_store_id_update()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  user_role public.user_role;
  is_store_assigned BOOLEAN;
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

    -- Managers can update their own store_id, but only to stores they are assigned to
    IF user_role = 'manager' THEN
      -- Check if the new store_id is in the user's assigned stores
      SELECT EXISTS (
        SELECT 1
        FROM public.user_stores
        WHERE user_id = auth.uid()
          AND store_id = NEW.store_id
      ) INTO is_store_assigned;

      IF NOT is_store_assigned THEN
        RAISE EXCEPTION 'Managers can only select stores they are assigned to. Contact an administrator to assign you to this store.';
      END IF;

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
  'Validates store_id updates: admins can update any, managers can update to their assigned stores (from user_stores), cashiers cannot update their store_id';

-- Recreate trigger
CREATE TRIGGER validate_store_id_update_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_store_id_update();

COMMENT ON TRIGGER validate_store_id_update_trigger ON public.profiles IS
  'Enforces store_id update rules: managers can switch between assigned stores, cashiers have fixed stores, admins unrestricted';
