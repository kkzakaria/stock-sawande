-- products_for_user_stores: aggregated product list with caller-scoped my_quantity.
-- Backs the server-paginated products page for managers/cashiers — the previous
-- code path fetched every aggregated row and filtered in JS, which forced the
-- list page to ship the entire catalog (capped at 250) to the browser.
--
-- p_store_ids is intersected with the caller's accessible stores via
-- public.user_has_store_access, so a manager who calls this RPC from the
-- browser with another store's id cannot leak its inventory totals.
-- The HAVING clause replicates the JS visibility filter:
--   product is returned iff caller has an inventory row in any of their stores,
--   OR the product has stock > 0 anywhere across the catalog.
--
-- Returns a TABLE so PostgREST can chain .or() / .order() / .range() for
-- server-side search/sort/pagination.

CREATE OR REPLACE FUNCTION public.products_for_user_stores(
  p_store_ids uuid[]
)
RETURNS TABLE (
  template_id uuid,
  sku text,
  name text,
  description text,
  category_id uuid,
  category_name text,
  price numeric,
  min_price numeric,
  max_price numeric,
  cost numeric,
  min_stock_level integer,
  image_url text,
  barcode text,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz,
  total_quantity integer,
  store_count integer,
  my_quantity integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_allowed_stores uuid[];
BEGIN
  -- Intersect requested stores with what the caller is actually allowed to see.
  -- An admin passes through unchanged; everyone else is restricted to the
  -- subset of p_store_ids they have access to via user_has_store_access.
  SELECT COALESCE(array_agg(s), ARRAY[]::uuid[])
    INTO v_allowed_stores
  FROM unnest(COALESCE(p_store_ids, ARRAY[]::uuid[])) AS s
  WHERE public.user_has_store_access(s);

  RETURN QUERY
  SELECT
    pt.id AS template_id,
    pt.sku,
    pt.name,
    pt.description,
    pt.category_id,
    c.name AS category_name,
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
    COALESCE(SUM(pi.quantity), 0)::integer AS total_quantity,
    COUNT(DISTINCT pi.store_id)::integer AS store_count,
    COALESCE(
      SUM(pi.quantity) FILTER (WHERE pi.store_id = ANY (v_allowed_stores)),
      0
    )::integer AS my_quantity
  FROM public.product_templates pt
  LEFT JOIN public.product_inventory pi ON pi.product_id = pt.id
  LEFT JOIN public.categories c ON c.id = pt.category_id
  GROUP BY pt.id, c.name
  HAVING
    COALESCE(bool_or(pi.store_id = ANY (v_allowed_stores)), false)
    OR COALESCE(SUM(pi.quantity), 0) > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.products_for_user_stores(uuid[]) TO authenticated;

COMMENT ON FUNCTION public.products_for_user_stores(uuid[]) IS
  'Returns the aggregated products list visible to the caller, with my_quantity summed across the caller-accessible subset of p_store_ids. Used by the products list page for server-side pagination on the manager/cashier code path.';
