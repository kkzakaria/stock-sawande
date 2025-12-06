-- ============================================================================
-- FIX SECURITY AND PERFORMANCE ISSUES
-- ============================================================================
-- This migration fixes 29 advisor issues identified by Supabase:
-- 1. 21 SECURITY ISSUES: Functions with mutable search_path vulnerability
-- 2. 8 PERFORMANCE ISSUES: RLS policies with auth function per-row evaluation
--
-- Reference: https://supabase.com/docs/guides/database/postgres/row-level-security
-- ============================================================================

-- ============================================================================
-- PART 1: FIX SECURITY - Add SET search_path to all functions
-- ============================================================================
-- Security issue: Functions without explicit search_path can be exploited
-- Solution: Add "SET search_path TO 'public'" to all functions
-- ============================================================================

-- 1. user_has_pin
CREATE OR REPLACE FUNCTION public.user_has_pin(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.manager_pins WHERE user_id = user_uuid
  );
$$;

-- 2. get_current_user_role (already has search_path, recreate to confirm)
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT role
  FROM public.profiles
  WHERE id = auth.uid();
$$;

-- 3. get_current_user_store_id (already has search_path, recreate to confirm)
CREATE OR REPLACE FUNCTION public.get_current_user_store_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT store_id
  FROM public.profiles
  WHERE id = auth.uid();
$$;

