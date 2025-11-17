# Supabase Setup Guide for Next-Stock

Complete guide to setting up Supabase with Next.js 16 App Router using @supabase/ssr for the Next-Stock application.

## Table of Contents

1. [Supabase Project Setup](#supabase-project-setup)
2. [Local Environment Configuration](#local-environment-configuration)
3. [Database Schema Creation](#database-schema-creation)
4. [Row Level Security Setup](#row-level-security-setup)
5. [Type Generation](#type-generation)
6. [Next.js Integration](#nextjs-integration)
7. [Authentication Implementation](#authentication-implementation)
8. [Testing Setup](#testing-setup)

## 1. Supabase Project Setup

### Create New Project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign in or create account
3. Click "New Project"
4. Fill in project details:
   - **Name**: `next-stock-[environment]` (e.g., `next-stock-dev`)
   - **Database Password**: Generate strong password (save securely)
   - **Region**: Choose closest to your users
   - **Pricing Plan**: Start with Free tier

5. Wait for project initialization (2-3 minutes)

### Get Project Credentials

Once project is ready:

1. Go to **Project Settings** > **API**
2. Copy these values:
   - **Project URL**: `https://xxx.supabase.co`
   - **Project API keys**:
     - `anon` `public` key (safe for client-side)
     - `service_role` key (keep secret, server-only)
   - **Project Reference ID**: Found in URL or settings

## 2. Local Environment Configuration

### Install Dependencies

```bash
# Core Supabase packages
npm install @supabase/supabase-js @supabase/ssr

# Optional: Supabase CLI for type generation and local dev
npm install -g supabase
```

### Create Environment File

Create `.env.local` in project root:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Optional: Service role key (server-only, for admin operations)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Development
NODE_ENV=development
```

**Security Note**: Never commit `.env.local` to version control. Already included in `.gitignore`.

### Update .env.example

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## 3. Database Schema Creation

### Execute Schema via Supabase Dashboard

1. Open Supabase Dashboard
2. Go to **SQL Editor**
3. Create new query
4. Copy schema from `ARCHITECTURE_REVISED.md` section "Core Schema"
5. Execute query

### Schema Creation Steps

**Step 1: Create Core Tables**

```sql
-- Organizations (Multi-tenant root)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stores
CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profiles (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'cashier')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Categories
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Products
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  sku TEXT UNIQUE NOT NULL,
  barcode TEXT UNIQUE,
  description TEXT,
  unit_price DECIMAL(10, 2) NOT NULL,
  cost_price DECIMAL(10, 2),
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  min_stock_level INTEGER DEFAULT 10,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inventory (per-store stock)
CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0,
  last_counted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, product_id)
);

-- Stock Movements
CREATE TABLE stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('in', 'out', 'adjustment', 'transfer')),
  quantity INTEGER NOT NULL,
  reference_type TEXT,
  reference_id UUID,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customers
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  total_spent DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sales
CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  cashier_id UUID NOT NULL REFERENCES profiles(id),
  sale_number TEXT UNIQUE NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  tax DECIMAL(10, 2) NOT NULL DEFAULT 0,
  discount DECIMAL(10, 2) DEFAULT 0,
  total DECIMAL(10, 2) NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'mobile')),
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'refunded')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sale Items
CREATE TABLE sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Suppliers
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Purchase Orders
CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  order_number TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ordered', 'received', 'cancelled')),
  total DECIMAL(10, 2) NOT NULL,
  expected_date DATE,
  received_date DATE,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Purchase Order Items
CREATE TABLE purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL,
  unit_cost DECIMAL(10, 2) NOT NULL,
  total DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Step 2: Create Indexes**

```sql
-- Multi-tenant queries
CREATE INDEX idx_stores_org ON stores(organization_id);
CREATE INDEX idx_profiles_org ON profiles(organization_id);
CREATE INDEX idx_products_org ON products(organization_id);
CREATE INDEX idx_inventory_org_store ON inventory(organization_id, store_id);
CREATE INDEX idx_sales_org_store ON sales(organization_id, store_id);

-- RLS policy optimization
CREATE INDEX idx_profiles_user_id ON profiles(id);
CREATE INDEX idx_inventory_store_product ON inventory(store_id, product_id);
CREATE INDEX idx_stock_movements_store ON stock_movements(store_id);
CREATE INDEX idx_sales_cashier ON sales(cashier_id);

-- Common queries
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_barcode ON products(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX idx_sales_created_at ON sales(created_at DESC);
CREATE INDEX idx_stock_movements_created_at ON stock_movements(created_at DESC);
```

**Step 3: Create Helper Functions**

```sql
-- Helper function to get user's organization
CREATE OR REPLACE FUNCTION auth.user_organization_id()
RETURNS UUID AS $$
  SELECT organization_id
  FROM profiles
  WHERE id = auth.uid()
$$ LANGUAGE SQL STABLE;

-- Helper function to check role
CREATE OR REPLACE FUNCTION auth.user_has_role(required_role TEXT)
RETURNS BOOLEAN AS $$
  SELECT role = required_role
  FROM profiles
  WHERE id = auth.uid()
$$ LANGUAGE SQL STABLE;

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Step 4: Create Triggers**

```sql
-- Apply updated_at trigger to tables
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stores_updated_at
  BEFORE UPDATE ON stores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_updated_at
  BEFORE UPDATE ON inventory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sales_updated_at
  BEFORE UPDATE ON sales
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_suppliers_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_purchase_orders_updated_at
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Inventory management triggers
CREATE OR REPLACE FUNCTION create_inventory_for_new_product()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO inventory (organization_id, store_id, product_id, quantity)
  SELECT NEW.organization_id, s.id, NEW.id, 0
  FROM stores s
  WHERE s.organization_id = NEW.organization_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_inventory
  AFTER INSERT ON products
  FOR EACH ROW
  EXECUTE FUNCTION create_inventory_for_new_product();

CREATE OR REPLACE FUNCTION update_inventory_on_sale()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE inventory
  SET quantity = quantity - NEW.quantity
  WHERE product_id = NEW.product_id
    AND store_id = (SELECT store_id FROM sales WHERE id = NEW.sale_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_inventory_on_sale
  AFTER INSERT ON sale_items
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_on_sale();
```

## 4. Row Level Security Setup

### Enable RLS on All Tables

```sql
-- Enable RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
```

### Create RLS Policies

```sql
-- Organizations
CREATE POLICY "Users can view their organization"
  ON organizations FOR SELECT
  USING (id = auth.user_organization_id());

-- Stores
CREATE POLICY "Users can view org stores"
  ON stores FOR SELECT
  USING (organization_id = auth.user_organization_id());

CREATE POLICY "Admins can manage stores"
  ON stores FOR ALL
  USING (organization_id = auth.user_organization_id() AND auth.user_has_role('admin'))
  WITH CHECK (organization_id = auth.user_organization_id() AND auth.user_has_role('admin'));

-- Profiles
CREATE POLICY "Users can view org profiles"
  ON profiles FOR SELECT
  USING (organization_id = auth.user_organization_id());

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Admins can manage profiles"
  ON profiles FOR ALL
  USING (organization_id = auth.user_organization_id() AND auth.user_has_role('admin'))
  WITH CHECK (organization_id = auth.user_organization_id() AND auth.user_has_role('admin'));

-- Products
CREATE POLICY "Users can view products"
  ON products FOR SELECT
  USING (organization_id = auth.user_organization_id());

CREATE POLICY "Managers can manage products"
  ON products FOR ALL
  USING (
    organization_id = auth.user_organization_id()
    AND (auth.user_has_role('admin') OR auth.user_has_role('manager'))
  )
  WITH CHECK (
    organization_id = auth.user_organization_id()
    AND (auth.user_has_role('admin') OR auth.user_has_role('manager'))
  );

-- Inventory
CREATE POLICY "Users can view inventory"
  ON inventory FOR SELECT
  USING (organization_id = auth.user_organization_id());

CREATE POLICY "Managers can manage inventory"
  ON inventory FOR ALL
  USING (
    organization_id = auth.user_organization_id()
    AND (auth.user_has_role('admin') OR auth.user_has_role('manager'))
  )
  WITH CHECK (
    organization_id = auth.user_organization_id()
    AND (auth.user_has_role('admin') OR auth.user_has_role('manager'))
  );

-- Sales
CREATE POLICY "Users can view sales"
  ON sales FOR SELECT
  USING (organization_id = auth.user_organization_id());

CREATE POLICY "Cashiers can create sales"
  ON sales FOR INSERT
  WITH CHECK (
    organization_id = auth.user_organization_id()
    AND cashier_id = auth.uid()
  );

CREATE POLICY "Managers can manage sales"
  ON sales FOR UPDATE
  USING (
    organization_id = auth.user_organization_id()
    AND (auth.user_has_role('admin') OR auth.user_has_role('manager'))
  )
  WITH CHECK (
    organization_id = auth.user_organization_id()
    AND (auth.user_has_role('admin') OR auth.user_has_role('manager'))
  );

-- Sale Items (inherit from sales)
CREATE POLICY "Users can view sale items"
  ON sale_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sales
      WHERE sales.id = sale_items.sale_id
        AND sales.organization_id = auth.user_organization_id()
    )
  );

CREATE POLICY "Cashiers can create sale items"
  ON sale_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales
      WHERE sales.id = sale_items.sale_id
        AND sales.cashier_id = auth.uid()
    )
  );

