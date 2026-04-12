BEGIN;
SELECT plan(8);

-- ============================================================
-- Setup
-- ============================================================
CREATE TEMP TABLE _phase4_ids (
  store_id     uuid,
  cashier_id   uuid,
  product_id   uuid,
  inventory_id uuid
) ON COMMIT DROP;

DO $$
DECLARE
  v_store_id     uuid;
  v_cashier_id   uuid;
  v_product_id   uuid;
  v_inventory_id uuid;
BEGIN
  INSERT INTO public.stores (name, address)
  VALUES ('Phase4TestStore', '1 Test Ave')
  RETURNING id INTO v_store_id;

  v_cashier_id := tests.create_test_user('phase4_cashier', 'cashier');

  INSERT INTO public.user_stores (user_id, store_id, is_default)
  VALUES (v_cashier_id, v_store_id, true);

  UPDATE public.profiles SET store_id = v_store_id WHERE id = v_cashier_id;

  INSERT INTO public.product_templates (sku, name, price, min_price, max_price)
  VALUES ('PHASE4-SKU-001', 'Phase4 Test Product', 100.00, NULL, NULL)
  RETURNING id INTO v_product_id;

  INSERT INTO public.product_inventory (product_id, store_id, quantity)
  VALUES (v_product_id, v_store_id, 10)
  RETURNING id INTO v_inventory_id;

  INSERT INTO _phase4_ids VALUES (v_store_id, v_cashier_id, v_product_id, v_inventory_id);
END $$;

-- Set JWT claims so auth.uid() resolves correctly inside SECURITY DEFINER functions.
-- RESET ROLE restores postgres while keeping set_config GUC values in the transaction.
DO $$ BEGIN PERFORM tests.authenticate_as((SELECT cashier_id FROM _phase4_ids)); END $$;
RESET ROLE;

-- ============================================================
-- Test 1: function exists
-- ============================================================
SELECT has_function(
  'public',
  'process_checkout',
  'Test 1: public.process_checkout function exists'
);

-- ============================================================
-- Test 2: nominal checkout succeeds
-- ============================================================
SELECT ok(
  (
    SELECT (public.process_checkout(
      p_store_id        := ids.store_id,
      p_cashier_id      := ids.cashier_id,
      p_payment_method  := 'cash',
      p_items           := jsonb_build_array(
        jsonb_build_object(
          'inventoryId', ids.inventory_id,
          'productId',   ids.product_id,
          'quantity',    2,
          'price',       100.00,
          'discount',    0
        )
      ),
      p_subtotal        := 200.00,
      p_tax             := 0,
      p_discount        := 0,
      p_total           := 200.00,
      p_idempotency_key := ''
    ) ->> 'success')::boolean
    FROM _phase4_ids ids
  ),
  'Test 2: nominal checkout returns success=true'
);

-- ============================================================
-- Test 3: stock decremented after checkout
-- ============================================================
SELECT ok(
  (
    SELECT pi.quantity = 8   -- started at 10, sold 2
    FROM public.product_inventory pi
    JOIN _phase4_ids ids ON pi.id = ids.inventory_id
  ),
  'Test 3: inventory quantity decremented by 2 after checkout'
);

-- ============================================================
-- Test 4: idempotent retry returns same sale_id + idempotent=true
-- ============================================================
SELECT ok(
  (
    WITH ids AS (SELECT * FROM _phase4_ids),
    first_result AS (
      SELECT public.process_checkout(
        p_store_id        := ids.store_id,
        p_cashier_id      := ids.cashier_id,
        p_payment_method  := 'cash',
        p_items           := jsonb_build_array(
          jsonb_build_object(
            'inventoryId', ids.inventory_id,
            'productId',   ids.product_id,
            'quantity',    1,
            'price',       100.00,
            'discount',    0
          )
        ),
        p_subtotal        := 100.00,
        p_tax             := 0,
        p_discount        := 0,
        p_total           := 100.00,
        p_idempotency_key := 'phase4-idem-test-key-001'
      ) AS res
      FROM ids
    ),
    second_result AS (
      SELECT public.process_checkout(
        p_store_id        := ids.store_id,
        p_cashier_id      := ids.cashier_id,
        p_payment_method  := 'cash',
        p_items           := jsonb_build_array(
          jsonb_build_object(
            'inventoryId', ids.inventory_id,
            'productId',   ids.product_id,
            'quantity',    1,
            'price',       100.00,
            'discount',    0
          )
        ),
        p_subtotal        := 100.00,
        p_tax             := 0,
        p_discount        := 0,
        p_total           := 100.00,
        p_idempotency_key := 'phase4-idem-test-key-001'
      ) AS res
      FROM ids
    )
    SELECT
      (second_result.res->>'idempotent')::boolean = true
      AND second_result.res->>'sale_id' = first_result.res->>'sale_id'
    FROM first_result, second_result
  ),
  'Test 4: idempotent retry returns same sale_id and idempotent=true'
);

