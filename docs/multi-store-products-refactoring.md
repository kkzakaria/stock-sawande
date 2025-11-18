# Multi-Store Products Refactoring

**Date**: 2025-11-18
**Status**: ✅ Completed
**Impact**: Major database schema change

## 📋 Table of Contents

- [Overview](#overview)
- [Problem Statement](#problem-statement)
- [Solution](#solution)
- [Database Schema Changes](#database-schema-changes)
- [Migration Details](#migration-details)
- [Helper Functions & Views](#helper-functions--views)
- [TypeScript Integration](#typescript-integration)
- [Security (RLS Policies)](#security-rls-policies)
- [Testing & Validation](#testing--validation)
- [Migration Guide](#migration-guide)
- [Breaking Changes](#breaking-changes)
- [Rollback Strategy](#rollback-strategy)

---

## Overview

This refactoring transforms the database schema to support products being available in multiple stores simultaneously with independent inventory levels. Previously, each product could only exist in one store at a time.

**Key Achievement**: A single product (identified by SKU) can now have different quantities across multiple stores.

---

## Problem Statement

### Before Refactoring

```
┌─────────────┐
│  products   │
├─────────────┤
│ id          │
│ sku         │
│ name        │
│ price       │
│ quantity    │◄─── Single quantity for ONE store
│ store_id    │◄─── Product tied to ONE store
└─────────────┘
```

**Limitations**:
- ❌ Product can only exist in one store
- ❌ Same product in different stores requires different SKUs
- ❌ No centralized product information
- ❌ Difficult to track product availability across stores

### After Refactoring

```
┌──────────────────────┐
│ product_templates    │
├──────────────────────┤
│ id                   │
│ sku (unique)         │◄─── Shared across all stores
│ name                 │
│ price                │
│ cost                 │
│ category_id          │
└──────────────────────┘
           │
           │ 1:N relationship
           ▼
┌──────────────────────┐
│ product_inventory    │
├──────────────────────┤
│ id                   │
│ product_id           │◄─── References template
│ store_id             │◄─── Store location
│ quantity             │◄─── Store-specific quantity
│ UNIQUE(product_id,   │
│        store_id)     │
└──────────────────────┘
```

**Benefits**:
- ✅ Product available in multiple stores
- ✅ Independent stock levels per store
- ✅ Single SKU for same product across stores
- ✅ Centralized product information
- ✅ Easy product transfer tracking

---

## Solution

### Architecture Design

The solution separates **product information** from **inventory management**:

1. **`product_templates`**: Stores common product attributes (SKU, name, price, description)
2. **`product_inventory`**: Stores store-specific inventory (quantity per store)

This follows the **separation of concerns** principle and enables:
- Centralized product catalog management
- Distributed inventory tracking
- Flexible product-store relationships

---

## Database Schema Changes

### New Tables

#### 1. `product_templates`

Stores common product information shared across all stores.

```sql
CREATE TABLE public.product_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES categories(id),
  price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
  cost DECIMAL(10, 2) CHECK (cost >= 0),
  min_stock_level INTEGER DEFAULT 10,
  image_url TEXT,
  barcode TEXT UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
```

**Key Points**:
- `sku` is globally unique across all stores
- `barcode` is globally unique
- Price and cost are centralized
- `min_stock_level` serves as default threshold

#### 2. `product_inventory`

Stores store-specific inventory levels.

```sql
CREATE TABLE public.product_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES product_templates(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE(product_id, store_id)
);
```

**Key Points**:
- Composite unique constraint: `(product_id, store_id)`
- One inventory record per product-store combination
- Cascade delete when product or store is removed

### Modified Tables

#### `stock_movements`

Added new column to reference inventory records:

```sql
ALTER TABLE stock_movements
  ADD COLUMN inventory_id UUID REFERENCES product_inventory(id) ON DELETE CASCADE;
```

This allows tracking movements for specific product-store combinations.

### Deprecated Tables

- `products` → Renamed to `products_backup_old` (preserved for safety)

---

## Migration Details

### Migration Files

1. **`20251118170840_refactor_multi_store_products.sql`**
   - Creates new tables
   - Migrates existing data
   - Updates RLS policies
   - Creates triggers and functions

2. **`20251118171104_add_products_view_helper.sql`**
   - Creates helper view
   - Creates utility functions

### Data Migration Process

```sql
-- Step 1: Migrate product info to templates
INSERT INTO product_templates (id, sku, name, ...)
SELECT id, sku, name, ... FROM products;

-- Step 2: Migrate inventory to product_inventory
INSERT INTO product_inventory (product_id, store_id, quantity, ...)
SELECT id, store_id, quantity, ... FROM products
WHERE store_id IS NOT NULL;

-- Step 3: Update stock_movements references
UPDATE stock_movements sm
SET inventory_id = pi.id
FROM product_inventory pi
WHERE sm.product_id = pi.product_id
  AND sm.store_id = pi.store_id;

-- Step 4: Preserve old table as backup
ALTER TABLE products RENAME TO products_backup_old;
```

---

## Helper Functions & Views

### View: `products_with_inventory`

Combines product templates with their inventory across all stores.

```sql
CREATE VIEW products_with_inventory AS
SELECT
  pt.*,
  pi.id as inventory_id,
  pi.store_id,
  pi.quantity,
  s.name as store_name,
  c.name as category_name
FROM product_templates pt
LEFT JOIN product_inventory pi ON pt.id = pi.product_id
LEFT JOIN stores s ON pi.store_id = s.id
LEFT JOIN categories c ON pt.category_id = c.id;
```

**Usage**:
```sql
-- Get all products with their availability
SELECT * FROM products_with_inventory;

-- Products available in specific store
SELECT * FROM products_with_inventory
WHERE store_id = '11111111-1111-1111-1111-111111111111';
```

### Function: `get_products_by_store(store_id)`

Returns all active products available in a specific store.

```sql
SELECT * FROM get_products_by_store('11111111-1111-1111-1111-111111111111');
```

**Returns**:
- template_id
- sku
- name
- description
- category information
- price, cost
- quantity (store-specific)
- inventory_id

### Function: `get_stores_by_product(product_id)`

Lists all stores where a specific product is available.

```sql
SELECT * FROM get_stores_by_product('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
```

**Returns**:
- store_id
- store_name
- store_address
- quantity (at that store)
- inventory_id

### Function: `get_low_stock_products()`

Identifies products below minimum stock level across all stores.

```sql
SELECT * FROM get_low_stock_products();
```

**Returns**:
- Product details
- Store information
- Current quantity
- Minimum stock level
- Stock deficit

---

## TypeScript Integration

### Type Updates

Types are automatically generated from the database schema:

```bash
supabase gen types typescript --local > types/supabase.ts
```

### Usage Examples

#### Get Products by Store

```typescript
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

// Using RPC function
const { data: products, error } = await supabase
  .rpc('get_products_by_store', {
    p_store_id: storeId
  })

// Type-safe result
// products: Array<{
//   template_id: string
//   sku: string
//   name: string
//   quantity: number
//   ...
// }>
```

#### Get Stores by Product

```typescript
const { data: stores, error } = await supabase
  .rpc('get_stores_by_product', {
    p_product_id: productId
  })

// stores: Array<{
//   store_id: string
//   store_name: string
//   quantity: number
//   ...
// }>
```

#### Query Using View

```typescript
const { data, error } = await supabase
  .from('products_with_inventory')
  .select('*')
  .eq('store_id', storeId)
  .eq('is_active', true)
```

#### Create Product Template

```typescript
const { data: template, error } = await supabase
  .from('product_templates')
  .insert({
    sku: 'ELEC-003',
    name: 'Bluetooth Headphones',
    price: 79.99,
    cost: 40.00,
    category_id: electronicsId,
    is_active: true
  })
  .select()
  .single()
```

#### Add Inventory to Store

```typescript
const { data: inventory, error } = await supabase
  .from('product_inventory')
  .insert({
    product_id: templateId,
    store_id: storeId,
    quantity: 50
  })
  .select()
  .single()
```

---

## Security (RLS Policies)

### `product_templates` Policies

```sql
-- SELECT: All authenticated users can view templates
CREATE POLICY "Anyone can view product templates"
  ON product_templates FOR SELECT
  TO authenticated
  USING (true);

-- INSERT/UPDATE/DELETE: Only admin and managers
CREATE POLICY "Admin and managers can insert product templates"
  ON product_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT get_current_user_role()) = ANY(ARRAY['admin', 'manager'])
  );
```

### `product_inventory` Policies

```sql
-- SELECT: Users see their store inventory, admins see all
CREATE POLICY "Users can view inventory from their store"
  ON product_inventory FOR SELECT
  TO authenticated
  USING (
    (SELECT get_current_user_role()) = 'admin'
    OR store_id = (SELECT get_current_user_store_id())
  );

-- INSERT/UPDATE/DELETE: Managers for their store, admins for all
CREATE POLICY "Admin and managers can insert inventory"
  ON product_inventory FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT get_current_user_role()) = ANY(ARRAY['admin', 'manager'])
    AND (
      (SELECT get_current_user_role()) = 'admin'
      OR store_id = (SELECT get_current_user_store_id())
    )
  );
```

### Security Benefits

- ✅ Store managers can only manage their store's inventory
- ✅ Admins have full visibility and control
- ✅ Cashiers can view products but not modify them
- ✅ All policies use helper functions for performance

---

## Testing & Validation

### Validation Results

#### Test 1: Multi-Store Availability

```sql
SELECT pt.name, s.name as store_name, pi.quantity
FROM product_templates pt
INNER JOIN product_inventory pi ON pt.id = pi.product_id
INNER JOIN stores s ON pi.store_id = s.id
WHERE pt.sku = 'ELEC-001';
```

**Result**:
```
name            | store_name      | quantity
----------------|-----------------|----------
Wireless Mouse  | Brooklyn Store  | 25
Wireless Mouse  | Downtown Store  | 45
Wireless Mouse  | Uptown Store    | 30
```

✅ **Pass**: Same product available in 3 stores with different quantities

#### Test 2: View Functionality

```sql
SELECT * FROM products_with_inventory
WHERE sku = 'HEALTH-001';
```

✅ **Pass**: View correctly joins templates, inventory, and stores

#### Test 3: Helper Functions

```sql
SELECT * FROM get_stores_by_product('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
```

✅ **Pass**: Returns 3 stores (Brooklyn, Downtown, Uptown) with correct quantities

### Test Data

Seed data includes examples of:
- Products in all 3 stores (Wireless Mouse, Vitamin C)
- Products in 2 stores (USB-C Cable, Cotton T-Shirt)
- Products in 1 store (JavaScript Guide, Coffee Beans)

---

## Migration Guide

### For Developers

#### 1. Update Queries

**Before**:
```typescript
// Old: Query products table directly
const { data } = await supabase
  .from('products')
  .select('*')
  .eq('store_id', storeId)
```

**After**:
```typescript
// New: Use helper function or view
const { data } = await supabase
  .rpc('get_products_by_store', { p_store_id: storeId })

// Or use the view
const { data } = await supabase
  .from('products_with_inventory')
  .select('*')
  .eq('store_id', storeId)
```

#### 2. Update Inserts

**Before**:
```typescript
// Old: Insert with quantity and store_id
await supabase.from('products').insert({
  sku: 'ELEC-001',
  name: 'Product',
  price: 29.99,
  quantity: 50,
  store_id: storeId
})
```

**After**:
```typescript
// New: Insert template first
const { data: template } = await supabase
  .from('product_templates')
  .insert({
    sku: 'ELEC-001',
    name: 'Product',
    price: 29.99
  })
  .select()
  .single()

// Then add inventory for store(s)
await supabase.from('product_inventory').insert({
  product_id: template.id,
  store_id: storeId,
  quantity: 50
})
```

#### 3. Update Stock Movements

Stock movements now reference `inventory_id` instead of just `product_id` + `store_id`:

```typescript
await supabase.from('stock_movements').insert({
  product_id: productId,
  store_id: storeId,
  inventory_id: inventoryId, // NEW FIELD
  user_id: userId,
  type: 'sale',
  quantity: -1,
  previous_quantity: 50,
  new_quantity: 49
})
```

---

## Breaking Changes

### 🚨 Application Code Updates Required

1. **All `products` table references** must be updated to use:
   - `product_templates` for product information
   - `product_inventory` for quantities
   - Helper functions for common queries

2. **Stock movement creation** must include `inventory_id`

3. **Product creation flows** must be split into:
   - Create template (once)
   - Create inventory (per store)

### Database Changes

- ❌ `products` table no longer exists (renamed to `products_backup_old`)
- ✅ New tables: `product_templates`, `product_inventory`
- ✅ New column: `stock_movements.inventory_id`

---

## Rollback Strategy

### If Issues Occur

1. **Immediate Rollback** (if discovered during testing):
   ```sql
   -- Restore old products table
   ALTER TABLE products_backup_old RENAME TO products;

   -- Drop new tables
   DROP TABLE IF EXISTS product_inventory CASCADE;
   DROP TABLE IF EXISTS product_templates CASCADE;
   ```

2. **Data Recovery**:
   - All original data preserved in `products_backup_old`
   - Can regenerate inventory from backup if needed

3. **Migration Reversion**:
   ```bash
   # Restore to previous migration
   supabase db reset
   # Remove problematic migration files
   rm supabase/migrations/20251118170840_refactor_multi_store_products.sql
   rm supabase/migrations/20251118171104_add_products_view_helper.sql
   # Re-run reset
   supabase db reset
   ```

### Safety Measures

- ✅ Original `products` table preserved as `products_backup_old`
- ✅ All migrations tested on local instance first
- ✅ Data validation performed after migration
- ✅ Types regenerated to ensure consistency

---

## Future Enhancements

### Potential Improvements

1. **Product Variants**:
   - Add `product_variants` table for size/color options
   - Link variants to same template

2. **Inventory Transfers**:
   - Create dedicated transfer tracking
   - Automatic stock movement creation for transfers

3. **Reorder Points**:
   - Store-specific minimum stock levels
   - Automated reorder suggestions

4. **Inventory History**:
   - Audit trail for all inventory changes
   - Historical quantity tracking

5. **Multi-Currency Support**:
   - Store-specific pricing
   - Currency conversion tracking

---

## References

- Migration file: `supabase/migrations/20251118170840_refactor_multi_store_products.sql`
- Helper views: `supabase/migrations/20251118171104_add_products_view_helper.sql`
- Seed data: `supabase/seed.sql`
- Type definitions: `types/supabase.ts`

---

## Changelog

### 2025-11-18

- ✅ Created `product_templates` table
- ✅ Created `product_inventory` table
- ✅ Migrated all existing data
- ✅ Updated RLS policies
- ✅ Created helper view `products_with_inventory`
- ✅ Created utility functions (3)
- ✅ Updated seed data with multi-store examples
- ✅ Regenerated TypeScript types
- ✅ Validated migration with test queries
- ✅ Preserved backup table `products_backup_old`

---

**Status**: ✅ Production Ready
**Next Steps**: Update application code to use new schema
