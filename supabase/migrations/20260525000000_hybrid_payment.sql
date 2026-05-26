-- Migration: hybrid_payment
-- Adds sale_payments table and updates process_checkout RPC to support hybrid payments.

-- 1. Extend payment_method check constraint on sales
ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_payment_method_check;
ALTER TABLE public.sales ADD CONSTRAINT sales_payment_method_check
  CHECK (payment_method IN ('cash', 'card', 'mobile', 'other', 'hybrid'));

-- 2. Create sale_payments table
CREATE TABLE IF NOT EXISTS public.sale_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'mobile', 'other')),
  amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sale_payments_sale_id ON public.sale_payments(sale_id);

ALTER TABLE public.sale_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sale_payments_select" ON public.sale_payments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sales s
      WHERE s.id = sale_payments.sale_id
        AND public.user_has_store_access(s.store_id)
    )
  );

GRANT SELECT ON public.sale_payments TO authenticated;

-- 3. Updated process_checkout RPC with hybrid payment support
CREATE OR REPLACE FUNCTION public.process_checkout(
  p_store_id uuid,
  p_cashier_id uuid,
  p_customer_id uuid DEFAULT NULL::uuid,
  p_cash_session_id uuid DEFAULT NULL::uuid,
  p_payment_method text DEFAULT 'cash'::text,
  p_payment_splits jsonb DEFAULT NULL::jsonb,
  p_items jsonb DEFAULT '[]'::jsonb,
  p_subtotal numeric DEFAULT 0,
  p_tax numeric DEFAULT 0,
  p_discount numeric DEFAULT 0,
  p_total numeric DEFAULT 0,
  p_notes text DEFAULT ''::text,
  p_idempotency_key text DEFAULT ''::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_caller_id uuid := (SELECT auth.uid());
  v_caller_role public.user_role;
  v_sale_id uuid;
  v_sale_number text;
  v_existing_sale_id uuid;
  v_item jsonb;
  v_split jsonb;
  v_inv_quantity integer;
  v_inv_product_id uuid;
  v_product_price numeric;
  v_product_min_price numeric;
  v_product_max_price numeric;
  v_epsilon numeric := 0.005;
  v_computed_subtotal numeric := 0;
  v_effective_method text;
  v_splits_sum numeric := 0;
BEGIN
  -- === Auth ===
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated' USING ERRCODE = '42501';
  END IF;

  IF v_caller_id <> p_cashier_id THEN
    RAISE EXCEPTION 'Cashier id mismatch' USING ERRCODE = '42501';
  END IF;

  SELECT role INTO v_caller_role
  FROM public.profiles
  WHERE id = v_caller_id AND deleted_at IS NULL;

  IF v_caller_role IS NULL OR v_caller_role NOT IN ('admin'::public.user_role, 'manager'::public.user_role, 'cashier'::public.user_role) THEN
    RAISE EXCEPTION 'User not authorized to checkout' USING ERRCODE = '42501';
  END IF;

  IF v_caller_role <> 'admin'::public.user_role THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_stores WHERE user_id = v_caller_id AND store_id = p_store_id
    ) THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.profiles WHERE id = v_caller_id AND store_id = p_store_id
      ) THEN
        RAISE EXCEPTION 'User not assigned to this store' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  -- === Idempotency ===
  IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
    SELECT sale_id INTO v_existing_sale_id
    FROM public.checkout_idempotency
    WHERE key = p_idempotency_key
      AND cashier_id = v_caller_id;

    IF v_existing_sale_id IS NOT NULL THEN
      SELECT sale_number INTO v_sale_number
      FROM public.sales WHERE id = v_existing_sale_id;
      RETURN jsonb_build_object(
        'success', true,
        'sale_id', v_existing_sale_id,
        'sale_number', v_sale_number,
        'idempotent', true
      );
    END IF;
  END IF;

  -- === Validate payment splits if provided ===
  IF p_payment_splits IS NOT NULL THEN
    IF jsonb_array_length(p_payment_splits) <> 2 THEN
      RAISE EXCEPTION 'Hybrid payment requires exactly 2 payment splits' USING ERRCODE = '23514';
    END IF;

    IF (p_payment_splits->0->>'method') = (p_payment_splits->1->>'method') THEN
      RAISE EXCEPTION 'Hybrid payment methods must be distinct' USING ERRCODE = '23514';
    END IF;

    FOR v_split IN SELECT * FROM jsonb_array_elements(p_payment_splits)
    LOOP
      IF v_split->>'method' NOT IN ('cash', 'card', 'mobile', 'other') THEN
        RAISE EXCEPTION 'Invalid payment method in split: %', v_split->>'method' USING ERRCODE = '23514';
      END IF;
      IF (v_split->>'amount')::numeric <= 0 THEN
        RAISE EXCEPTION 'Split amount must be positive' USING ERRCODE = '23514';
      END IF;
      v_splits_sum := v_splits_sum + (v_split->>'amount')::numeric;
    END LOOP;

    IF abs(v_splits_sum - p_total) > v_epsilon THEN
      RAISE EXCEPTION 'Payment splits sum (%) does not match total (%)', v_splits_sum, p_total
        USING ERRCODE = '23514';
    END IF;

    v_effective_method := 'hybrid';
  ELSE
    IF p_payment_method = 'hybrid' THEN
      RAISE EXCEPTION 'p_payment_splits required when payment_method is hybrid' USING ERRCODE = '23514';
    END IF;
    v_effective_method := p_payment_method;
  END IF;

  -- === Validate items ===
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Cart is empty' USING ERRCODE = '23514';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT pi.quantity, pi.product_id
    INTO v_inv_quantity, v_inv_product_id
    FROM public.product_inventory pi
    WHERE pi.id = (v_item->>'inventoryId')::uuid
      AND pi.store_id = p_store_id;

    IF v_inv_quantity IS NULL THEN
      RAISE EXCEPTION 'Inventory item % not found in store', v_item->>'inventoryId'
        USING ERRCODE = '23503';
    END IF;

    IF v_inv_quantity < (v_item->>'quantity')::int THEN
      RAISE EXCEPTION 'Insufficient stock for inventory %: available=%, requested=%',
        v_item->>'inventoryId', v_inv_quantity, (v_item->>'quantity')::int
        USING ERRCODE = '23514';
    END IF;

    SELECT price, min_price, max_price
    INTO v_product_price, v_product_min_price, v_product_max_price
    FROM public.product_templates
    WHERE id = v_inv_product_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product template % not found for inventory %',
        v_inv_product_id, v_item->>'inventoryId'
        USING ERRCODE = '23503';
    END IF;

    IF v_product_min_price IS NULL AND v_product_max_price IS NULL THEN
      IF abs((v_item->>'price')::numeric - v_product_price) > v_epsilon THEN
        RAISE EXCEPTION 'Price out of range for product %: must be %',
          v_inv_product_id, v_product_price
          USING ERRCODE = '23514';
      END IF;
    ELSE
      IF v_product_min_price IS NOT NULL
         AND (v_item->>'price')::numeric < v_product_min_price - v_epsilon THEN
        RAISE EXCEPTION 'Price below minimum for product %: min=%',
          v_inv_product_id, v_product_min_price
          USING ERRCODE = '23514';
      END IF;
      IF v_product_max_price IS NOT NULL
         AND (v_item->>'price')::numeric > v_product_max_price + v_epsilon THEN
        RAISE EXCEPTION 'Price above maximum for product %: max=%',
          v_inv_product_id, v_product_max_price
          USING ERRCODE = '23514';
      END IF;
    END IF;

    v_computed_subtotal := v_computed_subtotal + (
      (v_item->>'price')::numeric * (v_item->>'quantity')::int
      - COALESCE((v_item->>'discount')::numeric, 0)
    );
  END LOOP;

  IF abs(v_computed_subtotal - p_subtotal) > v_epsilon THEN
    RAISE EXCEPTION 'Subtotal mismatch: computed=%, submitted=%', v_computed_subtotal, p_subtotal
      USING ERRCODE = '23514';
  END IF;

  -- === Create sale (pending) ===
  INSERT INTO public.sales (
    store_id, cashier_id, customer_id, cash_session_id,
    subtotal, tax, discount, total, payment_method, status, notes
  )
  VALUES (
    p_store_id, p_cashier_id, p_customer_id, p_cash_session_id,
    p_subtotal, p_tax, p_discount, p_total, v_effective_method, 'pending', p_notes
  )
  RETURNING id, sale_number INTO v_sale_id, v_sale_number;

  -- === Insert sale_payments for hybrid ===
  IF p_payment_splits IS NOT NULL THEN
    INSERT INTO public.sale_payments (sale_id, payment_method, amount)
    SELECT
      v_sale_id,
      (s->>'method')::text,
      (s->>'amount')::numeric
    FROM jsonb_array_elements(p_payment_splits) s;
  END IF;

  -- === Insert sale_items ===
  INSERT INTO public.sale_items (sale_id, product_id, inventory_id, quantity, unit_price, discount, subtotal)
  SELECT
    v_sale_id,
    (elem->>'productId')::uuid,
    (elem->>'inventoryId')::uuid,
    (elem->>'quantity')::int,
    (elem->>'price')::numeric,
    COALESCE((elem->>'discount')::numeric, 0),
    (elem->>'price')::numeric * (elem->>'quantity')::int - COALESCE((elem->>'discount')::numeric, 0)
  FROM jsonb_array_elements(p_items) AS elem;

  -- === Complete sale → triggers inventory deduction ===
  UPDATE public.sales SET status = 'completed' WHERE id = v_sale_id;

  -- === Update cash_session counters ===
  IF p_cash_session_id IS NOT NULL THEN
    IF p_payment_splits IS NOT NULL THEN
      UPDATE public.cash_sessions
      SET
        transaction_count  = COALESCE(transaction_count, 0) + 1,
        total_cash_sales   = COALESCE(total_cash_sales, 0)   + (SELECT COALESCE(SUM((s->>'amount')::numeric), 0) FROM jsonb_array_elements(p_payment_splits) s WHERE s->>'method' = 'cash'),
        total_card_sales   = COALESCE(total_card_sales, 0)   + (SELECT COALESCE(SUM((s->>'amount')::numeric), 0) FROM jsonb_array_elements(p_payment_splits) s WHERE s->>'method' = 'card'),
        total_mobile_sales = COALESCE(total_mobile_sales, 0) + (SELECT COALESCE(SUM((s->>'amount')::numeric), 0) FROM jsonb_array_elements(p_payment_splits) s WHERE s->>'method' = 'mobile'),
        total_other_sales  = COALESCE(total_other_sales, 0)  + (SELECT COALESCE(SUM((s->>'amount')::numeric), 0) FROM jsonb_array_elements(p_payment_splits) s WHERE s->>'method' NOT IN ('cash', 'card', 'mobile'))
      WHERE id = p_cash_session_id
        AND store_id = p_store_id
        AND status = 'open';

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Cash session % not found, not open, or not in store %',
          p_cash_session_id, p_store_id
          USING ERRCODE = '23503';
      END IF;
    ELSE
      UPDATE public.cash_sessions
      SET
        transaction_count  = COALESCE(transaction_count, 0)  + 1,
        total_cash_sales   = COALESCE(total_cash_sales, 0)   + CASE WHEN v_effective_method = 'cash'   THEN p_total ELSE 0 END,
        total_card_sales   = COALESCE(total_card_sales, 0)   + CASE WHEN v_effective_method = 'card'   THEN p_total ELSE 0 END,
        total_mobile_sales = COALESCE(total_mobile_sales, 0) + CASE WHEN v_effective_method = 'mobile' THEN p_total ELSE 0 END,
        total_other_sales  = COALESCE(total_other_sales, 0)  + CASE WHEN v_effective_method NOT IN ('cash','card','mobile') THEN p_total ELSE 0 END
      WHERE id = p_cash_session_id
        AND store_id = p_store_id
        AND status = 'open';
    END IF;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cash session % not found, not open, or not in store %',
        p_cash_session_id, p_store_id
        USING ERRCODE = '23503';
    END IF;
  END IF;

  -- === Store idempotency key ===
  IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
    INSERT INTO public.checkout_idempotency (key, sale_id, cashier_id)
    VALUES (p_idempotency_key, v_sale_id, v_caller_id);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'sale_id', v_sale_id,
    'sale_number', v_sale_number,
    'idempotent', false
  );
END $function$;