-- ============================================================
-- Test 5: stock unchanged after idempotent retry
-- (test2 sold 2, test4 first call sold 1 → qty=7; retry must NOT deduct again)
-- ============================================================
SELECT ok(
  (
    SELECT pi.quantity = 7
    FROM public.product_inventory pi
    JOIN _phase4_ids ids ON pi.id = ids.inventory_id
  ),
  'Test 5: stock unchanged after idempotent retry (no double-deduction)'
);

-- ============================================================
-- Test 6: price out of range rejected
-- (product price=100, no min/max → deviation > 0.005 must fail)
-- ============================================================
SELECT throws_ok(
  format(
    $q$
      SELECT public.process_checkout(
        p_store_id        := %L::uuid,
        p_cashier_id      := %L::uuid,
        p_payment_method  := 'cash',
        p_items           := jsonb_build_array(
          jsonb_build_object(
            'inventoryId', %L::uuid,
            'productId',   %L::uuid,
            'quantity',    1,
            'price',       50.00,
            'discount',    0
          )
        ),
        p_subtotal        := 50.00,
        p_tax             := 0,
        p_discount        := 0,
        p_total           := 50.00,
        p_idempotency_key := %L
      )
    $q$,
    (SELECT store_id     FROM _phase4_ids),
    (SELECT cashier_id   FROM _phase4_ids),
    (SELECT inventory_id FROM _phase4_ids),
    (SELECT product_id   FROM _phase4_ids),
    ''
  ),
  '23514',
  NULL,
  'Test 6: price far out of range raises exception'
);

-- ============================================================
-- Test 7: insufficient stock rejected
-- ============================================================
SELECT throws_ok(
  format(
    $q$
      SELECT public.process_checkout(
        p_store_id        := %L::uuid,
        p_cashier_id      := %L::uuid,
        p_payment_method  := 'cash',
        p_items           := jsonb_build_array(
          jsonb_build_object(
            'inventoryId', %L::uuid,
            'productId',   %L::uuid,
            'quantity',    999,
            'price',       100.00,
            'discount',    0
          )
        ),
        p_subtotal        := 99900.00,
        p_tax             := 0,
        p_discount        := 0,
        p_total           := 99900.00,
        p_idempotency_key := %L
      )
    $q$,
    (SELECT store_id     FROM _phase4_ids),
    (SELECT cashier_id   FROM _phase4_ids),
    (SELECT inventory_id FROM _phase4_ids),
    (SELECT product_id   FROM _phase4_ids),
    ''
  ),
  '23514',
  NULL,
  'Test 7: insufficient stock raises exception'
);

-- ============================================================
-- Test 8: empty cart rejected
-- ============================================================
SELECT throws_ok(
  format(
    $q$
      SELECT public.process_checkout(
        p_store_id        := %L::uuid,
        p_cashier_id      := %L::uuid,
        p_payment_method  := 'cash',
        p_items           := '[]'::jsonb,
        p_subtotal        := 0,
        p_tax             := 0,
        p_discount        := 0,
        p_total           := 0,
        p_idempotency_key := %L
      )
    $q$,
    (SELECT store_id   FROM _phase4_ids),
    (SELECT cashier_id FROM _phase4_ids),
    ''
  ),
  '23514',
  NULL,
  'Test 8: empty cart raises exception'
);

SELECT * FROM finish();
ROLLBACK;
