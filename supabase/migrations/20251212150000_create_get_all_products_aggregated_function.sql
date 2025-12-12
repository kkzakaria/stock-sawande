-- Create a function that bypasses RLS to get aggregated product data
-- This is needed because the view still respects RLS on underlying tables

CREATE OR REPLACE FUNCTION public.get_all_products_aggregated()
RETURNS TABLE (
  template_id UUID,
  sku TEXT,
  name TEXT,
  description TEXT,
  category_id UUID,
  category_name TEXT,
  price NUMERIC,
  cost NUMERIC,
  min_stock_level INTEGER,
  image_url TEXT,
  barcode TEXT,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  total_quantity INTEGER,
  store_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pt.id as template_id,
    pt.sku,
    pt.name,
    pt.description,
    pt.category_id,
    c.name as category_name,
    pt.price,
    pt.cost,
    pt.min_stock_level,
    pt.image_url,
    pt.barcode,
    pt.is_active,
    pt.created_at,
    pt.updated_at,
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
    pt.cost,
    pt.min_stock_level,
    pt.image_url,
    pt.barcode,
    pt.is_active,
    pt.created_at,
    pt.updated_at,
    c.name;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_all_products_aggregated() TO authenticated;

COMMENT ON FUNCTION public.get_all_products_aggregated IS
  'Returns all products with aggregated quantities across all stores. Uses SECURITY DEFINER to bypass RLS and show true totals.';
