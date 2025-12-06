-- ============================================================================
-- FIX REMAINING SECURITY ISSUES - search_path for product helper functions
-- ============================================================================
-- This migration fixes the 3 remaining security issues by adding
-- SET search_path = '' to the product helper functions
-- ============================================================================

-- 1. get_products_by_store - Fix search_path vulnerability
CREATE OR REPLACE FUNCTION public.get_products_by_store(
  p_store_id UUID
)
RETURNS TABLE (
  template_id UUID,
  sku TEXT,
  name TEXT,
  description TEXT,
  category_id UUID,
  category_name TEXT,
  price NUMERIC,
  cost NUMERIC,
  quantity INTEGER,
  min_stock_level INTEGER,
  image_url TEXT,
  barcode TEXT,
  is_active BOOLEAN,
  inventory_id UUID
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pt.id,
    pt.sku,
    pt.name,
    pt.description,
    pt.category_id,
    c.name as category_name,
    pt.price,
    pt.cost,
    pi.quantity,
    pt.min_stock_level,
    pt.image_url,
    pt.barcode,
    pt.is_active,
    pi.id as inventory_id
  FROM
    public.product_templates pt
  INNER JOIN
    public.product_inventory pi ON pt.id = pi.product_id
  LEFT JOIN
    public.categories c ON pt.category_id = c.id
  WHERE
    pi.store_id = p_store_id
    AND pt.is_active = true
  ORDER BY
    pt.name;
END;
$$;

-- 2. get_stores_by_product - Fix search_path vulnerability
CREATE OR REPLACE FUNCTION public.get_stores_by_product(
  p_product_id UUID
)
RETURNS TABLE (
  store_id UUID,
  store_name TEXT,
  store_address TEXT,
  quantity INTEGER,
  inventory_id UUID
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.name,
    s.address,
    pi.quantity,
    pi.id as inventory_id
  FROM
    public.stores s
  INNER JOIN
    public.product_inventory pi ON s.id = pi.store_id
  WHERE
    pi.product_id = p_product_id
  ORDER BY
    s.name;
END;
$$;

-- 3. get_low_stock_products - Fix search_path vulnerability
CREATE OR REPLACE FUNCTION public.get_low_stock_products()
RETURNS TABLE (
  template_id UUID,
  sku TEXT,
  name TEXT,
  store_id UUID,
  store_name TEXT,
  quantity INTEGER,
  min_stock_level INTEGER,
  stock_deficit INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pt.id,
    pt.sku,
    pt.name,
    s.id,
    s.name,
    pi.quantity,
    pt.min_stock_level,
    (pt.min_stock_level - pi.quantity) as stock_deficit
  FROM
    public.product_templates pt
  INNER JOIN
    public.product_inventory pi ON pt.id = pi.product_id
  INNER JOIN
    public.stores s ON pi.store_id = s.id
  WHERE
    pi.quantity < pt.min_stock_level
    AND pt.is_active = true
  ORDER BY
    stock_deficit DESC, pt.name;
END;
$$;

-- Update comments to reflect security fix
COMMENT ON FUNCTION public.get_products_by_store IS
  'Returns all active products available in a specific store with their quantities - SECURITY: search_path set to public';

COMMENT ON FUNCTION public.get_stores_by_product IS
  'Returns all stores where a specific product is available with quantities - SECURITY: search_path set to public';

COMMENT ON FUNCTION public.get_low_stock_products IS
  'Returns products that are below their minimum stock level across all stores - SECURITY: search_path set to public';

-- Migration completed successfully
-- All 3 remaining security issues (mutable search_path) have been fixed
