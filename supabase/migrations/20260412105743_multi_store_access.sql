-- Migration: multi_store_access
-- Adds user_has_store_access(uuid) function and rewrites 21 RLS policies
-- across 7 tables to support managers assigned to multiple stores.
-- Replaces single-store get_current_user_store_id() pattern.
-- Backward compatible: falls back to profiles.store_id if user_stores is empty.

-- ============================================================
-- Function: user_has_store_access
-- ============================================================
CREATE OR REPLACE FUNCTION public.user_has_store_access(target_store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN target_store_id IS NULL THEN false
    WHEN (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid()) AND deleted_at IS NULL) = 'admin'::public.user_role THEN true
    WHEN EXISTS (
      SELECT 1 FROM public.user_stores
      WHERE user_id = (SELECT auth.uid()) AND store_id = target_store_id
    ) THEN true
    WHEN (SELECT store_id FROM public.profiles WHERE id = (SELECT auth.uid())) = target_store_id THEN true
    ELSE false
  END;
$$;

-- ============================================================
-- Table: cash_sessions (3 policies)
-- ============================================================

DROP POLICY IF EXISTS "Users can view cash sessions from their store" ON public.cash_sessions;
CREATE POLICY "Users can view cash sessions from their store"
  ON public.cash_sessions FOR SELECT TO authenticated
  USING (public.user_has_store_access(store_id));

DROP POLICY IF EXISTS "Cashiers can create their own sessions" ON public.cash_sessions;
CREATE POLICY "Cashiers can create their own sessions"
  ON public.cash_sessions FOR INSERT TO authenticated
  WITH CHECK (
    cashier_id = (SELECT auth.uid())
    AND public.user_has_store_access(store_id)
  );

DROP POLICY IF EXISTS "Users can update their own cash sessions" ON public.cash_sessions;
CREATE POLICY "Users can update their own cash sessions"
  ON public.cash_sessions FOR UPDATE TO authenticated
  USING (
    public.user_has_store_access(store_id)
    AND (
      (SELECT public.get_current_user_role()) IN ('admin'::public.user_role, 'manager'::public.user_role)
      OR cashier_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    public.user_has_store_access(store_id)
    AND (
      (SELECT public.get_current_user_role()) IN ('admin'::public.user_role, 'manager'::public.user_role)
      OR cashier_id = (SELECT auth.uid())
    )
  );

-- ============================================================
-- Table: product_inventory (3 policies)
-- ============================================================

DROP POLICY IF EXISTS "Admin and managers can delete inventory" ON public.product_inventory;
CREATE POLICY "Admin and managers can delete inventory"
  ON public.product_inventory FOR DELETE TO authenticated
  USING (
    (SELECT public.get_current_user_role()) IN ('admin'::public.user_role, 'manager'::public.user_role)
    AND public.user_has_store_access(store_id)
  );

DROP POLICY IF EXISTS "Admin and managers can insert inventory" ON public.product_inventory;
CREATE POLICY "Admin and managers can insert inventory"
  ON public.product_inventory FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.get_current_user_role()) IN ('admin'::public.user_role, 'manager'::public.user_role)
    AND public.user_has_store_access(store_id)
  );

DROP POLICY IF EXISTS "Admin and managers can update inventory" ON public.product_inventory;
CREATE POLICY "Admin and managers can update inventory"
  ON public.product_inventory FOR UPDATE TO authenticated
  USING (
    (SELECT public.get_current_user_role()) IN ('admin'::public.user_role, 'manager'::public.user_role)
    AND public.user_has_store_access(store_id)
  )
  WITH CHECK (
    (SELECT public.get_current_user_role()) IN ('admin'::public.user_role, 'manager'::public.user_role)
    AND public.user_has_store_access(store_id)
  );

-- ============================================================
-- Table: proformas (4 policies)
-- ============================================================

DROP POLICY IF EXISTS "Users can view proformas from their store" ON public.proformas;
CREATE POLICY "Users can view proformas from their store"
  ON public.proformas FOR SELECT TO authenticated
  USING (public.user_has_store_access(store_id));

DROP POLICY IF EXISTS "Staff can create proformas" ON public.proformas;
CREATE POLICY "Staff can create proformas"
  ON public.proformas FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.get_current_user_role()) IN ('admin'::public.user_role, 'manager'::public.user_role, 'cashier'::public.user_role)
    AND public.user_has_store_access(store_id)
    AND created_by = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS "Staff can update proformas" ON public.proformas;
CREATE POLICY "Staff can update proformas"
  ON public.proformas FOR UPDATE TO authenticated
  USING (
    public.user_has_store_access(store_id)
    AND (
      (SELECT public.get_current_user_role()) IN ('admin'::public.user_role, 'manager'::public.user_role)
      OR created_by = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    public.user_has_store_access(store_id)
    AND (
      (SELECT public.get_current_user_role()) IN ('admin'::public.user_role, 'manager'::public.user_role)
      OR created_by = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Managers can delete proformas" ON public.proformas;
CREATE POLICY "Managers can delete proformas"
  ON public.proformas FOR DELETE TO authenticated
  USING (
    (SELECT public.get_current_user_role()) IN ('admin'::public.user_role, 'manager'::public.user_role)
    AND public.user_has_store_access(store_id)
  );

-- ============================================================
-- Table: proforma_items (4 policies)
-- ============================================================

DROP POLICY IF EXISTS "Users can view proforma items from their store" ON public.proforma_items;
CREATE POLICY "Users can view proforma items from their store"
  ON public.proforma_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.proformas p
    WHERE p.id = proforma_items.proforma_id
      AND public.user_has_store_access(p.store_id)
  ));

DROP POLICY IF EXISTS "Staff can insert proforma items" ON public.proforma_items;
CREATE POLICY "Staff can insert proforma items"
  ON public.proforma_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.proformas p
    WHERE p.id = proforma_items.proforma_id
      AND public.user_has_store_access(p.store_id)
      AND (
        (SELECT public.get_current_user_role()) IN ('admin'::public.user_role, 'manager'::public.user_role)
        OR p.created_by = (SELECT auth.uid())
      )
  ));

