-- ============================================================================
-- SEED DATA FOR DEVELOPMENT AND TESTING
-- ============================================================================
-- This file contains test data for local development
-- Run with: supabase db reset (resets and applies migrations + seed)

-- ============================================================================
-- STORES
-- ============================================================================
DELETE FROM public.stores;

INSERT INTO public.stores (id, name, address, phone, email) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Downtown Store', '123 Main Street, New York, NY 10001', '+1-555-0101', 'downtown@nextstock.com'),
  ('22222222-2222-2222-2222-222222222222', 'Uptown Store', '456 Park Avenue, New York, NY 10022', '+1-555-0102', 'uptown@nextstock.com'),
  ('33333333-3333-3333-3333-333333333333', 'Brooklyn Store', '789 Atlantic Avenue, Brooklyn, NY 11217', '+1-555-0103', 'brooklyn@nextstock.com');

-- ============================================================================
-- TEST USERS
-- ============================================================================
-- Users are now seeded using the Supabase Admin API (recommended approach)
-- Run: pnpm seed:users (after running supabase db reset)
-- See: supabase/seed.ts for user seeding implementation
-- Password for all test users: "password123"

-- ============================================================================
-- SAMPLE PRODUCTS
-- ============================================================================
INSERT INTO public.products (sku, name, description, category_id, price, cost, quantity, min_stock_level, store_id, barcode, is_active) VALUES
  ('ELEC-001', 'Wireless Mouse', 'Ergonomic wireless mouse with USB receiver',
   (SELECT id FROM public.categories WHERE name = 'Electronics' LIMIT 1),
   29.99, 15.00, 45, 10, '11111111-1111-1111-1111-111111111111', '1234567890001', true),
  ('ELEC-002', 'USB-C Cable', '2m braided USB-C charging cable',
   (SELECT id FROM public.categories WHERE name = 'Electronics' LIMIT 1),
   12.99, 5.00, 120, 20, '11111111-1111-1111-1111-111111111111', '1234567890002', true),
  ('CLOTH-001', 'Cotton T-Shirt', 'Premium cotton t-shirt - Various colors',
   (SELECT id FROM public.categories WHERE name = 'Clothing' LIMIT 1),
   19.99, 8.00, 75, 15, '11111111-1111-1111-1111-111111111111', '1234567890003', true),
  ('BOOK-001', 'JavaScript Guide', 'Complete JavaScript programming guide',
   (SELECT id FROM public.categories WHERE name = 'Books & Media' LIMIT 1),
   39.99, 20.00, 30, 5, '22222222-2222-2222-2222-222222222222', '1234567890004', true),
  ('SPORT-001', 'Yoga Mat', 'Non-slip exercise yoga mat with carry strap',
   (SELECT id FROM public.categories WHERE name = 'Sports & Outdoors' LIMIT 1),
   34.99, 15.00, 25, 8, '22222222-2222-2222-2222-222222222222', '1234567890005', true),
  ('HEALTH-001', 'Vitamin C Supplement', 'Daily vitamin C 1000mg - 60 tablets',
   (SELECT id FROM public.categories WHERE name = 'Health & Beauty' LIMIT 1),
   15.99, 7.00, 60, 12, '22222222-2222-2222-2222-222222222222', '1234567890006', true),
  ('FOOD-001', 'Organic Coffee Beans', '1kg premium organic coffee beans',
   (SELECT id FROM public.categories WHERE name = 'Food & Beverages' LIMIT 1),
   24.99, 12.00, 40, 10, '33333333-3333-3333-3333-333333333333', '1234567890007', true),
  ('HOME-001', 'Ceramic Plant Pot', 'Decorative ceramic plant pot with drainage',
   (SELECT id FROM public.categories WHERE name = 'Home & Garden' LIMIT 1),
   18.99, 8.00, 35, 8, '33333333-3333-3333-3333-333333333333', '1234567890008', true),
  ('TOY-001', 'Building Blocks Set', '200-piece colorful building blocks',
   (SELECT id FROM public.categories WHERE name = 'Toys & Games' LIMIT 1),
   29.99, 12.00, 20, 5, '33333333-3333-3333-3333-333333333333', '1234567890009', true);
