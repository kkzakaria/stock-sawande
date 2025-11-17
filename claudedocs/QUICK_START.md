# Quick Start Guide

Get Next-Stock running in 5 minutes with these copy-paste commands.

## Prerequisites

Verify you have these installed:

```bash
node --version  # v18.0.0 or higher
pnpm --version  # v8.0.0 or higher
```

Install missing tools:

```bash
# Install pnpm
npm install -g pnpm

# Install Supabase CLI
npm install -g supabase
```

**Supabase Account**: Sign up at [supabase.com](https://supabase.com) (free tier works)

---

## 1-Minute Setup

### Create Environment Variables

Create `.env.local` in project root:

```bash
cd /home/superz/next-stock
touch .env.local
```

Add these variables (replace with your Supabase project values):

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Optional: Local Development
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Get Your Keys:**
1. Go to [app.supabase.com](https://app.supabase.com)
2. Select your project
3. Go to Settings → API
4. Copy `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
5. Copy `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## Install Dependencies

```bash
pnpm install
```

**Expected output:** `✓ Lockfile is up to date` (completes in 30-60 seconds)

---

## Database Setup

### Create Database Tables

Run this SQL in Supabase SQL Editor:

```sql
-- Create stores table
CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create categories table
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create products table
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  sku TEXT NOT NULL,
  barcode TEXT,
  price DECIMAL(10,2) NOT NULL,
  cost DECIMAL(10,2),
  stock_quantity INTEGER DEFAULT 0,
  min_stock_level INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, sku)
);

-- Create stock_movements table
CREATE TABLE stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('entry', 'exit', 'adjustment')),
  quantity INTEGER NOT NULL,
  reason TEXT,
  reference TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create sales table
CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  total_amount DECIMAL(10,2) NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'mobile')),
  payment_status TEXT DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create sale_items table
CREATE TABLE sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create profiles table (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  full_name TEXT,
  role TEXT DEFAULT 'cashier' CHECK (role IN ('owner', 'manager', 'cashier')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_products_store_id ON products(store_id);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX idx_sales_store_id ON sales(store_id);
CREATE INDEX idx_sales_created_at ON sales(created_at);
CREATE INDEX idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX idx_sale_items_product_id ON sale_items(product_id);

-- Enable Row Level Security
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies (allow authenticated users to read/write their store data)
-- Stores: users can only access stores they belong to
CREATE POLICY "Users can view their stores"
  ON stores FOR SELECT
  USING (id IN (
    SELECT store_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can update their stores"
  ON stores FOR UPDATE
  USING (id IN (
    SELECT store_id FROM profiles WHERE id = auth.uid()
  ));

-- Categories: users can access categories in their stores
CREATE POLICY "Users can view store categories"
  ON categories FOR SELECT
  USING (store_id IN (
    SELECT store_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can manage store categories"
  ON categories FOR ALL
  USING (store_id IN (
    SELECT store_id FROM profiles WHERE id = auth.uid()
  ));

-- Products: users can access products in their stores
CREATE POLICY "Users can view store products"
  ON products FOR SELECT
  USING (store_id IN (
    SELECT store_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can manage store products"
  ON products FOR ALL
  USING (store_id IN (
    SELECT store_id FROM profiles WHERE id = auth.uid()
  ));

-- Stock movements: users can access movements for their store products
CREATE POLICY "Users can view store stock movements"
  ON stock_movements FOR SELECT
  USING (product_id IN (
    SELECT id FROM products WHERE store_id IN (
      SELECT store_id FROM profiles WHERE id = auth.uid()
    )
  ));

CREATE POLICY "Users can create store stock movements"
  ON stock_movements FOR INSERT
  WITH CHECK (product_id IN (
    SELECT id FROM products WHERE store_id IN (
      SELECT store_id FROM profiles WHERE id = auth.uid()
    )
  ));

-- Sales: users can access sales from their stores
CREATE POLICY "Users can view store sales"
  ON sales FOR SELECT
  USING (store_id IN (
    SELECT store_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can create store sales"
  ON sales FOR INSERT
  WITH CHECK (store_id IN (
    SELECT store_id FROM profiles WHERE id = auth.uid()
  ));

-- Sale items: users can access sale items from their store sales
CREATE POLICY "Users can view store sale items"
  ON sale_items FOR SELECT
  USING (sale_id IN (
    SELECT id FROM sales WHERE store_id IN (
      SELECT store_id FROM profiles WHERE id = auth.uid()
    )
  ));

CREATE POLICY "Users can create store sale items"
  ON sale_items FOR INSERT
  WITH CHECK (sale_id IN (
    SELECT id FROM sales WHERE store_id IN (
      SELECT store_id FROM profiles WHERE id = auth.uid()
    )
  ));

-- Profiles: users can only view/update their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_stores_updated_at
  BEFORE UPDATE ON stores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

**Steps:**
1. Go to Supabase Dashboard → SQL Editor
2. Click "New Query"
3. Paste entire SQL above
4. Click "Run" or press Ctrl+Enter

✅ **Success:** You should see "Success. No rows returned"

### Insert Sample Data (Optional)

```sql
-- Insert a sample store
INSERT INTO stores (id, name, address, phone)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Main Store',
  '123 Main Street',
  '+1-555-0100'
);

-- Insert sample categories
INSERT INTO categories (store_id, name, description) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Electronics', 'Electronic devices and accessories'),
  ('00000000-0000-0000-0000-000000000001', 'Clothing', 'Apparel and fashion items'),
  ('00000000-0000-0000-0000-000000000001', 'Food', 'Food and beverages');

-- Insert sample products
INSERT INTO products (store_id, category_id, name, sku, price, cost, stock_quantity, min_stock_level)
SELECT
  '00000000-0000-0000-0000-000000000001',
  c.id,
  'Sample Product ' || c.name,
  'SKU-' || SUBSTRING(c.id::text, 1, 8),
  19.99,
  10.00,
  100,
  10
FROM categories c
WHERE c.store_id = '00000000-0000-0000-0000-000000000001';
```

---

## Generate Types

Generate TypeScript types from your database schema:

```bash
# Login to Supabase CLI (first time only)
supabase login

# Link to your project (replace with your project ref)
supabase link --project-ref your-project-ref

# Generate types
supabase gen types typescript --linked > types/supabase.ts
```

**Alternative: Manual Type Generation**

If CLI fails, use the Supabase Dashboard:
1. Go to Settings → API Docs → TypeScript
2. Copy the generated types
3. Create `/home/superz/next-stock/types/supabase.ts`
4. Paste the types

✅ **Success:** File `types/supabase.ts` created with database types

---

## Start Dev Server

```bash
pnpm dev
```

**Expected output:**
```
▲ Next.js 16.0.0
- Local:        http://localhost:3000
- Network:      http://192.168.1.x:3000

✓ Ready in 2.5s
```

✅ **Success:** Browser opens at `http://localhost:3000`

---

## Verification Checklist

Test your setup by completing these steps:

### 1. Environment Variables

```bash
# Check if .env.local exists
cat .env.local | grep SUPABASE_URL
```

✅ **Expected:** Shows your Supabase URL

### 2. Database Connection

```bash
# Test database connection
curl "https://your-project.supabase.co/rest/v1/stores?select=*" \
  -H "apikey: your-anon-key" \
  -H "Authorization: Bearer your-anon-key"
```

✅ **Expected:** JSON response with stores data

### 3. Application Pages

Visit these URLs in your browser:

- ✅ `http://localhost:3000` - Homepage loads
- ✅ `http://localhost:3000/auth/login` - Login page displays
- ✅ `http://localhost:3000/dashboard` - Redirects to login (not authenticated)

### 4. TypeScript Compilation

```bash
pnpm run build
```

✅ **Expected:** Build completes without type errors

### 5. Create Test User

1. Go to `http://localhost:3000/auth/signup`
2. Create account with email + password
3. Check Supabase Dashboard → Authentication → Users
4. Verify new user appears

✅ **Success:** You can log in and access dashboard

---

## Common Issues

### Issue 1: "Error: Invalid Supabase URL"

**Symptom:** Application crashes on startup

**Fix:**
```bash
# Verify .env.local exists and has correct format
cat .env.local

# URL should start with https:// and end with .supabase.co
# Correct: NEXT_PUBLIC_SUPABASE_URL=https://abc123.supabase.co
# Wrong: NEXT_PUBLIC_SUPABASE_URL=abc123.supabase.co
```

**Restart dev server after fixing:**
```bash
pnpm dev
```

### Issue 2: "Failed to fetch" / Network Errors

**Symptom:** Database queries fail with network errors

**Fix:**
```bash
# 1. Check Supabase project is active
# Go to app.supabase.com → Your Project → Check status

# 2. Verify anon key is correct
# Go to Settings → API → Copy anon key again

# 3. Test direct connection
curl "https://your-project.supabase.co/rest/v1/" \
  -H "apikey: your-anon-key"
```

✅ **Expected:** Returns project metadata JSON

### Issue 3: "RLS Policy Error" / "Row Level Security"

**Symptom:** Queries return empty results or "new row violates row-level security policy"

**Fix:**
```sql
-- Check if RLS policies exist
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE schemaname = 'public';

-- Temporarily disable RLS for testing (NOT for production)
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE categories DISABLE ROW LEVEL SECURITY;

-- Re-enable after testing
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
```

**Proper Fix:** Ensure user is authenticated and has `profile` record with `store_id`

---

## Next Steps

Your development environment is ready! Continue with:

1. **[IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md)** - Build features phase-by-phase
2. **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Understand system design
3. **[SETUP_GUIDE.md](./SETUP_GUIDE.md)** - Detailed configuration explanations

**Recommended First Task:** Implement authentication pages (Phase 1, Task 2 in IMPLEMENTATION_GUIDE.md)

---

## Quick Commands Reference

```bash
# Development
pnpm dev                    # Start dev server
pnpm build                  # Production build
pnpm start                  # Start production server
pnpm lint                   # Run ESLint

# Database
supabase db reset           # Reset local database
supabase gen types          # Regenerate TypeScript types
supabase db push            # Push migrations to remote

# Testing
pnpm test                   # Run tests (when added)
pnpm test:e2e               # Run E2E tests (when added)

# Cleanup
rm -rf .next                # Clear Next.js cache
rm -rf node_modules         # Remove dependencies
pnpm install                # Reinstall dependencies
```

---

**Support:** If issues persist, check [SETUP_GUIDE.md](./SETUP_GUIDE.md) for detailed troubleshooting or open an issue on GitHub.
