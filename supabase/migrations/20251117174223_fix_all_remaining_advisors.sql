-- ============================================================================
-- FIX ALL REMAINING ADVISORS (8 warnings total)
-- ============================================================================
-- This migration addresses all remaining Supabase security and performance warnings:
-- SECURITY (5): Add immutable search_path to SECURITY DEFINER functions
-- PERFORMANCE (3): Combine multiple permissive policies into single policies
-- ============================================================================

-- ============================================================================
-- PART 1: SECURITY - Add SET search_path to SECURITY DEFINER functions
-- ============================================================================
-- Reference: https://supabase.com/docs/guides/database/database-linter?queryGroups=lint&lint=0011_function_search_path_mutable
-- SECURITY DEFINER functions with mutable search_path are vulnerable to schema injection attacks

-- Fix 1: change_user_role function
DROP FUNCTION IF EXISTS public.change_user_role(text, text) CASCADE;
CREATE FUNCTION public.change_user_role(user_email text, new_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.profiles
  SET role = new_role::public.user_role
  WHERE id = (SELECT id FROM auth.users WHERE email = user_email);
END;
$$;

GRANT EXECUTE ON FUNCTION public.change_user_role(text, text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.change_user_role(text, text) FROM anon, authenticated;

COMMENT ON FUNCTION public.change_user_role(text, text) IS
  'Admin-only function to change user roles. Only accessible via service_role. SET search_path prevents schema injection attacks.';

-- Fix 2: handle_new_user function
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
    'employee'::public.user_role
  );
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;

COMMENT ON FUNCTION public.handle_new_user() IS
  'Trigger function - automatically creates profile for new users. Internal use only. SET search_path prevents schema injection attacks.';

-- Recreate trigger for handle_new_user
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Fix 3: handle_updated_at function
DROP FUNCTION IF EXISTS public.handle_updated_at() CASCADE;
CREATE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_updated_at() FROM anon, authenticated, public;

COMMENT ON FUNCTION public.handle_updated_at() IS
  'Trigger function - automatically updates updated_at timestamps. Internal use only. SET search_path prevents schema injection attacks.';

-- Recreate triggers for handle_updated_at
DROP TRIGGER IF EXISTS handle_updated_at ON public.profiles;
CREATE TRIGGER handle_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS handle_updated_at ON public.categories;
CREATE TRIGGER handle_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS handle_updated_at ON public.products;
CREATE TRIGGER handle_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS handle_updated_at ON public.stores;
CREATE TRIGGER handle_updated_at
  BEFORE UPDATE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Fix 4: update_updated_at_column function
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;
CREATE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;

COMMENT ON FUNCTION public.update_updated_at_column() IS
  'Trigger function - helper for updating timestamps. Internal use only. SET search_path prevents schema injection attacks.';

-- Fix 5: create_stock_movement_on_product_update function
DROP FUNCTION IF EXISTS public.create_stock_movement_on_product_update() CASCADE;
CREATE FUNCTION public.create_stock_movement_on_product_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.quantity IS DISTINCT FROM NEW.quantity THEN
    INSERT INTO public.stock_movements (
      product_id,
      store_id,
      quantity,
      movement_type,
      user_id,
      notes
    )
    VALUES (
      NEW.id,
      NEW.store_id,
      NEW.quantity - OLD.quantity,
      CASE
        WHEN NEW.quantity > OLD.quantity THEN 'in'::public.movement_type
        ELSE 'out'::public.movement_type
      END,
      auth.uid(),
      'Automatic stock movement from product update'
    );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_stock_movement_on_product_update() FROM anon, authenticated, public;

COMMENT ON FUNCTION public.create_stock_movement_on_product_update() IS
  'Trigger function - creates stock movement records on product updates. Internal use only. SET search_path prevents schema injection attacks.';

-- Recreate trigger for create_stock_movement_on_product_update
DROP TRIGGER IF EXISTS create_stock_movement_on_product_update ON public.products;
CREATE TRIGGER create_stock_movement_on_product_update
  AFTER UPDATE OF quantity ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.create_stock_movement_on_product_update();

-- ============================================================================
-- PART 2: PERFORMANCE - Combine multiple permissive policies
-- ============================================================================
-- Reference: Supabase recommends combining multiple permissive policies into single policies
-- Multiple policies cause PostgreSQL to evaluate each one, reducing performance

-- Performance Fix 1: Combine 3 SELECT policies on profiles table
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Managers can view store profiles" ON public.profiles;

CREATE POLICY "Users can view profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR (SELECT public.get_current_user_role()) = 'admin'
    OR (
      (SELECT public.get_current_user_role()) = 'manager'
      AND store_id = (SELECT public.get_current_user_store_id())
    )
  );

COMMENT ON POLICY "Users can view profiles" ON public.profiles IS
  'Combined SELECT policy: users see own profile, admins see all, managers see their store. Performance: Single policy evaluation instead of 3 separate checks.';

-- Performance Fix 2: Combine 2 UPDATE policies on profiles table
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

CREATE POLICY "Users can update profiles"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR (SELECT public.get_current_user_role()) = 'admin'
  )
  WITH CHECK (
    id = (SELECT auth.uid())
    OR (SELECT public.get_current_user_role()) = 'admin'
  );

COMMENT ON POLICY "Users can update profiles" ON public.profiles IS
  'Combined UPDATE policy: users update own profile, admins update all. Performance: Single policy evaluation instead of 2 separate checks.';

-- Performance Fix 3: Combine 2 SELECT policies on stores table
DROP POLICY IF EXISTS "Admins can view all stores" ON public.stores;
DROP POLICY IF EXISTS "Users can view their own store" ON public.stores;

CREATE POLICY "Users can view stores"
  ON public.stores FOR SELECT
  TO authenticated
  USING (
    (SELECT public.get_current_user_role()) = 'admin'
    OR id = (SELECT public.get_current_user_store_id())
  );

COMMENT ON POLICY "Users can view stores" ON public.stores IS
  'Combined SELECT policy: admins see all stores, users see their own. Performance: Single policy evaluation instead of 2 separate checks.';
