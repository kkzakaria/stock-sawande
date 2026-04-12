-- Phase 4: process_checkout() RPC + idempotency table
-- Fixes: #26 (atomicity), #27 (race condition counters), #28 (price epsilon), #29 (idempotency)

-- ============================================================
-- 1. Idempotency table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.checkout_idempotency (
  key text PRIMARY KEY,
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  cashier_id uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checkout_idempotency_created_at
  ON public.checkout_idempotency(created_at);

ALTER TABLE public.checkout_idempotency ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own idempotency keys"
  ON public.checkout_idempotency FOR SELECT TO authenticated
  USING (cashier_id = (SELECT auth.uid()));

-- ============================================================
-- 2. process_checkout() RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.process_checkout(
  p_store_id uuid,
  p_cashier_id uuid,
  p_customer_id uuid DEFAULT NULL,
  p_cash_session_id uuid DEFAULT NULL,
  p_payment_method text DEFAULT 'cash',
  p_items jsonb DEFAULT '[]'::jsonb,
  p_subtotal numeric DEFAULT 0,
  p_tax numeric DEFAULT 0,
  p_discount numeric DEFAULT 0,
  p_total numeric DEFAULT 0,
  p_notes text DEFAULT '',
  p_idempotency_key text DEFAULT ''
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_caller_id uuid := (SELECT auth.uid());
  v_caller_role public.user_role;
  v_sale_id uuid;
  v_sale_number text;
  v_existing_sale_id uuid;
  v_item jsonb;
  v_inv_quantity integer;
  v_inv_product_id uuid;
  v_product_price numeric;
  v_product_min_price numeric;
  v_product_max_price numeric;
  v_epsilon numeric := 0.005;
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

  -- Store access: admin can access all, others check user_stores
  IF v_caller_role <> 'admin'::public.user_role THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_stores WHERE user_id = v_caller_id AND store_id = p_store_id
    ) THEN
      -- Fallback: also check legacy profiles.store_id for backwards compat
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
    WHERE key = p_idempotency_key;

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

  -- === Validate items ===
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Cart is empty' USING ERRCODE = '23514';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Check inventory exists and has enough stock
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

    -- Check price within allowed range
    SELECT price, min_price, max_price
    INTO v_product_price, v_product_min_price, v_product_max_price
    FROM public.product_templates
    WHERE id = v_inv_product_id;

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
  END LOOP;

  -- === Create sale (pending) ===
  INSERT INTO public.sales (
    store_id, cashier_id, customer_id, cash_session_id,
    subtotal, tax, discount, total, payment_method, status, notes
  )
  VALUES (
    p_store_id, p_cashier_id, p_customer_id, p_cash_session_id,
    p_subtotal, p_tax, p_discount, p_total, p_payment_method, 'pending', p_notes
  )
  RETURNING id, sale_number INTO v_sale_id, v_sale_number;

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

  -- === Update cash_session counters atomically (#27) ===
  IF p_cash_session_id IS NOT NULL THEN
    UPDATE public.cash_sessions
    SET transaction_count  = COALESCE(transaction_count, 0)  + 1,
        total_cash_sales   = COALESCE(total_cash_sales, 0)   + CASE WHEN p_payment_method = 'cash'   THEN p_total ELSE 0 END,
        total_card_sales   = COALESCE(total_card_sales, 0)   + CASE WHEN p_payment_method = 'card'   THEN p_total ELSE 0 END,
        total_mobile_sales = COALESCE(total_mobile_sales, 0) + CASE WHEN p_payment_method = 'mobile' THEN p_total ELSE 0 END,
        total_other_sales  = COALESCE(total_other_sales, 0)  + CASE WHEN p_payment_method NOT IN ('cash','card','mobile') THEN p_total ELSE 0 END
    WHERE id = p_cash_session_id;
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

GRANT EXECUTE ON FUNCTION public.process_checkout TO authenticated;
