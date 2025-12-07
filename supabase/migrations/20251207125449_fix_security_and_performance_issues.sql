-- Migration: Fix Security and Performance Issues
-- Addresses 8 advisors alerts from Supabase Studio

-- ============================================================================
-- PART 1: Fix SECURITY DEFINER on views (5 security issues)
-- Change views to use SECURITY INVOKER (respects caller's permissions)
-- ============================================================================

-- Drop and recreate views with SECURITY INVOKER

-- 1. cashier_performance_summary
DROP VIEW IF EXISTS public.cashier_performance_summary;
CREATE VIEW public.cashier_performance_summary
WITH (security_invoker = true)
AS
SELECT
    s.cashier_id,
    pr.full_name AS cashier_name,
    pr.email AS cashier_email,
    s.store_id,
    st.name AS store_name,
    date(s.created_at) AS sale_date,
    count(s.id) AS transaction_count,
    sum(s.total) AS total_sales,
    avg(s.total) AS avg_transaction,
    count(CASE WHEN s.status = 'refunded' THEN 1 ELSE NULL END) AS refund_count
FROM sales s
JOIN profiles pr ON s.cashier_id = pr.id
LEFT JOIN stores st ON s.store_id = st.id
WHERE s.status IN ('completed', 'refunded')
GROUP BY s.cashier_id, pr.full_name, pr.email, s.store_id, st.name, date(s.created_at);

-- 2. daily_sales_summary
DROP VIEW IF EXISTS public.daily_sales_summary;
CREATE VIEW public.daily_sales_summary
WITH (security_invoker = true)
AS
SELECT
    date(s.created_at) AS sale_date,
    s.store_id,
    st.name AS store_name,
    count(s.id) AS transaction_count,
    sum(s.total) AS total_revenue,
    sum(s.tax) AS total_tax,
    sum(s.discount) AS total_discount,
    avg(s.total) AS avg_transaction,
    count(CASE WHEN s.status = 'refunded' THEN 1 ELSE NULL END) AS refund_count,
    sum(CASE WHEN s.status = 'refunded' THEN s.total ELSE 0 END) AS refund_amount
FROM sales s
LEFT JOIN stores st ON s.store_id = st.id
WHERE s.status IN ('completed', 'refunded')
GROUP BY date(s.created_at), s.store_id, st.name;

-- 3. inventory_summary
DROP VIEW IF EXISTS public.inventory_summary;
CREATE VIEW public.inventory_summary
WITH (security_invoker = true)
AS
SELECT
    pi.id AS inventory_id,
    pi.product_id,
    p.name AS product_name,
    p.sku,
    c.name AS category_name,
    pi.store_id,
    st.name AS store_name,
    pi.quantity,
    p.min_stock_level,
    pi.quantity::numeric * p.price AS stock_value,
    CASE
        WHEN pi.quantity = 0 THEN 'out_of_stock'
        WHEN pi.quantity <= p.min_stock_level THEN 'low_stock'
        ELSE 'in_stock'
    END AS stock_status
FROM product_inventory pi
JOIN product_templates p ON pi.product_id = p.id
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN stores st ON pi.store_id = st.id;

-- 4. payment_method_summary
DROP VIEW IF EXISTS public.payment_method_summary;
CREATE VIEW public.payment_method_summary
WITH (security_invoker = true)
AS
SELECT
    date(created_at) AS sale_date,
    store_id,
    payment_method,
    count(id) AS transaction_count,
    sum(total) AS total_amount
FROM sales s
WHERE status = 'completed'
GROUP BY date(created_at), store_id, payment_method;

-- 5. top_products_summary
DROP VIEW IF EXISTS public.top_products_summary;
CREATE VIEW public.top_products_summary
WITH (security_invoker = true)
AS
SELECT
    si.product_id,
    p.name AS product_name,
    p.sku,
    c.name AS category_name,
    s.store_id,
    date(s.created_at) AS sale_date,
    sum(si.quantity) AS units_sold,
    sum(si.subtotal) AS total_revenue,
    avg(si.unit_price) AS avg_price
FROM sale_items si
JOIN sales s ON si.sale_id = s.id
JOIN product_templates p ON si.product_id = p.id
LEFT JOIN categories c ON p.category_id = c.id
WHERE s.status = 'completed'
GROUP BY si.product_id, p.name, p.sku, c.name, s.store_id, date(s.created_at);

-- ============================================================================
-- PART 2: Fix RLS Performance Issues (2 performance issues)
-- Wrap auth functions with (SELECT ...) to prevent re-evaluation per row
-- ============================================================================

-- Fix user_stores policy: "Users can view their store assignments"
-- Current issue: uid() is called directly without SELECT wrapper
DROP POLICY IF EXISTS "Users can view their store assignments" ON public.user_stores;
CREATE POLICY "Users can view their store assignments" ON public.user_stores
    FOR SELECT TO authenticated
    USING (
        user_id = (SELECT auth.uid())
        OR (SELECT get_current_user_role()) = 'admin'::user_role
    );

-- Fix stores policy: "Users can view stores"
-- Current issue: uid() is called directly in subquery without SELECT wrapper
DROP POLICY IF EXISTS "Users can view stores" ON public.stores;
CREATE POLICY "Users can view stores" ON public.stores
    FOR SELECT TO authenticated
    USING (
        (SELECT get_current_user_role()) = 'admin'::user_role
        OR id IN (
            SELECT us.store_id
            FROM user_stores us
            WHERE us.user_id = (SELECT auth.uid())
        )
        OR id = (SELECT get_current_user_store_id())
    );

-- ============================================================================
-- PART 3: Consolidate Multiple UPDATE Policies on sales (1 performance issue)
-- Combine "Cashiers can complete their own sales" and "Managers can update sales"
-- into a single policy to eliminate multiple permissive policy warning
-- ============================================================================

-- Drop the existing UPDATE policies
DROP POLICY IF EXISTS "Cashiers can complete their own sales" ON public.sales;
DROP POLICY IF EXISTS "Managers can update sales" ON public.sales;

-- Create a single consolidated UPDATE policy
-- Logic:
-- 1. Admins can update any sale
-- 2. Managers can update any sale in their store
-- 3. Cashiers can only update their own pending sales to completed
CREATE POLICY "Users can update sales based on role" ON public.sales
    FOR UPDATE TO authenticated
    USING (
        -- WHO can attempt to update (existing row check)
        CASE
            -- Admins can update any sale
            WHEN (SELECT get_current_user_role()) = 'admin'::user_role THEN true
            -- Managers can update sales in their store
            WHEN (SELECT get_current_user_role()) = 'manager'::user_role
                 AND store_id = (SELECT get_current_user_store_id()) THEN true
            -- Cashiers can only update their own pending sales
            WHEN (SELECT get_current_user_role()) = 'cashier'::user_role
                 AND cashier_id = (SELECT auth.uid())
                 AND store_id = (SELECT get_current_user_store_id())
                 AND status = 'pending' THEN true
            ELSE false
        END
    )
    WITH CHECK (
        -- WHAT updates are allowed (new row check)
        CASE
            -- Admins can set any valid state
            WHEN (SELECT get_current_user_role()) = 'admin'::user_role THEN true
            -- Managers can set any valid state for their store
            WHEN (SELECT get_current_user_role()) = 'manager'::user_role
                 AND store_id = (SELECT get_current_user_store_id()) THEN true
            -- Cashiers can only complete their own sales (status must be 'completed')
            WHEN (SELECT get_current_user_role()) = 'cashier'::user_role
                 AND status = 'completed'
                 AND cashier_id = (SELECT auth.uid())
                 AND store_id = (SELECT get_current_user_store_id()) THEN true
            ELSE false
        END
    );

-- ============================================================================
-- Grant necessary permissions on views
-- ============================================================================

GRANT SELECT ON public.cashier_performance_summary TO authenticated;
GRANT SELECT ON public.daily_sales_summary TO authenticated;
GRANT SELECT ON public.inventory_summary TO authenticated;
GRANT SELECT ON public.payment_method_summary TO authenticated;
GRANT SELECT ON public.top_products_summary TO authenticated;