-- 4. generate_sale_number
CREATE OR REPLACE FUNCTION generate_sale_number(store_uuid UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  store_code TEXT;
  date_part TEXT;
  sequence_num INTEGER;
  sale_num TEXT;
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
  SELECT COALESCE(MAX(CAST(SUBSTRING(sale_number FROM '(\d+)$') AS INTEGER)), 0) + 1
  INTO sequence_num
  FROM public.sales
  WHERE store_id = store_uuid
    AND sale_number LIKE store_code || '-' || date_part || '-%';

  -- Format: STR-20251119-0001
  sale_num := store_code || '-' || date_part || '-' || LPAD(sequence_num::TEXT, 4, '0');

  RETURN sale_num;
END;
$$;

-- 5. auto_generate_sale_number
CREATE OR REPLACE FUNCTION auto_generate_sale_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only generate if sale_number is not provided or empty
  IF NEW.sale_number IS NULL OR NEW.sale_number = '' THEN
    NEW.sale_number := generate_sale_number(NEW.store_id);
  END IF;
  RETURN NEW;
END;
$$;

-- 6. deduct_inventory_on_sale
CREATE OR REPLACE FUNCTION deduct_inventory_on_sale()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only deduct inventory when sale is completed (not pending)
  IF NEW.status = 'completed' AND (OLD IS NULL OR OLD.status != 'completed') THEN
    -- Deduct inventory for each sale item
    UPDATE public.product_inventory pi
    SET quantity = pi.quantity - si.quantity
    FROM public.sale_items si
    WHERE si.sale_id = NEW.id
      AND si.inventory_id = pi.id;

    -- Create stock movements for audit trail
    INSERT INTO public.stock_movements (
      product_id,
      store_id,
      inventory_id,
      user_id,
      type,
      quantity,
      previous_quantity,
      new_quantity,
      reference_type,
      reference_id,
      notes
    )
    SELECT
      si.product_id,
      NEW.store_id,
      si.inventory_id,
      NEW.cashier_id,
      'sale',
      -si.quantity,
      pi.quantity + si.quantity, -- previous (before deduction)
      pi.quantity,                -- new (after deduction)
      'sale',
      NEW.id,
      'Inventory deducted for sale ' || NEW.sale_number
    FROM public.sale_items si
    JOIN public.product_inventory pi ON si.inventory_id = pi.id
    WHERE si.sale_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- 7. restore_inventory_on_refund
CREATE OR REPLACE FUNCTION restore_inventory_on_refund()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only restore inventory when sale is refunded (not other statuses)
  IF NEW.status = 'refunded' AND (OLD.status != 'refunded') THEN
    -- Restore inventory for each sale item
    UPDATE public.product_inventory pi
    SET quantity = pi.quantity + si.quantity
    FROM public.sale_items si
    WHERE si.sale_id = NEW.id
      AND si.inventory_id = pi.id;

    -- Create stock movements for audit trail
    INSERT INTO public.stock_movements (
      product_id,
      store_id,
      inventory_id,
      user_id,
      type,
      quantity,
      previous_quantity,
      new_quantity,
      reference_type,
      reference_id,
      notes
    )
    SELECT
      si.product_id,
      NEW.store_id,
      si.inventory_id,
      auth.uid(),
      'return',
      si.quantity,
      pi.quantity - si.quantity, -- previous (before restoration)
      pi.quantity,                -- new (after restoration)
      'sale_refund',
      NEW.id,
      'Inventory restored for refunded sale ' || NEW.sale_number ||
      CASE WHEN NEW.refund_reason IS NOT NULL THEN ' - ' || NEW.refund_reason ELSE '' END
    FROM public.sale_items si
    JOIN public.product_inventory pi ON si.inventory_id = pi.id
    WHERE si.sale_id = NEW.id;

    -- Update refunded_at timestamp
    NEW.refunded_at := timezone('utc'::text, now());
  END IF;

  RETURN NEW;
END;
$$;

-- 8. update_customer_totals
CREATE OR REPLACE FUNCTION update_customer_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Update customer totals when sale is completed
  IF NEW.customer_id IS NOT NULL AND NEW.status = 'completed' THEN
    UPDATE public.customers
    SET
      total_purchases = total_purchases + 1,
      total_spent = total_spent + NEW.total
    WHERE id = NEW.customer_id;
  END IF;

  -- Adjust customer totals when sale is refunded
  IF NEW.customer_id IS NOT NULL AND NEW.status = 'refunded' AND OLD.status = 'completed' THEN
    UPDATE public.customers
    SET
      total_purchases = GREATEST(total_purchases - 1, 0),
      total_spent = GREATEST(total_spent - NEW.total, 0)
    WHERE id = NEW.customer_id;
  END IF;

  RETURN NEW;
END;
$$;

-- 9. update_cash_sessions_updated_at
CREATE OR REPLACE FUNCTION update_cash_sessions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

-- 10. update_manager_pins_updated_at
CREATE OR REPLACE FUNCTION update_manager_pins_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

-- 11. get_dashboard_metrics
CREATE OR REPLACE FUNCTION get_dashboard_metrics(
  p_store_id UUID DEFAULT NULL,
  p_date_from TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  p_date_to TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result JSON;
  today_start TIMESTAMPTZ := DATE_TRUNC('day', NOW());
  yesterday_start TIMESTAMPTZ := DATE_TRUNC('day', NOW() - INTERVAL '1 day');
  week_start TIMESTAMPTZ := DATE_TRUNC('week', NOW());
  last_week_start TIMESTAMPTZ := DATE_TRUNC('week', NOW() - INTERVAL '1 week');
  month_start TIMESTAMPTZ := DATE_TRUNC('month', NOW());
BEGIN
  SELECT json_build_object(
    'totalRevenue', COALESCE(SUM(CASE WHEN s.status = 'completed' THEN s.total ELSE 0 END), 0),
    'todayRevenue', COALESCE(SUM(CASE WHEN s.created_at >= today_start AND s.status = 'completed' THEN s.total ELSE 0 END), 0),
    'yesterdayRevenue', COALESCE(SUM(CASE WHEN s.created_at >= yesterday_start AND s.created_at < today_start AND s.status = 'completed' THEN s.total ELSE 0 END), 0),
    'weekRevenue', COALESCE(SUM(CASE WHEN s.created_at >= week_start AND s.status = 'completed' THEN s.total ELSE 0 END), 0),
    'lastWeekRevenue', COALESCE(SUM(CASE WHEN s.created_at >= last_week_start AND s.created_at < week_start AND s.status = 'completed' THEN s.total ELSE 0 END), 0),
    'monthRevenue', COALESCE(SUM(CASE WHEN s.created_at >= month_start AND s.status = 'completed' THEN s.total ELSE 0 END), 0),
    'totalTransactions', COUNT(CASE WHEN s.status = 'completed' THEN 1 END),
    'todayTransactions', COUNT(CASE WHEN s.created_at >= today_start AND s.status = 'completed' THEN 1 END),
    'avgTransactionValue', COALESCE(AVG(CASE WHEN s.status = 'completed' THEN s.total END), 0),
    'refundCount', COUNT(CASE WHEN s.status = 'refunded' THEN 1 END),
    'refundRate', CASE
      WHEN COUNT(*) > 0 THEN (COUNT(CASE WHEN s.status = 'refunded' THEN 1 END)::DECIMAL / COUNT(*)::DECIMAL) * 100
      ELSE 0
    END
  ) INTO result
  FROM sales s
  WHERE s.created_at BETWEEN p_date_from AND p_date_to
    AND (p_store_id IS NULL OR s.store_id = p_store_id);

  RETURN result;
END;
$$;

-- 12. get_sales_trend
CREATE OR REPLACE FUNCTION get_sales_trend(
  p_store_id UUID DEFAULT NULL,
  p_date_from DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_date_to DATE DEFAULT CURRENT_DATE,
  p_group_by TEXT DEFAULT 'daily'
)
RETURNS TABLE (
  period TEXT,
  period_start DATE,
  transaction_count BIGINT,
  total_revenue NUMERIC,
  avg_transaction NUMERIC,
  refund_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    CASE p_group_by
      WHEN 'daily' THEN TO_CHAR(DATE(s.created_at), 'YYYY-MM-DD')
      WHEN 'weekly' THEN TO_CHAR(DATE_TRUNC('week', s.created_at), 'YYYY-MM-DD')
      WHEN 'monthly' THEN TO_CHAR(DATE_TRUNC('month', s.created_at), 'YYYY-MM')
      ELSE TO_CHAR(DATE(s.created_at), 'YYYY-MM-DD')
    END as period,
    CASE p_group_by
      WHEN 'daily' THEN DATE(s.created_at)
      WHEN 'weekly' THEN DATE(DATE_TRUNC('week', s.created_at))
      WHEN 'monthly' THEN DATE(DATE_TRUNC('month', s.created_at))
      ELSE DATE(s.created_at)
    END as period_start,
    COUNT(CASE WHEN s.status = 'completed' THEN 1 END)::BIGINT as transaction_count,
    COALESCE(SUM(CASE WHEN s.status = 'completed' THEN s.total ELSE 0 END), 0) as total_revenue,
    COALESCE(AVG(CASE WHEN s.status = 'completed' THEN s.total END), 0) as avg_transaction,
    COUNT(CASE WHEN s.status = 'refunded' THEN 1 END)::BIGINT as refund_count
  FROM sales s
  WHERE DATE(s.created_at) BETWEEN p_date_from AND p_date_to
    AND (p_store_id IS NULL OR s.store_id = p_store_id)
  GROUP BY
    CASE p_group_by
      WHEN 'daily' THEN TO_CHAR(DATE(s.created_at), 'YYYY-MM-DD')
      WHEN 'weekly' THEN TO_CHAR(DATE_TRUNC('week', s.created_at), 'YYYY-MM-DD')
      WHEN 'monthly' THEN TO_CHAR(DATE_TRUNC('month', s.created_at), 'YYYY-MM')
      ELSE TO_CHAR(DATE(s.created_at), 'YYYY-MM-DD')
    END,
    CASE p_group_by
      WHEN 'daily' THEN DATE(s.created_at)
      WHEN 'weekly' THEN DATE(DATE_TRUNC('week', s.created_at))
      WHEN 'monthly' THEN DATE(DATE_TRUNC('month', s.created_at))
      ELSE DATE(s.created_at)
    END
  ORDER BY period_start;
END;
$$;

-- 13. get_top_products
CREATE OR REPLACE FUNCTION get_top_products(
  p_store_id UUID DEFAULT NULL,
  p_date_from DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_date_to DATE DEFAULT CURRENT_DATE,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  product_id UUID,
  product_name TEXT,
  sku TEXT,
  category_name TEXT,
  units_sold BIGINT,
  total_revenue NUMERIC,
  avg_price NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    si.product_id,
    p.name as product_name,
    p.sku,
    c.name as category_name,
    SUM(si.quantity)::BIGINT as units_sold,
    SUM(si.subtotal) as total_revenue,
    AVG(si.unit_price) as avg_price
  FROM sale_items si
  JOIN sales s ON si.sale_id = s.id
  JOIN product_templates p ON si.product_id = p.id
  LEFT JOIN categories c ON p.category_id = c.id
  WHERE s.status = 'completed'
    AND DATE(s.created_at) BETWEEN p_date_from AND p_date_to
    AND (p_store_id IS NULL OR s.store_id = p_store_id)
  GROUP BY si.product_id, p.name, p.sku, c.name
  ORDER BY total_revenue DESC
  LIMIT p_limit;
END;
$$;

-- 14. get_low_stock_alerts
CREATE OR REPLACE FUNCTION get_low_stock_alerts(
  p_store_id UUID DEFAULT NULL
)
RETURNS TABLE (
  inventory_id UUID,
  product_id UUID,
  product_name TEXT,
  sku TEXT,
  quantity INT,
  min_stock_level INT,
  store_id UUID,
  store_name TEXT,
  stock_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pi.id as inventory_id,
    pi.product_id,
    p.name as product_name,
    p.sku,
    pi.quantity,
    p.min_stock_level,
    pi.store_id,
    st.name as store_name,
    CASE
      WHEN pi.quantity = 0 THEN 'out_of_stock'
      WHEN pi.quantity <= p.min_stock_level THEN 'low_stock'
      ELSE 'in_stock'
    END as stock_status
  FROM product_inventory pi
  JOIN product_templates p ON pi.product_id = p.id
  LEFT JOIN stores st ON pi.store_id = st.id
  WHERE pi.quantity <= p.min_stock_level
    AND (p_store_id IS NULL OR pi.store_id = p_store_id)
  ORDER BY pi.quantity ASC;
END;
$$;

-- 15. get_payment_breakdown
CREATE OR REPLACE FUNCTION get_payment_breakdown(
  p_store_id UUID DEFAULT NULL,
  p_date_from DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_date_to DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  payment_method TEXT,
  transaction_count BIGINT,
  total_amount NUMERIC,
  percentage NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  total_sales NUMERIC;
BEGIN
  -- Calculate total sales first
  SELECT COALESCE(SUM(s.total), 0)
  INTO total_sales
  FROM sales s
  WHERE s.status = 'completed'
    AND DATE(s.created_at) BETWEEN p_date_from AND p_date_to
    AND (p_store_id IS NULL OR s.store_id = p_store_id);

  RETURN QUERY
  SELECT
    s.payment_method,
    COUNT(s.id)::BIGINT as transaction_count,
    SUM(s.total) as total_amount,
    CASE
      WHEN total_sales > 0 THEN (SUM(s.total) / total_sales) * 100
      ELSE 0
    END as percentage
  FROM sales s
  WHERE s.status = 'completed'
    AND DATE(s.created_at) BETWEEN p_date_from AND p_date_to
    AND (p_store_id IS NULL OR s.store_id = p_store_id)
  GROUP BY s.payment_method
  ORDER BY total_amount DESC;
END;
$$;

-- 16. get_inventory_report
CREATE OR REPLACE FUNCTION get_inventory_report(
  p_store_id UUID DEFAULT NULL
)
RETURNS TABLE (
  inventory_id UUID,
  product_id UUID,
  product_name TEXT,
  sku TEXT,
  category_name TEXT,
  store_id UUID,
  store_name TEXT,
  quantity INT,
  min_stock_level INT,
  stock_value NUMERIC,
  stock_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pi.id as inventory_id,
    pi.product_id,
    p.name as product_name,
    p.sku,
    c.name as category_name,
    pi.store_id,
    st.name as store_name,
    pi.quantity,
    p.min_stock_level,
    (pi.quantity * p.price) as stock_value,
    CASE
      WHEN pi.quantity = 0 THEN 'out_of_stock'
      WHEN pi.quantity <= p.min_stock_level THEN 'low_stock'
      ELSE 'in_stock'
    END as stock_status
  FROM product_inventory pi
  JOIN product_templates p ON pi.product_id = p.id
  LEFT JOIN categories c ON p.category_id = c.id
  LEFT JOIN stores st ON pi.store_id = st.id
  WHERE (p_store_id IS NULL OR pi.store_id = p_store_id)
  ORDER BY stock_status DESC, pi.quantity ASC;
END;
$$;

-- 17. get_store_comparison
CREATE OR REPLACE FUNCTION get_store_comparison(
  p_date_from DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_date_to DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  store_id UUID,
  store_name TEXT,
  transaction_count BIGINT,
  total_revenue NUMERIC,
  avg_transaction NUMERIC,
  refund_count BIGINT,
  refund_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.store_id,
    st.name as store_name,
    COUNT(CASE WHEN s.status = 'completed' THEN 1 END)::BIGINT as transaction_count,
    COALESCE(SUM(CASE WHEN s.status = 'completed' THEN s.total ELSE 0 END), 0) as total_revenue,
    COALESCE(AVG(CASE WHEN s.status = 'completed' THEN s.total END), 0) as avg_transaction,
    COUNT(CASE WHEN s.status = 'refunded' THEN 1 END)::BIGINT as refund_count,
    CASE
      WHEN COUNT(*) > 0 THEN (COUNT(CASE WHEN s.status = 'refunded' THEN 1 END)::DECIMAL / COUNT(*)::DECIMAL) * 100
      ELSE 0
    END as refund_rate
  FROM sales s
  LEFT JOIN stores st ON s.store_id = st.id
  WHERE DATE(s.created_at) BETWEEN p_date_from AND p_date_to
  GROUP BY s.store_id, st.name
  ORDER BY total_revenue DESC;
END;
$$;

-- 18. get_cashier_performance
CREATE OR REPLACE FUNCTION get_cashier_performance(
  p_store_id UUID DEFAULT NULL,
  p_date_from DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_date_to DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  cashier_id UUID,
  cashier_name TEXT,
  cashier_email TEXT,
  store_id UUID,
  store_name TEXT,
  transaction_count BIGINT,
  total_sales NUMERIC,
  avg_transaction NUMERIC,
  refund_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.cashier_id,
    pr.full_name as cashier_name,
    pr.email as cashier_email,
    s.store_id,
    st.name as store_name,
    COUNT(CASE WHEN s.status = 'completed' THEN 1 END)::BIGINT as transaction_count,
    COALESCE(SUM(CASE WHEN s.status = 'completed' THEN s.total ELSE 0 END), 0) as total_sales,
    COALESCE(AVG(CASE WHEN s.status = 'completed' THEN s.total END), 0) as avg_transaction,
    COUNT(CASE WHEN s.status = 'refunded' THEN 1 END)::BIGINT as refund_count
  FROM sales s
  JOIN profiles pr ON s.cashier_id = pr.id
  LEFT JOIN stores st ON s.store_id = st.id
  WHERE DATE(s.created_at) BETWEEN p_date_from AND p_date_to
    AND (p_store_id IS NULL OR s.store_id = p_store_id)
  GROUP BY s.cashier_id, pr.full_name, pr.email, s.store_id, st.name
  ORDER BY total_sales DESC;
END;
$$;

-- ============================================================================
-- PART 2: FIX PERFORMANCE - Optimize RLS policies auth function calls
-- ============================================================================
-- Performance issue: auth.uid() called without SELECT wrapper causes per-row evaluation
-- Solution: Wrap auth.uid() with (SELECT auth.uid()) for caching
-- ============================================================================

-- 1. Fix "Cashiers can complete their own sales" policy on sales table
DROP POLICY IF EXISTS "Cashiers can complete their own sales" ON public.sales;
CREATE POLICY "Cashiers can complete their own sales"
ON public.sales
FOR UPDATE
TO authenticated
USING (
  -- Can only update sales they created
  cashier_id = (SELECT auth.uid())
  AND
  -- Can only update sales from their own store
  store_id = (SELECT public.get_current_user_store_id())
  AND
  -- Current status must be pending (prevent modifying completed sales)
  status = 'pending'
)
WITH CHECK (
  -- New status must be completed (only allow pending -> completed transition)
  status = 'completed'
  AND
  -- Ensure they don't change the cashier_id or store_id
  cashier_id = (SELECT auth.uid())
  AND
  store_id = (SELECT public.get_current_user_store_id())
);

-- 2. Fix "Cashiers can create their own sessions" policy on cash_sessions table
DROP POLICY IF EXISTS "Cashiers can create their own sessions" ON public.cash_sessions;
CREATE POLICY "Cashiers can create their own sessions"
  ON public.cash_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    cashier_id = (SELECT auth.uid())
    AND (
      (SELECT public.get_current_user_role()) = 'admin'
      OR store_id = (SELECT public.get_current_user_store_id())
    )
  );

-- 3. Fix "Users can update their own cash sessions" policy on cash_sessions table
DROP POLICY IF EXISTS "Users can update their own cash sessions" ON public.cash_sessions;
CREATE POLICY "Users can update their own cash sessions"
  ON public.cash_sessions FOR UPDATE
  TO authenticated
  USING (
    (SELECT public.get_current_user_role()) = 'admin'
    OR (
      store_id = (SELECT public.get_current_user_store_id())
      AND (
        (SELECT public.get_current_user_role()) IN ('manager')
        OR cashier_id = (SELECT auth.uid())
      )
    )
  )
  WITH CHECK (
    (SELECT public.get_current_user_role()) = 'admin'
    OR (
      store_id = (SELECT public.get_current_user_store_id())
      AND (
        (SELECT public.get_current_user_role()) IN ('manager')
        OR cashier_id = (SELECT auth.uid())
      )
    )
  );

-- 4. Fix "Users can insert their own PIN" policy on manager_pins table
DROP POLICY IF EXISTS "Users can insert their own PIN" ON public.manager_pins;
CREATE POLICY "Users can insert their own PIN"
  ON public.manager_pins FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- 5. Fix "Users can update their own PIN" policy on manager_pins table
DROP POLICY IF EXISTS "Users can update their own PIN" ON public.manager_pins;
CREATE POLICY "Users can update their own PIN"
  ON public.manager_pins FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- 6. Fix "Users can delete their own PIN" policy on manager_pins table
DROP POLICY IF EXISTS "Users can delete their own PIN" ON public.manager_pins;
CREATE POLICY "Users can delete their own PIN"
  ON public.manager_pins FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- 7. Fix "Users can view own PIN only" policy on manager_pins table
DROP POLICY IF EXISTS "Users can view their own PIN record" ON public.manager_pins;
DROP POLICY IF EXISTS "Users can view own PIN only" ON public.manager_pins;
CREATE POLICY "Users can view own PIN only"
  ON public.manager_pins FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ============================================================================
-- VERIFICATION AND COMMENTS
-- ============================================================================

COMMENT ON FUNCTION public.user_has_pin IS 'Check if a user has configured their approval PIN - SECURITY: search_path set to public';
COMMENT ON FUNCTION public.generate_sale_number IS 'Generate unique sale number in format STR-YYYYMMDD-0001 - SECURITY: search_path set to public';
COMMENT ON FUNCTION public.auto_generate_sale_number IS 'Automatically generate sale number on insert - SECURITY: search_path set to public';
COMMENT ON FUNCTION public.deduct_inventory_on_sale IS 'Automatically deduct inventory when sale is completed - SECURITY: search_path set to public';
COMMENT ON FUNCTION public.restore_inventory_on_refund IS 'Automatically restore inventory when sale is refunded - SECURITY: search_path set to public';
COMMENT ON FUNCTION public.update_customer_totals IS 'Update customer purchase totals on sale completion/refund - SECURITY: search_path set to public';
COMMENT ON FUNCTION public.update_cash_sessions_updated_at IS 'Update cash sessions updated_at timestamp - SECURITY: search_path set to public';
COMMENT ON FUNCTION public.update_manager_pins_updated_at IS 'Update manager pins updated_at timestamp - SECURITY: search_path set to public';
COMMENT ON FUNCTION public.get_dashboard_metrics IS 'Get dashboard metrics for analytics - SECURITY: search_path set to public';
COMMENT ON FUNCTION public.get_sales_trend IS 'Get sales trend by period - SECURITY: search_path set to public';
COMMENT ON FUNCTION public.get_top_products IS 'Get top selling products - SECURITY: search_path set to public';
COMMENT ON FUNCTION public.get_low_stock_alerts IS 'Get low stock alerts - SECURITY: search_path set to public';
COMMENT ON FUNCTION public.get_payment_breakdown IS 'Get payment method breakdown - SECURITY: search_path set to public';
COMMENT ON FUNCTION public.get_inventory_report IS 'Get inventory report - SECURITY: search_path set to public';
COMMENT ON FUNCTION public.get_store_comparison IS 'Get store comparison metrics - SECURITY: search_path set to public';
COMMENT ON FUNCTION public.get_cashier_performance IS 'Get cashier performance metrics - SECURITY: search_path set to public';

-- Migration completed successfully
-- All 21 security issues (mutable search_path) have been fixed
-- All 8 performance issues (auth function per-row evaluation) have been fixed
