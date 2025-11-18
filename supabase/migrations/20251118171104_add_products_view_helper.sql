-- Create a view that combines product templates with their inventory
-- This makes it easier to query products with their store-specific quantities

CREATE OR REPLACE VIEW public.products_with_inventory AS
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

-- Add RLS policy for the view
ALTER VIEW public.products_with_inventory SET (security_invoker = true);

-- Create helpful comments
COMMENT ON VIEW public.products_with_inventory IS 'Combines product templates with their store-specific inventory. Returns one row per product-store combination. Products without inventory in any store will have NULL values for inventory fields.';

-- Create a function to get products available in a specific store
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
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Create a function to get all stores where a product is available
CREATE OR REPLACE FUNCTION public.get_stores_by_product(
  p_product_id UUID
)
RETURNS TABLE (
  store_id UUID,
  store_name TEXT,
  store_address TEXT,
  quantity INTEGER,
  inventory_id UUID
) AS $$
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
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Create a function to get low stock products across all stores
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
) AS $$
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
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Add helpful comments
COMMENT ON FUNCTION public.get_products_by_store IS
  'Returns all active products available in a specific store with their quantities';

COMMENT ON FUNCTION public.get_stores_by_product IS
  'Returns all stores where a specific product is available with quantities';

COMMENT ON FUNCTION public.get_low_stock_products IS
  'Returns products that are below their minimum stock level across all stores';
