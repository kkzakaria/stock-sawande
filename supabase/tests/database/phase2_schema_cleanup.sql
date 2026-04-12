BEGIN;
SELECT plan(5);

-- Test 1: products_backup_old table must NOT exist
SELECT is_empty(
  $$ SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'products_backup_old' $$,
  'Test 1: Legacy table products_backup_old has been removed'
);

-- Test 2: ALL SECURITY DEFINER functions in public schema must use search_path=''
-- Note: search_path='' is stored as search_path="" in proconfig
SELECT is_empty(
  $$ SELECT p.proname
     FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.prosecdef = true
       AND NOT (
         p.proconfig @> ARRAY['search_path=""']
         OR p.proconfig @> ARRAY['search_path=']
       ) $$,
  'Test 2: All SECURITY DEFINER functions in public use search_path=""'
);

-- Test 3: business_settings.updated_by has a covering index
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'business_settings'
      AND indexdef LIKE '%updated_by%'
  ),
  'Test 3: business_settings.updated_by has a covering index'
);

-- Test 4: stores UPDATE policy has WITH CHECK
SELECT ok(
  (SELECT with_check IS NOT NULL FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'stores'
     AND policyname = 'Admins can update stores'),
  'Test 4: stores UPDATE policy has WITH CHECK'
);

-- Test 5: categories UPDATE policy has WITH CHECK
SELECT ok(
  (SELECT with_check IS NOT NULL FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'categories'
     AND policyname = 'Admin and managers can update categories'),
  'Test 5: categories UPDATE policy has WITH CHECK'
);

SELECT * FROM finish();
ROLLBACK;
