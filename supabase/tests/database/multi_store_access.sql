BEGIN;
SELECT plan(14);

-- ============================================================
-- Setup: create stores, users with different store assignments
-- ============================================================
DO $$
DECLARE
  v_store_a uuid;
  v_store_b uuid;
  v_store_c uuid;
  v_admin uuid;
  v_manager_multi uuid;  -- assigned to store A + B
  v_manager_single uuid; -- assigned to store A only
  v_cashier uuid;        -- assigned to store A only
BEGIN
  -- Create 3 stores
  INSERT INTO public.stores (id, name, address)
  VALUES (gen_random_uuid(), 'Store A', 'Addr A') RETURNING id INTO v_store_a;
  INSERT INTO public.stores (id, name, address)
  VALUES (gen_random_uuid(), 'Store B', 'Addr B') RETURNING id INTO v_store_b;
  INSERT INTO public.stores (id, name, address)
  VALUES (gen_random_uuid(), 'Store C', 'Addr C') RETURNING id INTO v_store_c;

  -- Create users
  v_admin := tests.create_test_user('ms_admin', 'admin');
  v_manager_multi := tests.create_test_user('ms_mgr_multi', 'manager');
  v_manager_single := tests.create_test_user('ms_mgr_single', 'manager');
  v_cashier := tests.create_test_user('ms_cashier', 'cashier');

  -- Assign stores
  -- manager_multi → Store A + Store B
  INSERT INTO public.user_stores (user_id, store_id, is_default)
  VALUES (v_manager_multi, v_store_a, true), (v_manager_multi, v_store_b, false);
  UPDATE public.profiles SET store_id = v_store_a WHERE id = v_manager_multi;

  -- manager_single → Store A only
  INSERT INTO public.user_stores (user_id, store_id, is_default)
  VALUES (v_manager_single, v_store_a, true);
  UPDATE public.profiles SET store_id = v_store_a WHERE id = v_manager_single;

  -- cashier → Store A only
  INSERT INTO public.user_stores (user_id, store_id, is_default)
  VALUES (v_cashier, v_store_a, true);
  UPDATE public.profiles SET store_id = v_store_a WHERE id = v_cashier;

  -- Stash in temp table
  CREATE TEMP TABLE _ms_fixtures (
    store_a uuid, store_b uuid, store_c uuid,
    admin_id uuid, mgr_multi uuid, mgr_single uuid, cashier_id uuid
  );
  INSERT INTO _ms_fixtures VALUES (
    v_store_a, v_store_b, v_store_c,
    v_admin, v_manager_multi, v_manager_single, v_cashier
  );
  GRANT SELECT ON _ms_fixtures TO authenticated;
END $$;

-- ============================================================
-- Test 1: user_has_store_access() function exists
-- ============================================================
SELECT has_function('public', 'user_has_store_access', ARRAY['uuid'],
  'Test 1: user_has_store_access(uuid) exists');

-- ============================================================
-- Test 2: Admin has access to ANY store (Store C not assigned to anyone)
-- ============================================================
DO $$ BEGIN PERFORM tests.authenticate_as((SELECT admin_id FROM _ms_fixtures)); END $$;
SELECT ok(
  public.user_has_store_access((SELECT store_c FROM _ms_fixtures)),
  'Test 2: admin has access to unassigned Store C'
);
RESET ROLE;
SELECT tests.clear_authentication();

-- ============================================================
-- Test 3: Multi-store manager has access to Store A
-- ============================================================
DO $$ BEGIN PERFORM tests.authenticate_as((SELECT mgr_multi FROM _ms_fixtures)); END $$;
SELECT ok(
  public.user_has_store_access((SELECT store_a FROM _ms_fixtures)),
  'Test 3: multi-store manager has access to Store A'
);
RESET ROLE;
SELECT tests.clear_authentication();

-- ============================================================
-- Test 4: Multi-store manager has access to Store B
-- ============================================================
DO $$ BEGIN PERFORM tests.authenticate_as((SELECT mgr_multi FROM _ms_fixtures)); END $$;
SELECT ok(
  public.user_has_store_access((SELECT store_b FROM _ms_fixtures)),
  'Test 4: multi-store manager has access to Store B'
);
RESET ROLE;
SELECT tests.clear_authentication();

-- ============================================================
-- Test 5: Multi-store manager does NOT have access to Store C
-- ============================================================
DO $$ BEGIN PERFORM tests.authenticate_as((SELECT mgr_multi FROM _ms_fixtures)); END $$;
SELECT ok(
  NOT public.user_has_store_access((SELECT store_c FROM _ms_fixtures)),
  'Test 5: multi-store manager blocked from Store C'
);
RESET ROLE;
SELECT tests.clear_authentication();

-- ============================================================
-- Test 6: Single-store manager has access to Store A
-- ============================================================
DO $$ BEGIN PERFORM tests.authenticate_as((SELECT mgr_single FROM _ms_fixtures)); END $$;
SELECT ok(
  public.user_has_store_access((SELECT store_a FROM _ms_fixtures)),
  'Test 6: single-store manager has access to Store A'
);
RESET ROLE;
SELECT tests.clear_authentication();

-- ============================================================
-- Test 7: Single-store manager does NOT have access to Store B
-- ============================================================
DO $$ BEGIN PERFORM tests.authenticate_as((SELECT mgr_single FROM _ms_fixtures)); END $$;
SELECT ok(
  NOT public.user_has_store_access((SELECT store_b FROM _ms_fixtures)),
  'Test 7: single-store manager blocked from Store B'
);
RESET ROLE;
SELECT tests.clear_authentication();

