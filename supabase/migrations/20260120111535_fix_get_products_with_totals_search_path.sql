-- Fix mutable search_path security issue for get_products_with_totals function

CREATE OR REPLACE FUNCTION public.get_products_with_totals(
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
  my_quantity INTEGER,
  total_quantity INTEGER,
  store_count INTEGER,
  min_stock_level INTEGER,
  image_url TEXT,
  barcode TEXT,
  is_active BOOLEAN,
  inventory_id UUID,
  store_id UUID,
  store_name TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
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
    COALESCE(my_inv.quantity, 0)::INTEGER as my_quantity,
    COALESCE(totals.total_quantity, 0)::INTEGER as total_quantity,
    COALESCE(totals.store_count, 0)::INTEGER as store_count,
    pt.min_stock_level,
    pt.image_url,
    pt.barcode,
    pt.is_active,
    my_inv.id as inventory_id,
    my_inv.store_id,
    s.name as store_name,
    pt.created_at,
    pt.updated_at
  FROM
    public.product_templates pt
  LEFT JOIN
    public.categories c ON pt.category_id = c.id
  -- Join for the user's store inventory
  LEFT JOIN
    public.product_inventory my_inv ON pt.id = my_inv.product_id AND my_inv.store_id = p_store_id
  LEFT JOIN
    public.stores s ON my_inv.store_id = s.id
  -- Subquery for total quantity and store count
  LEFT JOIN LATERAL (
    SELECT
      pi.product_id,
      SUM(pi.quantity)::INTEGER as total_quantity,
      COUNT(DISTINCT pi.store_id)::INTEGER as store_count
    FROM public.product_inventory pi
    WHERE pi.product_id = pt.id
    GROUP BY pi.product_id
  ) totals ON true
  WHERE
    -- Only include products that exist in the user's store OR have inventory somewhere
    (my_inv.id IS NOT NULL OR totals.total_quantity > 0)
  ORDER BY
    pt.name;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public;

COMMENT ON FUNCTION public.get_products_with_totals IS
  'Returns all products with both store-specific quantity (my_quantity) and total quantity across all stores (total_quantity). Used for managers/cashiers to see their stock and overall availability.';