-- Repeat similar patterns for other tables (customers, suppliers, purchase_orders, etc.)
-- All following the principle:
-- - SELECT: All users in organization
-- - INSERT/UPDATE/DELETE: Role-based (admin, manager, cashier)
```

### Test RLS Policies

```sql
-- Test as different users
-- 1. Create test organization and user
-- 2. Try queries with different auth.uid() values
-- 3. Verify isolation between organizations
```

## 5. Type Generation

### Setup Supabase CLI

```bash
# Install globally
npm install -g supabase

# Or use npx
npx supabase login

# Initialize in project (optional for local dev)
npx supabase init
```

### Generate TypeScript Types

```bash
# From production database
npx supabase gen types typescript \
  --project-id "your-project-ref" \
  --schema public \
  > types/database.types.ts

# Or from local Supabase (if using local dev)
npx supabase gen types typescript --local > types/database.types.ts
```

### Create Type Shortcuts

Create `types/index.ts`:

```typescript
import { Database } from './database.types'

// Table shortcuts
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']

export type Enums<T extends keyof Database['public']['Enums']> =
  Database['public']['Enums'][T]

// Convenient type aliases
export type Organization = Tables<'organizations'>
export type Store = Tables<'stores'>
export type Profile = Tables<'profiles'>
export type Category = Tables<'categories'>
export type Product = Tables<'products'>
export type Inventory = Tables<'inventory'>
export type StockMovement = Tables<'stock_movements'>
export type Customer = Tables<'customers'>
export type Sale = Tables<'sales'>
export type SaleItem = Tables<'sale_items'>
export type Supplier = Tables<'suppliers'>
export type PurchaseOrder = Tables<'purchase_orders'>
export type PurchaseOrderItem = Tables<'purchase_order_items'>

