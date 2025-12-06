-- Fix analytics views and functions to use explicit schema references
-- This fixes "relation 'sales' does not exist" errors after search_path security fixes

-- ============================================
-- RECREATE VIEWS WITH EXPLICIT SCHEMA
-- ============================================

-- Daily Sales Summary View
CREATE OR REPLACE VIEW public.daily_sales_summary AS
SELECT
  DATE(s.created_at) as sale_date,
  s.store_id,
  st.name as store_name,
  COUNT(s.id) as transaction_count,
  SUM(s.total) as total_revenue,
  SUM(s.tax) as total_tax,
  SUM(s.discount) as total_discount,
  AVG(s.total) as avg_transaction,
  COUNT(CASE WHEN s.status = 'refunded' THEN 1 END) as refund_count,
  SUM(CASE WHEN s.status = 'refunded' THEN s.total ELSE 0 END) as refund_amount
FROM public.sales s
LEFT JOIN public.stores st ON s.store_id = st.id
WHERE s.status IN ('completed', 'refunded')
GROUP BY DATE(s.created_at), s.store_id, st.name;

-- Payment Method Summary View
CREATE OR REPLACE VIEW public.payment_method_summary AS
SELECT
  DATE(s.created_at) as sale_date,
  s.store_id,
  s.payment_method,
  COUNT(s.id) as transaction_count,
  SUM(s.total) as total_amount
FROM public.sales s
WHERE s.status = 'completed'
GROUP BY DATE(s.created_at), s.store_id, s.payment_method;

-- Top Products Summary View
CREATE OR REPLACE VIEW public.top_products_summary AS
SELECT
  si.product_id,
  p.name as product_name,
  p.sku,
  c.name as category_name,
  s.store_id,
  DATE(s.created_at) as sale_date,
  SUM(si.quantity) as units_sold,
  SUM(si.subtotal) as total_revenue,
  AVG(si.unit_price) as avg_price
FROM public.sale_items si
JOIN public.sales s ON si.sale_id = s.id
JOIN public.product_templates p ON si.product_id = p.id
LEFT JOIN public.categories c ON p.category_id = c.id
WHERE s.status = 'completed'
GROUP BY si.product_id, p.name, p.sku, c.name, s.store_id, DATE(s.created_at);

-- Cashier Performance Summary View
CREATE OR REPLACE VIEW public.cashier_performance_summary AS
SELECT
  s.cashier_id,
  pr.full_name as cashier_name,
  pr.email as cashier_email,
  s.store_id,
  st.name as store_name,
  DATE(s.created_at) as sale_date,
  COUNT(s.id) as transaction_count,
  SUM(s.total) as total_sales,
  AVG(s.total) as avg_transaction,
  COUNT(CASE WHEN s.status = 'refunded' THEN 1 END) as refund_count
FROM public.sales s
JOIN public.profiles pr ON s.cashier_id = pr.id
LEFT JOIN public.stores st ON s.store_id = st.id
WHERE s.status IN ('completed', 'refunded')
GROUP BY s.cashier_id, pr.full_name, pr.email, s.store_id, st.name, DATE(s.created_at);

-- Inventory Summary View
CREATE OR REPLACE VIEW public.inventory_summary AS
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
FROM public.product_inventory pi
JOIN public.product_templates p ON pi.product_id = p.id
LEFT JOIN public.categories c ON p.category_id = c.id
LEFT JOIN public.stores st ON pi.store_id = st.id;

-- ============================================
-- RECREATE FUNCTIONS WITH EXPLICIT SCHEMA
-- ============================================

-- Get Dashboard Metrics
CREATE OR REPLACE FUNCTION public.get_dashboard_metrics(
  p_store_id UUID DEFAULT NULL,
  p_date_from TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  p_date_to TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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
  FROM public.sales s
  WHERE s.created_at BETWEEN p_date_from AND p_date_to
    AND (p_store_id IS NULL OR s.store_id = p_store_id);

  RETURN result;
END;
$$;

-- Get Sales Trend (daily/weekly/monthly)
CREATE OR REPLACE FUNCTION public.get_sales_trend(
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
SET search_path = ''
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
  FROM public.sales s
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

-- Get Top Products
CREATE OR REPLACE FUNCTION public.get_top_products(
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
SET search_path = ''
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
  FROM public.sale_items si
  JOIN public.sales s ON si.sale_id = s.id
  JOIN public.product_templates p ON si.product_id = p.id
  LEFT JOIN public.categories c ON p.category_id = c.id
  WHERE s.status = 'completed'
    AND DATE(s.created_at) BETWEEN p_date_from AND p_date_to
    AND (p_store_id IS NULL OR s.store_id = p_store_id)
  GROUP BY si.product_id, p.name, p.sku, c.name
  ORDER BY total_revenue DESC
  LIMIT p_limit;
END;
$$;

-- Get Low Stock Alerts
CREATE OR REPLACE FUNCTION public.get_low_stock_alerts(
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
SET search_path = ''
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
  FROM public.product_inventory pi
  JOIN public.product_templates p ON pi.product_id = p.id
  LEFT JOIN public.stores st ON pi.store_id = st.id
  WHERE pi.quantity <= p.min_stock_level
    AND (p_store_id IS NULL OR pi.store_id = p_store_id)
  ORDER BY pi.quantity ASC;
END;
$$;

-- Get Payment Breakdown
CREATE OR REPLACE FUNCTION public.get_payment_breakdown(
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
SET search_path = ''
AS $$
DECLARE
  total_sales NUMERIC;
BEGIN
  -- Calculate total sales first
  SELECT COALESCE(SUM(s.total), 0)
  INTO total_sales
  FROM public.sales s
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
  FROM public.sales s
  WHERE s.status = 'completed'
    AND DATE(s.created_at) BETWEEN p_date_from AND p_date_to
    AND (p_store_id IS NULL OR s.store_id = p_store_id)
  GROUP BY s.payment_method
  ORDER BY total_amount DESC;
END;
$$;

-- Get Inventory Report
CREATE OR REPLACE FUNCTION public.get_inventory_report(
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
SET search_path = ''
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
  FROM public.product_inventory pi
  JOIN public.product_templates p ON pi.product_id = p.id
  LEFT JOIN public.categories c ON p.category_id = c.id
  LEFT JOIN public.stores st ON pi.store_id = st.id
  WHERE (p_store_id IS NULL OR pi.store_id = p_store_id)
  ORDER BY stock_status DESC, pi.quantity ASC;
END;
$$;

-- Get Store Comparison
CREATE OR REPLACE FUNCTION public.get_store_comparison(
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
SET search_path = ''
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
  FROM public.sales s
  LEFT JOIN public.stores st ON s.store_id = st.id
  WHERE DATE(s.created_at) BETWEEN p_date_from AND p_date_to
  GROUP BY s.store_id, st.name
  ORDER BY total_revenue DESC;
END;
$$;

-- Get Cashier Performance
CREATE OR REPLACE FUNCTION public.get_cashier_performance(
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
SET search_path = ''
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
  FROM public.sales s
  JOIN public.profiles pr ON s.cashier_id = pr.id
  LEFT JOIN public.stores st ON s.store_id = st.id
  WHERE DATE(s.created_at) BETWEEN p_date_from AND p_date_to
    AND (p_store_id IS NULL OR s.store_id = p_store_id)
  GROUP BY s.cashier_id, pr.full_name, pr.email, s.store_id, st.name
  ORDER BY total_sales DESC;
END;
$$;