-- ============================================================
-- Test 8: Cashier has access to assigned Store A
-- ============================================================
DO $$ BEGIN PERFORM tests.authenticate_as((SELECT cashier_id FROM _ms_fixtures)); END $$;
SELECT ok(
  public.user_has_store_access((SELECT store_a FROM _ms_fixtures)),
  'Test 8: cashier has access to assigned Store A'
);
RESET ROLE;
SELECT tests.clear_authentication();

-- ============================================================
-- Test 9: Cashier does NOT have access to Store B
-- ============================================================
DO $$ BEGIN PERFORM tests.authenticate_as((SELECT cashier_id FROM _ms_fixtures)); END $$;
SELECT ok(
  NOT public.user_has_store_access((SELECT store_b FROM _ms_fixtures)),
  'Test 9: cashier blocked from Store B'
);
RESET ROLE;
SELECT tests.clear_authentication();

-- ============================================================
-- Test 10: Multi-store manager can SELECT sales from Store B
-- (RLS policy uses user_has_store_access after migration)
-- ============================================================
-- Create a sale in Store B by admin first
DO $$ BEGIN PERFORM tests.authenticate_as((SELECT admin_id FROM _ms_fixtures)); END $$;
SET LOCAL ROLE authenticated;
INSERT INTO public.sales (store_id, cashier_id, subtotal, tax, discount, total, payment_method, status)
VALUES (
  (SELECT store_b FROM _ms_fixtures),
  (SELECT admin_id FROM _ms_fixtures),
  100, 0, 0, 100, 'cash', 'completed'
);
RESET ROLE;
SELECT tests.clear_authentication();

-- Now manager_multi should be able to see it
DO $$ BEGIN PERFORM tests.authenticate_as((SELECT mgr_multi FROM _ms_fixtures)); END $$;
SET LOCAL ROLE authenticated;
SELECT ok(
  (SELECT count(*) FROM public.sales WHERE store_id = (SELECT store_b FROM _ms_fixtures)) > 0,
  'Test 10: multi-store manager can SELECT sales from Store B'
);
RESET ROLE;
SELECT tests.clear_authentication();

-- ============================================================
-- Test 11: Single-store manager CANNOT SELECT sales from Store B
-- ============================================================
DO $$ BEGIN PERFORM tests.authenticate_as((SELECT mgr_single FROM _ms_fixtures)); END $$;
SET LOCAL ROLE authenticated;
SELECT ok(
  (SELECT count(*) FROM public.sales WHERE store_id = (SELECT store_b FROM _ms_fixtures)) = 0,
  'Test 11: single-store manager cannot SELECT sales from Store B'
);
RESET ROLE;
SELECT tests.clear_authentication();

-- ============================================================
-- Test 12: NULL store_id returns false (edge case)
-- ============================================================
DO $$ BEGIN PERFORM tests.authenticate_as((SELECT admin_id FROM _ms_fixtures)); END $$;
SELECT ok(
  NOT public.user_has_store_access(NULL),
  'Test 12: NULL store_id returns false'
);
RESET ROLE;
SELECT tests.clear_authentication();

-- ============================================================
-- Test 13: Legacy-only user (no user_stores, only profiles.store_id)
-- Fallback should grant access to their profiles.store_id
-- ============================================================
DO $$
DECLARE
  v_legacy_user uuid;
BEGIN
  v_legacy_user := tests.create_test_user('ms_legacy_user', 'manager');
  -- Set profiles.store_id but do NOT insert into user_stores
  UPDATE public.profiles SET store_id = (SELECT store_a FROM _ms_fixtures) WHERE id = v_legacy_user;
  -- Stash in temp table
  CREATE TEMP TABLE _ms_legacy (legacy_id uuid);
  INSERT INTO _ms_legacy VALUES (v_legacy_user);
  GRANT SELECT ON _ms_legacy TO authenticated;
END $$;

DO $$ BEGIN PERFORM tests.authenticate_as((SELECT legacy_id FROM _ms_legacy)); END $$;
SELECT ok(
  public.user_has_store_access((SELECT store_a FROM _ms_fixtures)),
  'Test 13: legacy user (no user_stores) gets access via profiles.store_id fallback'
);
SELECT ok(
  NOT public.user_has_store_access((SELECT store_b FROM _ms_fixtures)),
  'Test 13b: legacy user (no user_stores) denied access to store not in profiles.store_id'
);
RESET ROLE;
SELECT tests.clear_authentication();

-- ============================================================
-- Test 14: profiles.store_id disagrees with user_stores (no widening)
-- mgr_multi has user_stores for A+B; profiles.store_id set to C
-- Fallback must NOT fire because user_stores rows exist
-- ============================================================
DO $$
BEGIN
  UPDATE public.profiles
  SET store_id = (SELECT store_c FROM _ms_fixtures)
  WHERE id = (SELECT mgr_multi FROM _ms_fixtures);
END $$;

DO $$ BEGIN PERFORM tests.authenticate_as((SELECT mgr_multi FROM _ms_fixtures)); END $$;
SELECT ok(
  NOT public.user_has_store_access((SELECT store_c FROM _ms_fixtures)),
  'Test 14: profiles.store_id widening blocked — fallback does not fire when user_stores rows exist'
);
RESET ROLE;
SELECT tests.clear_authentication();

-- Restore profiles.store_id for mgr_multi back to store_a
DO $$
BEGIN
  UPDATE public.profiles
  SET store_id = (SELECT store_a FROM _ms_fixtures)
  WHERE id = (SELECT mgr_multi FROM _ms_fixtures);
END $$;

SELECT * FROM finish();
ROLLBACK;