// Extended types with relations (app-specific)
export type ProductWithCategory = Product & {
  category: Category | null
}

export type SaleWithItems = Sale & {
  sale_items: (SaleItem & { product: Product })[]
  customer: Customer | null
  cashier: Profile
}

export type InventoryWithProduct = Inventory & {
  product: Product
  store: Store
}
```

### Update tsconfig.json

Ensure type paths are configured:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"],
      "@/types": ["./types"],
      "@/types/*": ["./types/*"]
    }
  }
}
```

## 6. Next.js Integration

### Create Supabase Client Utilities

**Browser Client** (`lib/supabase/client.ts`):

```typescript
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database.types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**Server Client** (`lib/supabase/server.ts`):

```typescript
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { Database } from '@/types/database.types'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component - cannot set cookies
          }
        },
      },
    }
  )
}
```

**Middleware** (`middleware.ts`):

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            supabaseResponse.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // Refresh session
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Protect dashboard routes
  if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from auth pages
  if (user && (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/signup')) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

## 7. Authentication Implementation

### Login Page (`app/(auth)/login/page.tsx`)

```typescript
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md space-y-8">
        <h1 className="text-3xl font-bold">Sign In</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full"
            />
          </div>
          <div>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full"
            />
          </div>
          {error && <div className="text-red-600">{error}</div>}
          <button type="submit" disabled={loading} className="w-full">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

