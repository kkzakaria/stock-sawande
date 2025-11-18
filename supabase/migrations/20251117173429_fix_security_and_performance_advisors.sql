-- ============================================================================
-- FIX SECURITY AND PERFORMANCE ADVISORS
-- ============================================================================
-- This migration addresses Supabase security and performance advisors:
-- SECURITY: Protect internal functions from public API access
-- PERFORMANCE: Add indexes on frequently queried columns
-- ============================================================================

-- ============================================================================
-- PART 1: SECURITY - Revoke public access to internal functions
-- ============================================================================

-- CRITICAL: Admin function should NOT be callable via API
-- Only service_role should be able to change user roles
REVOKE EXECUTE ON FUNCTION public.change_user_role(text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.change_user_role(text, text) TO service_role;

COMMENT ON FUNCTION public.change_user_role(text, text) IS
  'Admin-only function to change user roles.
   Only accessible via service_role (backend/admin panel).
   NOT accessible via public API for security reasons.';

-- INTERNAL: Trigger functions should NOT be callable via API
-- These are automatically called by database triggers only
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_updated_at() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.create_stock_movement_on_product_update() FROM anon, authenticated, public;

COMMENT ON FUNCTION public.handle_new_user() IS
  'Trigger function - automatically creates profile for new users.
   Internal use only, not accessible via API.';

COMMENT ON FUNCTION public.handle_updated_at() IS
  'Trigger function - automatically updates updated_at timestamps.
   Internal use only, not accessible via API.';

COMMENT ON FUNCTION public.update_updated_at_column() IS
  'Trigger function - helper for updating timestamps.
   Internal use only, not accessible via API.';

COMMENT ON FUNCTION public.create_stock_movement_on_product_update() IS
  'Trigger function - creates stock movement records on product updates.
   Internal use only, not accessible via API.';

-- KEEP PUBLIC: RLS helper functions MUST remain accessible
-- These are used in RLS policies and need to be callable
-- Already granted in previous migration, but confirming here
GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_store_id() TO authenticated;

COMMENT ON FUNCTION public.get_current_user_role() IS
  'RLS helper function - returns current user role.
   Must be accessible to authenticated users for RLS policies.
   Optimized with SELECT wrapper for performance.';

COMMENT ON FUNCTION public.get_current_user_store_id() IS
  'RLS helper function - returns current user store_id.
   Must be accessible to authenticated users for RLS policies.
   Optimized with SELECT wrapper for performance.';

-- ============================================================================
-- PART 2: PERFORMANCE - Add indexes on frequently queried columns
-- ============================================================================

-- HIGH PRIORITY: Email lookup on stores (for contact/search)
CREATE INDEX IF NOT EXISTS idx_stores_email
ON public.stores USING btree (email);

COMMENT ON INDEX public.idx_stores_email IS
  'Performance: Optimize email lookups and searches on stores table';

-- MEDIUM PRIORITY: Product name search
CREATE INDEX IF NOT EXISTS idx_products_name
ON public.products USING btree (name);

COMMENT ON INDEX public.idx_products_name IS
  'Performance: Optimize product search by name (autocomplete, filtering)';

-- LOW PRIORITY: Timestamp columns for sorting/filtering
-- Only add if these columns are frequently used in ORDER BY or WHERE clauses

-- Categories timestamps
CREATE INDEX IF NOT EXISTS idx_categories_created_at
ON public.categories USING btree (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_categories_updated_at
ON public.categories USING btree (updated_at DESC);

-- Products timestamps (likely used for "new products", "recently updated")
CREATE INDEX IF NOT EXISTS idx_products_created_at
ON public.products USING btree (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_products_updated_at
ON public.products USING btree (updated_at DESC);

-- Profiles timestamps
CREATE INDEX IF NOT EXISTS idx_profiles_created_at
ON public.profiles USING btree (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_profiles_updated_at
ON public.profiles USING btree (updated_at DESC);

-- Stores timestamps
CREATE INDEX IF NOT EXISTS idx_stores_created_at
ON public.stores USING btree (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stores_updated_at
ON public.stores USING btree (updated_at DESC);

-- ============================================================================
-- PART 3: VERIFICATION QUERIES
-- ============================================================================

-- Verify function permissions (for documentation)
COMMENT ON SCHEMA public IS
  'Security verification:
   - Admin functions: Only service_role
   - Trigger functions: No public access
   - RLS helpers: authenticated only

   Performance verification:
   - High-value columns indexed: email, name
   - Timestamp columns indexed for sorting

   Run: SELECT * FROM pg_indexes WHERE schemaname = ''public'';
   To see all indexes';
