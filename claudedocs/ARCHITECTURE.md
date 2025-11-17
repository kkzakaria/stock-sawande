# Next-Stock: Revised Architecture (Supabase-First)

## Executive Summary

This document presents the revised architecture for Next-Stock, optimized for Supabase's auto-generated APIs and Next.js 16 App Router patterns. The architecture removes Prisma ORM in favor of Supabase's native type-safe client with generated TypeScript types.

**Key Changes from Original Plan:**
- Replace Prisma with Supabase auto-generated APIs + TypeScript types
- Use @supabase/ssr for Next.js 16 SSR authentication (auth helpers deprecated)
- Leverage Supabase PostgREST for automatic REST API generation
- Implement Row Level Security (RLS) for multi-tenant data isolation
- Simplified codebase with fewer abstractions and dependencies

## Technology Stack (Revised)

### Frontend Layer
- **Next.js 16.0.3**: App Router with React Server Components
- **React 19**: Server Components by default, Client Components as needed
- **TypeScript 5**: Type safety with Supabase-generated database types
- **Tailwind CSS v4**: Utility-first styling
- **shadcn/ui**: Component library (New York style)

### Backend & Database
- **Supabase**: Complete backend platform
  - PostgreSQL 15+: Primary database
  - PostgREST: Auto-generated REST APIs
  - Realtime: WebSocket subscriptions
  - Auth: JWT-based authentication with @supabase/ssr
  - Storage: File uploads (receipts, images)
  - Edge Functions: Optional serverless functions

### Authentication & Session Management
- **@supabase/ssr**: Official SSR package for Next.js App Router
  - `createBrowserClient()`: Client Components
  - `createServerClient()`: Server Components & API routes
  - Middleware `updateSession()`: Token refresh
- **Cookie-based sessions**: No auth helpers (deprecated)
- **JWT tokens**: Secure, stateless authentication

### Type Safety
- **Supabase CLI**: Generate TypeScript types from PostgreSQL schema
- **Type shorthands**: `Tables<'products'>`, `Enums`, etc.
- **Generated interfaces**: `Row`, `Insert`, `Update` for each table

### State Management
- **Zustand**: Local state (cart, UI)
- **Supabase Realtime**: Server state synchronization
- **React Server Components**: Eliminate much client state

### Key Libraries
- **React Hook Form + Zod**: Form validation
- **TanStack Table**: Data tables
- **Recharts**: Charts and analytics
- **react-to-print**: Receipt printing
- **date-fns**: Date manipulation

## Database Architecture

### Core Schema (PostgreSQL)

Same tables as original plan, optimized for Supabase RLS:

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

-- Users (extends Supabase auth.users)
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

-- Inventory (per-store stock levels)
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

-- Sales (Transactions)
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

### Indexes for Performance

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

### Row Level Security (RLS) Policies

Supabase RLS provides database-level security, ensuring users only access their organization's data:

```sql
-- Enable RLS on all tables
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

-- Helper function to get user's organization
CREATE OR REPLACE FUNCTION auth.user_organization_id()
RETURNS UUID AS $$
  SELECT organization_id
  FROM profiles
  WHERE id = auth.uid()
$$ LANGUAGE SQL STABLE;

-- Helper function to check if user has role
CREATE OR REPLACE FUNCTION auth.user_has_role(required_role TEXT)
RETURNS BOOLEAN AS $$
  SELECT role = required_role
  FROM profiles
  WHERE id = auth.uid()
$$ LANGUAGE SQL STABLE;

-- Organizations: Users can only see their own org
CREATE POLICY "Users can view their organization"
  ON organizations FOR SELECT
  USING (id = auth.user_organization_id());

-- Stores: Organization-level access
CREATE POLICY "Users can view org stores"
  ON stores FOR SELECT
  USING (organization_id = auth.user_organization_id());

CREATE POLICY "Admins can manage stores"
  ON stores FOR ALL
  USING (organization_id = auth.user_organization_id() AND auth.user_has_role('admin'))
  WITH CHECK (organization_id = auth.user_organization_id() AND auth.user_has_role('admin'));

-- Profiles: Users can view org profiles
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

-- Products: Full access for admins/managers
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

-- Inventory: Read all, modify with permissions
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

-- Sales: All users can view, cashiers+ can create
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

-- Similar policies for other tables following the pattern:
-- - SELECT: All authenticated users in organization
-- - INSERT/UPDATE/DELETE: Role-based (admin, manager, cashier)
```