### Server Action for Signup (`lib/actions/auth.ts`)

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function signUp(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = formData.get('full_name') as string

  // Create auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  })

  if (authError) {
    return { error: authError.message }
  }

  // Create profile (RLS will enforce organization_id)
  const { error: profileError } = await supabase.from('profiles').insert({
    id: authData.user!.id,
    email,
    full_name: fullName,
    role: 'cashier', // Default role
    // organization_id will be set by admin during onboarding
  })

  if (profileError) {
    return { error: profileError.message }
  }

  redirect('/dashboard')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
```

### Protected Layout (`app/(dashboard)/layout.tsx`)

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div>
      <nav>{/* Navigation with profile.role-based menus */}</nav>
      <main>{children}</main>
    </div>
  )
}
```

## 8. Testing Setup

### Test Database Access

Create `scripts/test-supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Use service role for testing
)

async function testConnection() {
  console.log('Testing Supabase connection...')

  // Test query
  const { data, error } = await supabase.from('organizations').select('*').limit(1)

  if (error) {
    console.error('Error:', error)
  } else {
    console.log('Success! Data:', data)
  }
}

testConnection()
```

Run:

```bash
npx tsx scripts/test-supabase.ts
```

### Seed Test Data

Create `scripts/seed.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function seed() {
  console.log('Seeding database...')

  // Create test organization
  const { data: org } = await supabase
    .from('organizations')
    .insert({ name: 'Test Organization' })
    .select()
    .single()

  console.log('Created organization:', org)

  // Create test store
  const { data: store } = await supabase
    .from('stores')
    .insert({
      organization_id: org.id,
      name: 'Main Store',
      address: '123 Test St',
      phone: '555-0100',
    })
    .select()
    .single()

  console.log('Created store:', store)

  // Add more seed data as needed

  console.log('Seeding complete!')
}

seed()
```

### Verify RLS

Create `scripts/test-rls.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'

// Test with anon key (RLS enforced)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function testRLS() {
  console.log('Testing RLS...')

  // Should fail without auth
  const { data, error } = await supabase.from('products').select('*')

  if (error) {
    console.log('✓ RLS working: Access denied without auth')
  } else {
    console.log('✗ RLS issue: Access granted without auth')
  }

  // Test with authentication
  // (Add test user login here)
}

testRLS()
```

## Common Issues & Troubleshooting

### Issue: "new row violates row-level security policy"

**Solution**: User is not authenticated or doesn't have proper role/organization.

```typescript
// Check authentication
const {
  data: { user },
} = await supabase.auth.getUser()
console.log('User:', user)

// Check profile
const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
console.log('Profile:', profile)
```

### Issue: Types not updating

**Solution**: Regenerate types after schema changes.

```bash
npx supabase gen types typescript --project-id "your-ref" > types/database.types.ts
```

### Issue: Middleware redirect loop

**Solution**: Ensure matcher excludes static files and images.

```typescript
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

### Issue: "Cannot set cookies" error

**Solution**: This is normal in Server Components. Use middleware or Server Actions to set cookies.

## Next Steps

1. Complete authentication implementation
2. Create first protected page
3. Implement product management
4. Add real-time subscriptions
5. Build POS interface

See **ARCHITECTURE_REVISED.md** for complete architecture details.

---

**Document Version**: 1.0
**Last Updated**: 2025-11-17
