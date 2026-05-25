BEGIN;
SELECT plan(6);

CREATE TEMP TABLE _hybrid_ids (
  store_id     uuid,
  cashier_id   uuid,
  product_id   uuid,
  inventory_id uuid,
  session_id   uuid
) ON COMMIT DROP;

DO $$
DECLARE
  v_store_id     uuid;
  v_cashier_id   uuid;
  v_product_id   uuid;
  v_inventory_id uuid;
  v_session_id   uuid;
BEGIN
  INSERT INTO public.stores (name, address)
  VALUES ('HybridTestStore', '1 Hybrid Ave')
  RETURNING id INTO v_store_id;

  v_cashier_id := tests.create_test_user('hybrid_cashier', 'cashier');

  INSERT INTO public.user_stores (user_id, store_id, is_default)
  VALUES (v_cashier_id, v_store_id, true);

  UPDATE public.profiles SET store_id = v_store_id WHERE id = v_cashier_id;

  INSERT INTO public.product_templates (sku, name, price)
  VALUES ('HYBRID-SKU-001', 'Hybrid Test Product', 100.00)
  RETURNING id INTO v_product_id;

  INSERT INTO public.product_inventory (product_id, store_id, quantity)
  VALUES (v_product_id, v_store_id, 10)
  RETURNING id INTO v_inventory_id;

  INSERT INTO public.cash_sessions (store_id, cashier_id, opening_balance, status)
  VALUES (v_store_id, v_cashier_id, 0, 'open')
  RETURNING id INTO v_session_id;

  INSERT INTO _hybrid_ids VALUES (v_store_id, v_cashier_id, v_product_id, v_inventory_id, v_session_id);
END;
$$;

-- Test 1: hybrid checkout succeeds
SELECT tests.authenticate_as('hybrid_cashier');

SELECT ok(
  (
    SELECT (result->>'success')::boolean
    FROM public.process_checkout(
      p_store_id       := (SELECT store_id FROM _hybrid_ids),
      p_cashier_id     := (SELECT cashier_id FROM _hybrid_ids),
      p_cash_session_id := (SELECT session_id FROM _hybrid_ids),
      p_payment_method := 'cash',
      p_payment_splits := '[{"method":"cash","amount":60},{"method":"mobile","amount":40}]'::jsonb,
      p_items          := jsonb_build_array(jsonb_build_object(
        'productId',   (SELECT product_id FROM _hybrid_ids),
        'inventoryId', (SELECT inventory_id FROM _hybrid_ids),
        'quantity',    1,
        'price',       100.00,
        'discount',    0
      )),
      p_subtotal       := 100.00,
      p_tax            := 0,
      p_discount       := 0,
      p_total          := 100.00,
      p_idempotency_key := 'hybrid-test-1'
    ) result
  ),
  'hybrid checkout succeeds'
);

-- Test 2: sale has payment_method = 'hybrid'
SELECT is(
  (SELECT payment_method FROM public.sales
   WHERE cashier_id = (SELECT cashier_id FROM _hybrid_ids)
   ORDER BY created_at DESC LIMIT 1),
  'hybrid',
  'sale.payment_method is hybrid'
);

-- Test 3: sale_payments has 2 rows
SELECT is(
  (SELECT COUNT(*)::int FROM public.sale_payments sp
   JOIN public.sales s ON s.id = sp.sale_id
   WHERE s.cashier_id = (SELECT cashier_id FROM _hybrid_ids)),
  2,
  'sale_payments has 2 rows for hybrid sale'
);

-- Test 4: cash_sessions total_cash_sales distributed correctly
SELECT is(
  (SELECT total_cash_sales FROM public.cash_sessions WHERE id = (SELECT session_id FROM _hybrid_ids)),
  60.00::numeric(12,2),
  'cash_session.total_cash_sales = 60'
);

-- Test 5: cash_sessions total_mobile_sales distributed correctly
SELECT is(
  (SELECT total_mobile_sales FROM public.cash_sessions WHERE id = (SELECT session_id FROM _hybrid_ids)),
  40.00::numeric(12,2),
  'cash_session.total_mobile_sales = 40'
);

-- Test 6: mismatched split sum is rejected
SELECT throws_ok(
  $t$
    SELECT public.process_checkout(
      p_store_id       := (SELECT store_id FROM _hybrid_ids),
      p_cashier_id     := (SELECT cashier_id FROM _hybrid_ids),
      p_payment_splits := '[{"method":"cash","amount":30},{"method":"mobile","amount":40}]'::jsonb,
      p_items          := jsonb_build_array(jsonb_build_object(
        'productId',   (SELECT product_id FROM _hybrid_ids),
        'inventoryId', (SELECT inventory_id FROM _hybrid_ids),
        'quantity',    1,
        'price',       100.00,
        'discount',    0
      )),
      p_subtotal       := 100.00,
      p_tax            := 0,
      p_discount       := 0,
      p_total          := 100.00,
      p_idempotency_key := 'hybrid-test-bad-sum'
    )
  $t$,
  '23514',
  'rejects splits that do not sum to total'
);

SELECT * FROM finish();
ROLLBACK;
