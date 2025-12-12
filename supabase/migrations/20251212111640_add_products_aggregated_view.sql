-- Create a view that aggregates product quantities across all stores
-- This is used for the products list to show total stock

CREATE OR REPLACE VIEW public.products_aggregated AS
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

-- Add RLS policy for the view
ALTER VIEW public.products_aggregated SET (security_invoker = true);

-- Create helpful comments
COMMENT ON VIEW public.products_aggregated IS 'Aggregates product templates with total quantity across all stores. Returns one row per product with sum of all inventory quantities.';
