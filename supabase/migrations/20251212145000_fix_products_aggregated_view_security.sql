-- Fix the products_aggregated view to bypass RLS for aggregation
-- This allows all users to see total stock across all stores

-- Drop and recreate the view without security_invoker
DROP VIEW IF EXISTS public.products_aggregated;

CREATE VIEW public.products_aggregated AS
SELECT
  pt.id as template_id,
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
  pt.cost,
  pt.min_stock_level,
  pt.image_url,
  pt.barcode,
  pt.is_active,
  pt.created_at,
  pt.updated_at,
  c.name,
  c.description;

-- Do NOT set security_invoker - this allows the view to bypass RLS
-- and show total quantities across all stores for all users

-- Grant select permission to authenticated users
GRANT SELECT ON public.products_aggregated TO authenticated;

COMMENT ON VIEW public.products_aggregated IS 'Aggregates product templates with total quantity across all stores. Returns one row per product with sum of all inventory quantities. Bypasses RLS to show totals.';