### Database Functions & Triggers

```sql
-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to all relevant tables
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stores_updated_at
  BEFORE UPDATE ON stores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- (Apply to other tables with updated_at column)

-- Function to create inventory record when product is created
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

-- Function to update inventory on sale
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

## Application Architecture

### Project Structure (Revised)

```
next-stock/
├── app/                           # Next.js App Router
│   ├── (auth)/                   # Auth pages (public)
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── signup/
│   │       └── page.tsx
│   ├── (dashboard)/              # Protected dashboard (Server Components)
│   │   ├── layout.tsx           # Dashboard layout with nav
│   │   ├── page.tsx             # Dashboard home
│   │   ├── products/
│   │   │   ├── page.tsx         # Product list
│   │   │   ├── [id]/
│   │   │   │   └── page.tsx     # Product detail
│   │   │   └── new/
│   │   │       └── page.tsx     # New product
│   │   ├── inventory/
│   │   ├── sales/
│   │   ├── customers/
│   │   ├── suppliers/
│   │   ├── reports/
│   │   └── settings/
│   ├── (pos)/                    # POS interface (Client Components)
│   │   ├── layout.tsx           # POS layout (minimal)
│   │   └── page.tsx             # POS main screen
│   └── api/                      # API routes (minimal with Supabase)
│       └── webhooks/
│           └── route.ts
├── components/                    # React components
│   ├── ui/                       # shadcn/ui primitives
│   ├── layout/
│   │   ├── header.tsx
│   │   ├── sidebar.tsx
│   │   └── breadcrumb.tsx
│   ├── products/
│   │   ├── product-form.tsx
│   │   ├── product-list.tsx
│   │   └── product-card.tsx
│   ├── pos/
│   │   ├── pos-cart.tsx
│   │   ├── product-search.tsx
│   │   └── receipt-print.tsx
│   └── shared/
│       ├── data-table.tsx
│       └── filter-bar.tsx
├── lib/                           # Core utilities
│   ├── supabase/                 # Supabase clients
│   │   ├── client.ts             # Browser client
│   │   ├── server.ts             # Server client
│   │   └── middleware.ts         # Middleware utilities
│   ├── actions/                  # Server Actions
│   │   ├── products.ts
│   │   ├── sales.ts
│   │   └── auth.ts
│   ├── validations/              # Zod schemas
│   │   ├── product.schema.ts
│   │   ├── sale.schema.ts
│   │   └── auth.schema.ts
│   ├── store/                    # Zustand stores
│   │   └── cart.store.ts
│   ├── hooks/                    # Custom hooks
│   │   ├── use-realtime.ts
│   │   └── use-offline.ts
│   └── utils.ts                  # Shared utilities
├── types/                         # TypeScript types
│   ├── database.types.ts         # Supabase generated types
│   └── index.ts                  # App-specific types
├── middleware.ts                  # Next.js middleware (auth refresh)
├── .env.example
└── package.json
```

### Authentication Flow with @supabase/ssr

#### 1. Client Setup (`lib/supabase/client.ts`)

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

#### 2. Server Setup (`lib/supabase/server.ts`)

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
            // Called from Server Component - ignore
          }
        },
      },
    }
  )
}
```

#### 3. Middleware Setup (`middleware.ts`)

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

  // Refresh session if needed
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

### Type Generation Workflow

#### 1. Generate Types from Database

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
npx supabase login

# Generate types (production)
npx supabase gen types typescript \
  --project-id "your-project-ref" \
  --schema public \
  > types/database.types.ts

