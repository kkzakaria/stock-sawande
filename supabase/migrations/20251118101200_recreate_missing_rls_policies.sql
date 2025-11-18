-- ============================================================================
-- RECREATE MISSING RLS POLICIES
-- ============================================================================
-- The previous migration (20251117174223_fix_all_remaining_advisors.sql)
-- dropped functions with CASCADE which removed dependent policies,
-- but only recreated policies for profiles and stores tables.
-- This migration recreates the missing policies for:
-- - products
-- - categories
-- - stock_movements
-- ============================================================================

-- ============================================================================
-- CATEGORIES POLICIES
-- ============================================================================

-- Drop existing policies if any (just to be safe)
DROP POLICY IF EXISTS "Anyone can view categories" ON public.categories;
DROP POLICY IF EXISTS "Admin and managers can insert categories" ON public.categories;
DROP POLICY IF EXISTS "Admin and managers can update categories" ON public.categories;
DROP POLICY IF EXISTS "Admin and managers can delete categories" ON public.categories;

CREATE POLICY "Anyone can view categories"
  ON public.categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin and managers can insert categories"
  ON public.categories FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT public.get_current_user_role()) = ANY(ARRAY['admin'::user_role, 'manager'::user_role])
  );

CREATE POLICY "Admin and managers can update categories"
  ON public.categories FOR UPDATE
  TO authenticated
  USING (
    (SELECT public.get_current_user_role()) = ANY(ARRAY['admin'::user_role, 'manager'::user_role])
  );

CREATE POLICY "Admin and managers can delete categories"
  ON public.categories FOR DELETE
  TO authenticated
  USING (
    (SELECT public.get_current_user_role()) = ANY(ARRAY['admin'::user_role, 'manager'::user_role])
  );

-- ============================================================================
-- PRODUCTS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users can view products from their store" ON public.products;
DROP POLICY IF EXISTS "Admin and managers can insert products" ON public.products;
DROP POLICY IF EXISTS "Admin and managers can update products" ON public.products;
DROP POLICY IF EXISTS "Admin and managers can delete products" ON public.products;

-- Optimized SELECT policy for products
CREATE POLICY "Users can view products from their store"
  ON public.products FOR SELECT
  TO authenticated
  USING (
    (SELECT public.get_current_user_role()) = 'admin'
    OR store_id = (SELECT public.get_current_user_store_id())
  );

-- Optimized INSERT policy for products
CREATE POLICY "Admin and managers can insert products"
  ON public.products FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT public.get_current_user_role()) = ANY(ARRAY['admin'::user_role, 'manager'::user_role])
    AND (
      (SELECT public.get_current_user_role()) = 'admin'
      OR store_id = (SELECT public.get_current_user_store_id())
    )
  );

-- Optimized UPDATE policy for products
CREATE POLICY "Admin and managers can update products"
  ON public.products FOR UPDATE
  TO authenticated
  USING (
    (SELECT public.get_current_user_role()) = ANY(ARRAY['admin'::user_role, 'manager'::user_role])
    AND (
      (SELECT public.get_current_user_role()) = 'admin'
      OR store_id = (SELECT public.get_current_user_store_id())
    )
  )
  WITH CHECK (
    (SELECT public.get_current_user_role()) = ANY(ARRAY['admin'::user_role, 'manager'::user_role])
    AND (
      (SELECT public.get_current_user_role()) = 'admin'
      OR store_id = (SELECT public.get_current_user_store_id())
    )
  );

-- Optimized DELETE policy for products
CREATE POLICY "Admin and managers can delete products"
  ON public.products FOR DELETE
  TO authenticated
  USING (
    (SELECT public.get_current_user_role()) = ANY(ARRAY['admin'::user_role, 'manager'::user_role])
    AND (
      (SELECT public.get_current_user_role()) = 'admin'
      OR store_id = (SELECT public.get_current_user_store_id())
    )
  );

-- ============================================================================
-- STOCK_MOVEMENTS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users can view stock movements from their store" ON public.stock_movements;
DROP POLICY IF EXISTS "Authenticated users can insert stock movements" ON public.stock_movements;

-- Optimized SELECT policy for stock_movements
CREATE POLICY "Users can view stock movements from their store"
  ON public.stock_movements FOR SELECT
  TO authenticated
  USING (
    (SELECT public.get_current_user_role()) = 'admin'
    OR store_id = (SELECT public.get_current_user_store_id())
  );

-- Optimized INSERT policy for stock_movements
CREATE POLICY "Authenticated users can insert stock movements"
  ON public.stock_movements FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      (SELECT public.get_current_user_role()) = 'admin'
      OR store_id = (SELECT public.get_current_user_store_id())
    )
    AND user_id = (SELECT auth.uid())
  );

-- ============================================================================
-- VERIFICATION
-- ============================================================================

COMMENT ON POLICY "Users can view products from their store" ON public.products IS
  'Recreated: Users can view products from their assigned store, admins can view all products';

COMMENT ON POLICY "Users can view stock movements from their store" ON public.stock_movements IS
  'Recreated: Users can view stock movements from their assigned store, admins can view all movements';
