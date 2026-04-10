-- Phase 1: Privilege Escalation Tests
-- Tests 1-2: profiles.role self-elevation (#20)
-- Test 3:    admin can change another user's role
-- Test 4:    change_user_role() not callable from public schema (#21)
-- Tests 5-6: manager_pins RLS (#22)

BEGIN;
SELECT plan(6);

-- ============================================================
-- Setup: create test users (runs as postgres superuser)
-- ============================================================
DO $$
DECLARE
  v_cashier uuid;
  v_admin   uuid;
BEGIN
  v_cashier := tests.create_test_user('p1_cashier', 'cashier');
  v_admin   := tests.create_test_user('p1_admin',   'admin');
  -- Stash IDs in temp table for use by later SQL statements
  CREATE TEMP TABLE _p1_users (cashier_id uuid, admin_id uuid);
  INSERT INTO _p1_users VALUES (v_cashier, v_admin);
  -- Allow authenticated role to read IDs from the temp table
  GRANT SELECT ON _p1_users TO authenticated;
END $$;

-- ============================================================
-- Test 1: Cashier CANNOT self-elevate to admin via profiles UPDATE
-- ============================================================
DO $$ BEGIN PERFORM tests.authenticate_as((SELECT cashier_id FROM _p1_users)); END $$;
SET LOCAL ROLE authenticated;

SELECT throws_ok(
  $$ UPDATE public.profiles SET role = 'admin' WHERE id = (SELECT auth.uid()) $$,
  '42501',
  'Only administrators can change user roles',
  'Test 1: cashier cannot self-elevate to admin'
);

RESET ROLE;
SELECT tests.clear_authentication();

-- ============================================================
-- Test 2: Cashier role is UNCHANGED after attempted elevation
-- ============================================================
SELECT is(
  (SELECT role::text FROM public.profiles WHERE id = (SELECT cashier_id FROM _p1_users)),
  'cashier',
  'Test 2: cashier role unchanged after attempted self-elevation'
);

-- ============================================================
-- Test 3: Admin CAN change a cashier's role to manager
-- ============================================================
DO $$ BEGIN PERFORM tests.authenticate_as((SELECT admin_id FROM _p1_users)); END $$;
SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $$ UPDATE public.profiles SET role = 'manager' WHERE id = (SELECT cashier_id FROM _p1_users) $$,
  'Test 3: admin can change cashier role to manager'
);

RESET ROLE;
SELECT tests.clear_authentication();

-- ============================================================
-- Test 4: change_user_role() is NOT in public schema
-- (after fix it moves to private; currently FAILS = RED)
-- ============================================================
SELECT hasnt_function(
  'public',
  'change_user_role',
  ARRAY['text', 'text'],
  'Test 4: change_user_role() is not callable from public schema'
);

-- ============================================================
-- Test 5: Cashier CANNOT insert a manager_pin
-- NOTE: Test 3 promoted p1_cashier to manager — reset to cashier first
-- ============================================================
UPDATE public.profiles SET role = 'cashier' WHERE id = (SELECT cashier_id FROM _p1_users);

DO $$ BEGIN PERFORM tests.authenticate_as((SELECT cashier_id FROM _p1_users)); END $$;
SET LOCAL ROLE authenticated;

SELECT throws_ok(
  $$ INSERT INTO public.manager_pins (user_id, pin_hash) VALUES ((SELECT auth.uid()), 'fakehash') $$,
  '42501',
  NULL,
  'Test 5: cashier cannot insert manager_pin'
);

RESET ROLE;
SELECT tests.clear_authentication();

-- ============================================================
-- Test 6: Admin CAN insert their own manager_pin
-- ============================================================
DO $$ BEGIN PERFORM tests.authenticate_as((SELECT admin_id FROM _p1_users)); END $$;
SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $$ INSERT INTO public.manager_pins (user_id, pin_hash) VALUES ((SELECT auth.uid()), 'adminhash') $$,
  'Test 6: admin can insert their own manager_pin'
);

RESET ROLE;
SELECT tests.clear_authentication();

SELECT * FROM finish();
ROLLBACK;
