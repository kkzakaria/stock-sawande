-- Phase 2: Schema Cleanup
-- Closes #23, #25, #31

-- 2a. Drop legacy backup table (#23)
DROP TABLE IF EXISTS public.products_backup_old CASCADE;

-- 2b. Fix search_path on all SECURITY DEFINER functions (#25)
-- Each function is recreated with SET search_path = '' and fully schema-qualified identifiers.

CREATE OR REPLACE FUNCTION public.get_current_user_role()
 RETURNS public.user_role
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = ''
AS $function$
  SELECT role
  FROM public.profiles
  WHERE id = auth.uid()
  AND deleted_at IS NULL
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.is_user_active(check_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = check_user_id AND deleted_at IS NULL
  );
$function$;

CREATE OR REPLACE FUNCTION public.generate_proforma_number(store_uuid uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
DECLARE
  store_code TEXT;
  date_part TEXT;
  sequence_num INTEGER;
  proforma_num TEXT;
BEGIN
  -- Get store code (first 3 chars of store name, uppercase)
  SELECT UPPER(SUBSTRING(name FROM 1 FOR 3))
  INTO store_code
  FROM public.stores
  WHERE id = store_uuid;

  -- If no store code, use 'STR'
  IF store_code IS NULL OR store_code = '' THEN
    store_code := 'STR';
  END IF;

  -- Get date part (YYYYMMDD)
  date_part := TO_CHAR(NOW(), 'YYYYMMDD');

  -- Get sequence number for today
  SELECT COALESCE(MAX(CAST(SUBSTRING(proforma_number FROM '(\\d+)$') AS INTEGER)), 0) + 1
  INTO sequence_num
  FROM public.proformas
  WHERE store_id = store_uuid
    AND proforma_number LIKE 'PRO-' || store_code || '-' || date_part || '-%';

  -- Format: PRO-STR-20251212-0001
  proforma_num := 'PRO-' || store_code || '-' || date_part || '-' || LPAD(sequence_num::TEXT, 4, '0');

  RETURN proforma_num;
END;
$function$;

CREATE OR REPLACE FUNCTION public.auto_generate_proforma_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
BEGIN
  -- Only generate if proforma_number is not provided or empty
  IF NEW.proforma_number IS NULL OR NEW.proforma_number = '' THEN
    NEW.proforma_number := public.generate_proforma_number(NEW.store_id);
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_expired_proformas()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE public.proformas
  SET status = 'expired'
  WHERE status IN ('draft', 'sent')
    AND valid_until IS NOT NULL
    AND valid_until < CURRENT_DATE;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_assigned_stores(p_user_id uuid)
 RETURNS TABLE(store_id uuid, store_name text, is_default boolean, address text, phone text, email text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    s.id as store_id,
    s.name as store_name,
    us.is_default,
    s.address,
    s.phone,
    s.email
  FROM public.user_stores us
  INNER JOIN public.stores s ON us.store_id = s.id
  WHERE us.user_id = p_user_id
  ORDER BY us.is_default DESC, s.name;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_store_id_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
DECLARE
  v_user_role public.user_role;
  is_store_assigned BOOLEAN;
BEGIN
  -- Get the current user's role
  SELECT role INTO v_user_role
  FROM public.profiles
  WHERE id = auth.uid();

  -- If store_id is being changed
  IF NEW.store_id IS DISTINCT FROM OLD.store_id THEN
    -- Admins can always update (their own or others)
    IF v_user_role = 'admin' THEN
      RETURN NEW;
    END IF;

    -- Only allow users to update their own profile
    IF NEW.id != auth.uid() THEN
      RAISE EXCEPTION 'Cannot update store_id for other users';
    END IF;

    -- Managers can update their own store_id, but only to stores they are assigned to
    IF v_user_role = 'manager' THEN
      -- Check if the new store_id is in the user's assigned stores
      SELECT EXISTS (
        SELECT 1
        FROM public.user_stores
        WHERE user_id = auth.uid()
          AND store_id = NEW.store_id
      ) INTO is_store_assigned;

      IF NOT is_store_assigned THEN
        RAISE EXCEPTION 'Managers can only select stores they are assigned to. Contact an administrator to assign you to this store.';
      END IF;

      RETURN NEW;
    END IF;

    -- Cashiers cannot update their store_id
    IF v_user_role = 'cashier' THEN
      RAISE EXCEPTION 'Cashiers cannot change their assigned store. Contact an administrator.';
    END IF;
  END IF;

  -- If store_id is not being changed, allow the update
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.soft_delete_user(target_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
DECLARE
  current_user_role public.user_role;
  target_email TEXT;
  sales_count INTEGER;
  sessions_count INTEGER;
BEGIN
  -- Check if current user is admin
  SELECT role INTO current_user_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF current_user_role != 'admin' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only admins can delete users'
    );
  END IF;

  -- Prevent self-deletion
  IF target_user_id = auth.uid() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cannot delete your own account'
    );
  END IF;

  -- Get user info
  SELECT email INTO target_email
  FROM public.profiles
  WHERE id = target_user_id AND deleted_at IS NULL;

  IF target_email IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found or already deleted'
    );
  END IF;

  -- Count related records for info
  SELECT COUNT(*) INTO sales_count
  FROM public.sales
  WHERE cashier_id = target_user_id;

  SELECT COUNT(*) INTO sessions_count
  FROM public.cash_sessions
  WHERE cashier_id = target_user_id;

  -- Perform soft delete
  UPDATE public.profiles
  SET
    deleted_at = NOW(),
    updated_at = NOW()
  WHERE id = target_user_id;

  -- Remove from user_stores (clean up assignments)
  DELETE FROM public.user_stores
  WHERE user_id = target_user_id;

  -- Remove manager PIN
  DELETE FROM public.manager_pins
  WHERE user_id = target_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'User soft deleted successfully',
    'user_email', target_email,
    'preserved_records', jsonb_build_object(
      'sales', sales_count,
      'cash_sessions', sessions_count
    )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.restore_deleted_user(target_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
DECLARE
  current_user_role public.user_role;
  target_email TEXT;
BEGIN
  -- Check if current user is admin
  SELECT role INTO current_user_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF current_user_role != 'admin' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only admins can restore users'
    );
  END IF;

  -- Get deleted user info
  SELECT email INTO target_email
  FROM public.profiles
  WHERE id = target_user_id AND deleted_at IS NOT NULL;

  IF target_email IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found or not deleted'
    );
  END IF;

  -- Restore user
  UPDATE public.profiles
  SET
    deleted_at = NULL,
    updated_at = NOW()
  WHERE id = target_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'User restored successfully',
    'user_email', target_email
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_all_products_aggregated()
 RETURNS TABLE(template_id uuid, sku text, name text, description text, category_id uuid, category_name text, price numeric, cost numeric, min_stock_level integer, image_url text, barcode text, is_active boolean, created_at timestamp with time zone, updated_at timestamp with time zone, total_quantity integer, store_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.get_products_by_store(p_store_id uuid)
 RETURNS TABLE(template_id uuid, sku text, name text, description text, category_id uuid, category_name text, price numeric, min_price numeric, max_price numeric, cost numeric, quantity integer, min_stock_level integer, image_url text, barcode text, is_active boolean, inventory_id uuid)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path = ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.get_products_with_totals(p_store_id uuid)
 RETURNS TABLE(template_id uuid, sku text, name text, description text, category_id uuid, category_name text, price numeric, cost numeric, my_quantity integer, total_quantity integer, store_count integer, min_stock_level integer, image_url text, barcode text, is_active boolean, inventory_id uuid, store_id uuid, store_name text, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path = ''
AS $function$
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
$function$;

-- 2c. Add WITH CHECK to stores and categories UPDATE policies (#31)
DROP POLICY IF EXISTS "Admins can update stores" ON public.stores;
CREATE POLICY "Admins can update stores"
  ON public.stores FOR UPDATE TO authenticated
  USING ((SELECT public.get_current_user_role()) = 'admin'::public.user_role)
  WITH CHECK ((SELECT public.get_current_user_role()) = 'admin'::public.user_role);

DROP POLICY IF EXISTS "Admin and managers can update categories" ON public.categories;
CREATE POLICY "Admin and managers can update categories"
  ON public.categories FOR UPDATE TO authenticated
  USING ((SELECT public.get_current_user_role()) = ANY(ARRAY['admin'::public.user_role, 'manager'::public.user_role]))
  WITH CHECK ((SELECT public.get_current_user_role()) = ANY(ARRAY['admin'::public.user_role, 'manager'::public.user_role]));

-- 2d. Add FK covering index on business_settings.updated_by (#31)
CREATE INDEX IF NOT EXISTS idx_business_settings_updated_by
  ON public.business_settings(updated_by);
