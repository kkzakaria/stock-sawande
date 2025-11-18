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
-- SAMPLE PRODUCT TEMPLATES
-- ============================================================================
INSERT INTO public.product_templates (id, sku, name, description, category_id, price, cost, min_stock_level, barcode, is_active) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'ELEC-001', 'Wireless Mouse', 'Ergonomic wireless mouse with USB receiver',
   (SELECT id FROM public.categories WHERE name = 'Electronics' LIMIT 1),
   29.99, 15.00, 10, '1234567890001', true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'ELEC-002', 'USB-C Cable', '2m braided USB-C charging cable',
   (SELECT id FROM public.categories WHERE name = 'Electronics' LIMIT 1),
   12.99, 5.00, 20, '1234567890002', true),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'CLOTH-001', 'Cotton T-Shirt', 'Premium cotton t-shirt - Various colors',
   (SELECT id FROM public.categories WHERE name = 'Clothing' LIMIT 1),
   19.99, 8.00, 15, '1234567890003', true),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'BOOK-001', 'JavaScript Guide', 'Complete JavaScript programming guide',
   (SELECT id FROM public.categories WHERE name = 'Books & Media' LIMIT 1),
   39.99, 20.00, 5, '1234567890004', true),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'SPORT-001', 'Yoga Mat', 'Non-slip exercise yoga mat with carry strap',
   (SELECT id FROM public.categories WHERE name = 'Sports & Outdoors' LIMIT 1),
   34.99, 15.00, 8, '1234567890005', true),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'HEALTH-001', 'Vitamin C Supplement', 'Daily vitamin C 1000mg - 60 tablets',
   (SELECT id FROM public.categories WHERE name = 'Health & Beauty' LIMIT 1),
   15.99, 7.00, 12, '1234567890006', true),
  ('11111111-2222-3333-4444-555555555555', 'FOOD-001', 'Organic Coffee Beans', '1kg premium organic coffee beans',
   (SELECT id FROM public.categories WHERE name = 'Food & Beverages' LIMIT 1),
   24.99, 12.00, 10, '1234567890007', true),
  ('22222222-3333-4444-5555-666666666666', 'HOME-001', 'Ceramic Plant Pot', 'Decorative ceramic plant pot with drainage',
   (SELECT id FROM public.categories WHERE name = 'Home & Garden' LIMIT 1),
   18.99, 8.00, 8, '1234567890008', true),
  ('33333333-4444-5555-6666-777777777777', 'TOY-001', 'Building Blocks Set', '200-piece colorful building blocks',
   (SELECT id FROM public.categories WHERE name = 'Toys & Games' LIMIT 1),
   29.99, 12.00, 5, '1234567890009', true);

-- ============================================================================
-- SAMPLE INVENTORY (products available in stores)
-- ============================================================================
-- Electronics products available in Downtown and Uptown stores
INSERT INTO public.product_inventory (product_id, store_id, quantity) VALUES
  -- Wireless Mouse available in all 3 stores
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 45),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 30),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 25),

  -- USB-C Cable available in Downtown and Uptown
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 120),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 80),

  -- Cotton T-Shirt available in Downtown and Brooklyn
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 75),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '33333333-3333-3333-3333-333333333333', 50),

  -- JavaScript Guide only in Uptown
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222', 30),

  -- Yoga Mat available in Uptown and Brooklyn
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '22222222-2222-2222-2222-222222222222', 25),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '33333333-3333-3333-3333-333333333333', 15),

  -- Vitamin C available in all stores
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', '11111111-1111-1111-1111-111111111111', 60),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', '22222222-2222-2222-2222-222222222222', 45),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', '33333333-3333-3333-3333-333333333333', 40),

  -- Coffee Beans only in Brooklyn
  ('11111111-2222-3333-4444-555555555555', '33333333-3333-3333-3333-333333333333', 40),

  -- Plant Pot available in Downtown and Brooklyn
  ('22222222-3333-4444-5555-666666666666', '11111111-1111-1111-1111-111111111111', 20),
  ('22222222-3333-4444-5555-666666666666', '33333333-3333-3333-3333-333333333333', 35),

  -- Building Blocks only in Brooklyn
  ('33333333-4444-5555-6666-777777777777', '33333333-3333-3333-3333-333333333333', 20);