# Or for local development with local Supabase
npx supabase gen types typescript --local > types/database.types.ts
```

#### 2. Use Generated Types

```typescript
// types/database.types.ts (auto-generated)
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      products: {
        Row: {
          id: string
          organization_id: string
          category_id: string | null
          name: string
          sku: string
          barcode: string | null
          description: string | null
          unit_price: number
          cost_price: number | null
          stock_quantity: number
          min_stock_level: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          category_id?: string | null
          name: string
          sku: string
          barcode?: string | null
          description?: string | null
          unit_price: number
          cost_price?: number | null
          stock_quantity?: number
          min_stock_level?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          category_id?: string | null
          name?: string
          sku?: string
          barcode?: string | null
          description?: string | null
          unit_price?: number
          cost_price?: number | null
          stock_quantity?: number
          min_stock_level?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      // ... other tables
    }
    Views: {
      // ... views
    }
    Functions: {
      // ... functions
    }
    Enums: {
      // ... enums
    }
  }
}

// Type shortcuts (add to types/index.ts)
import { Database } from './database.types'

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type Enums<T extends keyof Database['public']['Enums']> =
  Database['public']['Enums'][T]

// Usage examples:
export type Product = Tables<'products'>
export type Sale = Tables<'sales'>
export type SaleItem = Tables<'sale_items'>
```

### Data Access Patterns

#### Server Components (Recommended)

```typescript
// app/(dashboard)/products/page.tsx
import { createClient } from '@/lib/supabase/server'
import type { Product } from '@/types'

export default async function ProductsPage() {
  const supabase = await createClient()

  // Type-safe query with RLS applied automatically
  const { data: products, error } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .order('name')

  if (error) {
    throw error
  }

  return (
    <div>
      <h1>Products</h1>
      {products.map((product: Product) => (
        <div key={product.id}>{product.name}</div>
      ))}
    </div>
  )
}
```

#### Server Actions

```typescript
// lib/actions/products.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { productSchema } from '@/lib/validations/product.schema'

export async function createProduct(formData: FormData) {
  const supabase = await createClient()

  // Get user's organization
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!profile) throw new Error('Profile not found')

  // Validate input
  const validatedData = productSchema.parse({
    name: formData.get('name'),
    sku: formData.get('sku'),
    unit_price: parseFloat(formData.get('unit_price') as string),
    // ... other fields
  })

  // Insert with automatic RLS
  const { data, error } = await supabase
    .from('products')
    .insert({
      ...validatedData,
      organization_id: profile.organization_id,
    })
    .select()
    .single()

  if (error) throw error

  revalidatePath('/dashboard/products')
  return { success: true, data }
}
```

#### Client Components with Realtime

```typescript
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Product } from '@/types'

