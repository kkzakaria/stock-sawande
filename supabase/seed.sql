-- ============================================================================
-- SEED DATA FOR DEVELOPMENT AND TESTING
-- ============================================================================
-- This file contains test data for local development
-- Run with: supabase db reset (resets and applies migrations + seed)

-- ============================================================================
-- STORES
-- ============================================================================
DELETE FROM public.stores;

-- Let PostgreSQL generate valid UUIDs automatically
INSERT INTO public.stores (name, address, phone, email) VALUES
  ('Downtown Store', '123 Main Street, New York, NY 10001', '+1-555-0101', 'downtown@nextstock.com'),
  ('Uptown Store', '456 Park Avenue, New York, NY 10022', '+1-555-0102', 'uptown@nextstock.com'),
  ('Brooklyn Store', '789 Atlantic Avenue, Brooklyn, NY 11217', '+1-555-0103', 'brooklyn@nextstock.com');

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
-- Let PostgreSQL generate valid UUIDs automatically
INSERT INTO public.product_templates (sku, name, description, category_id, price, cost, min_stock_level, barcode, is_active) VALUES
  ('ELEC-001', 'Wireless Mouse', 'Ergonomic wireless mouse with USB receiver',
   (SELECT id FROM public.categories WHERE name = 'Electronics' LIMIT 1),
   29.99, 15.00, 10, '1234567890001', true),
  ('ELEC-002', 'USB-C Cable', '2m braided USB-C charging cable',
   (SELECT id FROM public.categories WHERE name = 'Electronics' LIMIT 1),
   12.99, 5.00, 20, '1234567890002', true),
  ('CLOTH-001', 'Cotton T-Shirt', 'Premium cotton t-shirt - Various colors',
   (SELECT id FROM public.categories WHERE name = 'Clothing' LIMIT 1),
   19.99, 8.00, 15, '1234567890003', true),
  ('BOOK-001', 'JavaScript Guide', 'Complete JavaScript programming guide',
   (SELECT id FROM public.categories WHERE name = 'Books & Media' LIMIT 1),
   39.99, 20.00, 5, '1234567890004', true),
  ('SPORT-001', 'Yoga Mat', 'Non-slip exercise yoga mat with carry strap',
   (SELECT id FROM public.categories WHERE name = 'Sports & Outdoors' LIMIT 1),
   34.99, 15.00, 8, '1234567890005', true),
  ('HEALTH-001', 'Vitamin C Supplement', 'Daily vitamin C 1000mg - 60 tablets',
   (SELECT id FROM public.categories WHERE name = 'Health & Beauty' LIMIT 1),
   15.99, 7.00, 12, '1234567890006', true),
  ('FOOD-001', 'Organic Coffee Beans', '1kg premium organic coffee beans',
   (SELECT id FROM public.categories WHERE name = 'Food & Beverages' LIMIT 1),
   24.99, 12.00, 10, '1234567890007', true),
  ('HOME-001', 'Ceramic Plant Pot', 'Decorative ceramic plant pot with drainage',
   (SELECT id FROM public.categories WHERE name = 'Home & Garden' LIMIT 1),
   18.99, 8.00, 8, '1234567890008', true),
  ('TOY-001', 'Building Blocks Set', '200-piece colorful building blocks',
   (SELECT id FROM public.categories WHERE name = 'Toys & Games' LIMIT 1),
   29.99, 12.00, 5, '1234567890009', true);

-- ============================================================================
-- SAMPLE INVENTORY (products available in stores)
-- ============================================================================
-- Use subqueries to reference stores and products by name/sku instead of hardcoded UUIDs
INSERT INTO public.product_inventory (product_id, store_id, quantity) VALUES
  -- Wireless Mouse available in all 3 stores
  ((SELECT id FROM public.product_templates WHERE sku = 'ELEC-001'), (SELECT id FROM public.stores WHERE name = 'Downtown Store'), 45),
  ((SELECT id FROM public.product_templates WHERE sku = 'ELEC-001'), (SELECT id FROM public.stores WHERE name = 'Uptown Store'), 30),
  ((SELECT id FROM public.product_templates WHERE sku = 'ELEC-001'), (SELECT id FROM public.stores WHERE name = 'Brooklyn Store'), 25),

  -- USB-C Cable available in Downtown and Uptown
  ((SELECT id FROM public.product_templates WHERE sku = 'ELEC-002'), (SELECT id FROM public.stores WHERE name = 'Downtown Store'), 120),
  ((SELECT id FROM public.product_templates WHERE sku = 'ELEC-002'), (SELECT id FROM public.stores WHERE name = 'Uptown Store'), 80),

  -- Cotton T-Shirt available in Downtown and Brooklyn
  ((SELECT id FROM public.product_templates WHERE sku = 'CLOTH-001'), (SELECT id FROM public.stores WHERE name = 'Downtown Store'), 75),
  ((SELECT id FROM public.product_templates WHERE sku = 'CLOTH-001'), (SELECT id FROM public.stores WHERE name = 'Brooklyn Store'), 50),

  -- JavaScript Guide only in Uptown
  ((SELECT id FROM public.product_templates WHERE sku = 'BOOK-001'), (SELECT id FROM public.stores WHERE name = 'Uptown Store'), 30),

  -- Yoga Mat available in Uptown and Brooklyn
  ((SELECT id FROM public.product_templates WHERE sku = 'SPORT-001'), (SELECT id FROM public.stores WHERE name = 'Uptown Store'), 25),
  ((SELECT id FROM public.product_templates WHERE sku = 'SPORT-001'), (SELECT id FROM public.stores WHERE name = 'Brooklyn Store'), 15),

  -- Vitamin C available in all stores
  ((SELECT id FROM public.product_templates WHERE sku = 'HEALTH-001'), (SELECT id FROM public.stores WHERE name = 'Downtown Store'), 60),
  ((SELECT id FROM public.product_templates WHERE sku = 'HEALTH-001'), (SELECT id FROM public.stores WHERE name = 'Uptown Store'), 45),
  ((SELECT id FROM public.product_templates WHERE sku = 'HEALTH-001'), (SELECT id FROM public.stores WHERE name = 'Brooklyn Store'), 40),

  -- Coffee Beans only in Brooklyn
  ((SELECT id FROM public.product_templates WHERE sku = 'FOOD-001'), (SELECT id FROM public.stores WHERE name = 'Brooklyn Store'), 40),

  -- Plant Pot available in Downtown and Brooklyn
  ((SELECT id FROM public.product_templates WHERE sku = 'HOME-001'), (SELECT id FROM public.stores WHERE name = 'Downtown Store'), 20),
  ((SELECT id FROM public.product_templates WHERE sku = 'HOME-001'), (SELECT id FROM public.stores WHERE name = 'Brooklyn Store'), 35),

  -- Building Blocks only in Brooklyn
  ((SELECT id FROM public.product_templates WHERE sku = 'TOY-001'), (SELECT id FROM public.stores WHERE name = 'Brooklyn Store'), 20);