DROP POLICY IF EXISTS "Staff can update proforma items" ON public.proforma_items;
CREATE POLICY "Staff can update proforma items"
  ON public.proforma_items FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.proformas p
    WHERE p.id = proforma_items.proforma_id
      AND public.user_has_store_access(p.store_id)
      AND (
        (SELECT public.get_current_user_role()) IN ('admin'::public.user_role, 'manager'::public.user_role)
        OR p.created_by = (SELECT auth.uid())
      )
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.proformas p
    WHERE p.id = proforma_items.proforma_id
      AND public.user_has_store_access(p.store_id)
      AND (
        (SELECT public.get_current_user_role()) IN ('admin'::public.user_role, 'manager'::public.user_role)
        OR p.created_by = (SELECT auth.uid())
      )
  ));

DROP POLICY IF EXISTS "Staff can delete proforma items" ON public.proforma_items;
CREATE POLICY "Staff can delete proforma items"
  ON public.proforma_items FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.proformas p
    WHERE p.id = proforma_items.proforma_id
      AND public.user_has_store_access(p.store_id)
      AND (
        (SELECT public.get_current_user_role()) IN ('admin'::public.user_role, 'manager'::public.user_role)
        OR p.created_by = (SELECT auth.uid())
      )
  ));

-- ============================================================
-- Table: sales (3 policies)
-- ============================================================

DROP POLICY IF EXISTS "Users can view sales from their store" ON public.sales;
CREATE POLICY "Users can view sales from their store"
  ON public.sales FOR SELECT TO authenticated
  USING (public.user_has_store_access(store_id));

DROP POLICY IF EXISTS "Cashiers can create sales" ON public.sales;
CREATE POLICY "Cashiers can create sales"
  ON public.sales FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.get_current_user_role()) IN ('admin'::public.user_role, 'manager'::public.user_role, 'cashier'::public.user_role)
    AND public.user_has_store_access(store_id)
    AND cashier_id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS "Users can update sales based on role" ON public.sales;
CREATE POLICY "Users can update sales based on role"
  ON public.sales FOR UPDATE TO authenticated
  USING (
    CASE
      WHEN (SELECT public.get_current_user_role()) = 'admin'::public.user_role THEN true
      WHEN (SELECT public.get_current_user_role()) = 'manager'::public.user_role
           AND public.user_has_store_access(store_id) THEN true
      WHEN (SELECT public.get_current_user_role()) = 'cashier'::public.user_role
           AND cashier_id = (SELECT auth.uid())
           AND public.user_has_store_access(store_id)
           AND status = 'pending' THEN true
      ELSE false
    END
  )
  WITH CHECK (
    CASE
      WHEN (SELECT public.get_current_user_role()) = 'admin'::public.user_role THEN true
      WHEN (SELECT public.get_current_user_role()) = 'manager'::public.user_role
           AND public.user_has_store_access(store_id) THEN true
      WHEN (SELECT public.get_current_user_role()) = 'cashier'::public.user_role
           AND status = 'completed'
           AND cashier_id = (SELECT auth.uid())
           AND public.user_has_store_access(store_id) THEN true
      ELSE false
    END
  );

-- ============================================================
-- Table: sale_items (2 policies)
-- ============================================================

DROP POLICY IF EXISTS "Users can view sale items from their store" ON public.sale_items;
CREATE POLICY "Users can view sale items from their store"
  ON public.sale_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.sales s
    WHERE s.id = sale_items.sale_id
      AND public.user_has_store_access(s.store_id)
  ));

DROP POLICY IF EXISTS "Cashiers can insert sale items" ON public.sale_items;
CREATE POLICY "Cashiers can insert sale items"
  ON public.sale_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.sales s
    WHERE s.id = sale_items.sale_id
      AND s.cashier_id = (SELECT auth.uid())
      AND public.user_has_store_access(s.store_id)
  ));

-- ============================================================
-- Table: stock_movements (2 policies)
-- ============================================================

DROP POLICY IF EXISTS "Users can view stock movements from their store" ON public.stock_movements;
CREATE POLICY "Users can view stock movements from their store"
  ON public.stock_movements FOR SELECT TO authenticated
  USING (public.user_has_store_access(store_id));

DROP POLICY IF EXISTS "Authenticated users can insert stock movements" ON public.stock_movements;
CREATE POLICY "Authenticated users can insert stock movements"
  ON public.stock_movements FOR INSERT TO authenticated
  WITH CHECK (
    public.user_has_store_access(store_id)
    AND user_id = (SELECT auth.uid())
  );