export function ProductList({ initialProducts }: { initialProducts: Product[] }) {
  const [products, setProducts] = useState(initialProducts)
  const supabase = createClient()

  useEffect(() => {
    // Subscribe to product changes
    const channel = supabase
      .channel('products-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setProducts((prev) => [...prev, payload.new as Product])
          } else if (payload.eventType === 'UPDATE') {
            setProducts((prev) =>
              prev.map((p) => (p.id === payload.new.id ? (payload.new as Product) : p))
            )
          } else if (payload.eventType === 'DELETE') {
            setProducts((prev) => prev.filter((p) => p.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  return (
    <div>
      {products.map((product) => (
        <div key={product.id}>{product.name}</div>
      ))}
    </div>
  )
}
```

## Key Benefits of Supabase-First Architecture

### 1. Simplified Codebase
- **No ORM layer**: Direct PostgreSQL access with type safety
- **Fewer abstractions**: Less code to maintain
- **Built-in features**: Auth, realtime, storage without additional libraries

### 2. Type Safety
- **Generated types**: Always in sync with database schema
- **End-to-end types**: From database to UI components
- **Compile-time errors**: Catch issues before runtime

### 3. Security
- **Database-level RLS**: Cannot be bypassed by client code
- **JWT-based auth**: Stateless, scalable authentication
- **Organization isolation**: Multi-tenancy enforced at database level

### 4. Real-time Capabilities
- **Built-in subscriptions**: No additional infrastructure
- **Instant updates**: Inventory changes reflect immediately
- **Presence**: Track online users and active sessions

### 5. Developer Experience
- **Auto-generated APIs**: PostgREST creates REST endpoints automatically
- **Dashboard UI**: Supabase Studio for database management
- **CLI tools**: Type generation, migrations, local development

### 6. Performance
- **Connection pooling**: Supabase handles database connections
- **Edge deployment**: Deploy close to users with Edge Functions
- **Caching**: Built-in caching strategies

## Trade-offs: Supabase vs Prisma

### When Supabase is Better (This Project)

**Advantages:**
- Simpler setup with fewer dependencies
- Built-in auth, realtime, and storage
- Auto-generated REST APIs via PostgREST
- Native PostgreSQL features (RLS, triggers, functions)
- Real-time subscriptions out of the box
- Free tier includes auth and database
- Less code to maintain (no ORM layer)

**Best for:**
- Greenfield projects
- PostgreSQL-only applications
- Need built-in auth and realtime
- Want minimal backend code
- Rapid prototyping and MVPs

### When Prisma Might Be Better

**Advantages:**
- Database-agnostic (supports MySQL, PostgreSQL, SQLite, etc.)
- Rich migration system with schema history
- More complex query patterns and aggregations
- Better TypeScript inference in some cases
- Established ORM patterns familiar to many developers

**Best for:**
- Multi-database support needed
- Complex data models with many relations
- Existing Prisma expertise in team
- Need database-agnostic code

### For Next-Stock: Supabase Wins

Given our requirements:
- PostgreSQL-only
- Need auth + realtime + storage
- Multi-tenant with RLS
- Rapid development timeline
- Modern Next.js 16 patterns

**Result**: Supabase provides 80% of what we need out of the box, with less code and better integration.

## Performance Targets

All targets remain the same as original architecture:

- **POS operations**: < 100ms response time
- **Page load (dashboard)**: < 1s initial load
- **Report generation**: < 2s for standard reports
- **Concurrent users**: 50+ simultaneous users
- **Data volume**: 10,000+ products, 1,000+ transactions/day
- **Real-time updates**: < 500ms latency

## Security Checklist

- [ ] RLS enabled on all tables
- [ ] JWT tokens with short expiration (1 hour)
- [ ] Refresh tokens with rotation
- [ ] HTTPS only in production
- [ ] Environment variables secured
- [ ] Input validation with Zod
- [ ] Rate limiting on API routes
- [ ] SQL injection prevented (parameterized queries)
- [ ] XSS protection (React escaping)
- [ ] CSRF protection (middleware)

## Deployment Strategy

### Recommended: Vercel + Supabase

**Vercel:**
- Automatic deployments from Git
- Edge network for global performance
- Automatic HTTPS
- Environment variable management
- Preview deployments for PRs

**Supabase:**
- Managed PostgreSQL database
- Automatic backups
- Point-in-time recovery
- Connection pooling
- Edge Functions (optional)

### Environment Setup

```env
# .env.local (development)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# .env.production (Vercel)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Monitoring & Observability

**Supabase Dashboard:**
- Database performance metrics
- Query logs and slow queries
- Auth statistics
- API usage and rate limits

**Vercel Analytics:**
- Web Vitals (LCP, FID, CLS)
- Page load times
- Error tracking
- User sessions

**Optional Enhancements:**
- Sentry for error tracking
- LogRocket for session replay
- Posthog for product analytics

## Development Workflow

### Local Development

```bash
# 1. Install Supabase CLI
npm install -g supabase

# 2. Start local Supabase (optional)
npx supabase start

# 3. Generate types
npx supabase gen types typescript --project-id "your-ref" > types/database.types.ts

# 4. Run Next.js dev server
npm run dev
```

### Database Changes

```bash
# 1. Create migration
npx supabase migration new add_new_feature

# 2. Edit migration file in supabase/migrations/

# 3. Apply locally
npx supabase db reset

# 4. Push to production (via Supabase Dashboard or CLI)
npx supabase db push
```

### Type Updates

```bash
# After schema changes, regenerate types
npx supabase gen types typescript --project-id "your-ref" > types/database.types.ts

# Commit to version control
git add types/database.types.ts
git commit -m "Update database types"
```

## Next Steps

See **SUPABASE_SETUP.md** for complete setup instructions and **MIGRATION_NOTES.md** for detailed changes from the original Prisma-based architecture.

---

**Document Version**: 1.0
**Last Updated**: 2025-11-17
**Architecture Status**: Approved for Implementation
