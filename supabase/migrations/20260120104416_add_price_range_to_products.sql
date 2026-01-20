-- Add min_price and max_price columns to product_templates
-- This allows cashiers to adjust prices within an authorized range during POS sales

-- Add the new columns
ALTER TABLE public.product_templates
  ADD COLUMN min_price DECIMAL(12, 2) DEFAULT NULL,
  ADD COLUMN max_price DECIMAL(12, 2) DEFAULT NULL;

-- Add constraint to ensure price range is valid
-- Rules:
-- 1. min_price must be >= 0 (if set)
-- 2. max_price must be >= 0 (if set)
-- 3. min_price <= max_price (if both set)
-- 4. min_price <= price (if min_price set)
-- 5. price <= max_price (if max_price set)
ALTER TABLE public.product_templates
  ADD CONSTRAINT chk_price_range CHECK (
    (min_price IS NULL OR min_price >= 0)
    AND (max_price IS NULL OR max_price >= 0)
    AND (min_price IS NULL OR max_price IS NULL OR min_price <= max_price)
    AND (min_price IS NULL OR min_price <= price)
    AND (max_price IS NULL OR price <= max_price)
  );

-- Add comments for documentation
COMMENT ON COLUMN public.product_templates.min_price IS 'Minimum allowed sale price. NULL means no lower limit (price is fixed).';
COMMENT ON COLUMN public.product_templates.max_price IS 'Maximum allowed sale price. NULL means no upper limit (price is fixed).';

-- Drop and recreate views to add new columns (PostgreSQL doesn't allow column reordering with CREATE OR REPLACE)
DROP VIEW IF EXISTS public.products_aggregated CASCADE;
DROP VIEW IF EXISTS public.products_with_inventory CASCADE;

-- Recreate the products_aggregated view with the new columns
CREATE VIEW public.products_aggregated AS
SELECT
  pt.id as template_id,
  pt.sku,
  pt.name,
  pt.description,
  pt.category_id,
  pt.price,
  pt.min_price,
  pt.max_price,
  pt.cost,
  pt.min_stock_level,
  pt.image_url,
  pt.barcode,
  pt.is_active,
  pt.created_at,
  pt.updated_at,
  c.name as category_name,
  c.description as category_description,
  COALESCE(SUM(pi.quantity), 0)::INTEGER as total_quantity,
  COUNT(DISTINCT pi.store_id)::INTEGER as store_count
FROM
  public.product_templates pt
LEFT JOIN
  public.product_inventory pi ON pt.id = pi.product_id
LEFT JOIN
  public.categories c ON pt.category_id = c.id
GROUP BY
  pt.id,
  pt.sku,
  pt.name,
  pt.description,
  pt.category_id,
  pt.price,
  pt.min_price,
  pt.max_price,
  pt.cost,
  pt.min_stock_level,
  pt.image_url,
  pt.barcode,
  pt.is_active,
  pt.created_at,
  pt.updated_at,
  c.name,
  c.description;

-- Maintain security settings
ALTER VIEW public.products_aggregated SET (security_invoker = true);

COMMENT ON VIEW public.products_aggregated IS 'Aggregates product templates with total quantity across all stores. Returns one row per product with sum of all inventory quantities. Includes min_price and max_price for flexible pricing.';

-- Recreate the products_with_inventory view with the new columns
CREATE VIEW public.products_with_inventory AS
SELECT
  pt.id as template_id,
  pt.sku,
  pt.name,
  pt.description,
  pt.category_id,
  pt.price,
  pt.min_price,
  pt.max_price,
  pt.cost,
  pt.min_stock_level,
  pt.image_url,
  pt.barcode,
  pt.is_active,
  pt.created_at as template_created_at,
  pt.updated_at as template_updated_at,
  pi.id as inventory_id,
  pi.store_id,
  pi.quantity,
  pi.created_at as inventory_created_at,
  pi.updated_at as inventory_updated_at,
  c.name as category_name,
  c.description as category_description,
  s.name as store_name,
  s.address as store_address
FROM
  public.product_templates pt
LEFT JOIN
  public.product_inventory pi ON pt.id = pi.product_id
LEFT JOIN
  public.categories c ON pt.category_id = c.id
LEFT JOIN
  public.stores s ON pi.store_id = s.id;

-- Maintain security settings
ALTER VIEW public.products_with_inventory SET (security_invoker = true);

COMMENT ON VIEW public.products_with_inventory IS 'Combines product templates with their store-specific inventory. Returns one row per product-store combination. Products without inventory in any store will have NULL values for inventory fields. Includes min_price and max_price for flexible pricing.';

-- Drop and recreate the function (PostgreSQL doesn't allow changing return type with CREATE OR REPLACE)
DROP FUNCTION IF EXISTS public.get_products_by_store(UUID);

-- Recreate the get_products_by_store function with min_price and max_price
CREATE FUNCTION public.get_products_by_store(
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
  min_price NUMERIC,
  max_price NUMERIC,
  cost NUMERIC,
  quantity INTEGER,
  min_stock_level INTEGER,
  image_url TEXT,
  barcode TEXT,
  is_active BOOLEAN,
  inventory_id UUID
) AS $$
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
    pt.min_price,
    pt.max_price,
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
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public;

COMMENT ON FUNCTION public.get_products_by_store IS
  'Returns all active products available in a specific store with their quantities, including min_price and max_price for flexible pricing';
