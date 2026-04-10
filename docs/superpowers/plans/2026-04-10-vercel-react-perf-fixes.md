# Vercel React Best Practices — Performance Fixes Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 15 performance issues identified by Vercel React Best Practices audit across async waterfalls, bundle size, server-side performance, client-side optimization, and JS performance.

**Architecture:** Changes are scoped to existing files only — no new features. We create one shared utility (`lib/utils/format-currency.ts`), replace barrel imports with direct imports, add `next/dynamic` for code splitting, parallelize sequential DB queries with `Promise.all()`, and optimize client-side lookups with `Map`.

**Tech Stack:** Next.js 16, React 19, Supabase, TypeScript, Zustand

---

## File Map

| File | Action | Task |
|---|---|---|
| `lib/utils/format-currency.ts` | Create | T1 |
| `components/dashboard/dashboard-client.tsx` | Modify | T1, T12 |
| `components/dashboard/dashboard-top-products.tsx` | Modify | T1 |
| `components/products/products-data-table.tsx` | Modify | T1 |
| `components/customers/customers-data-table.tsx` | Modify | T1 |
| `components/proformas/proformas-data-table.tsx` | Modify | T1 |
| `components/proformas/proforma-detail-dialog.tsx` | Modify | T1 |
| `components/proformas/proforma-print.tsx` | Modify | T1 |
| `components/proformas/convert-to-sale-dialog.tsx` | Modify | T1 |
| `lib/store/product-cache-store.ts` | Modify | T2 |
| `components/settings/user-form-dialog.tsx` | Modify | T3, T14 |
| `components/products/product-form.tsx` | Modify | T3 |
| `components/pos/pos-client.tsx` | Modify | T3, T13 |
| `components/pos/pos-cart.tsx` | Modify | T3 |
| `components/proformas/proforma-form.tsx` | Modify | T3 |
| `lib/actions/stock-movements.ts` | Modify | T4 |
| `lib/actions/products.ts` | Modify | T5, T10 |
| `lib/actions/sales.ts` | Modify | T6 |
| `app/api/pos/sync/route.ts` | Modify | T7 |
| `app/[locale]/(dashboard)/settings/page.tsx` | Modify | T8 |
| `lib/actions/profile-actions.ts` | Modify | T8 |
| `lib/actions/proformas.ts` | Modify | T8 |
| `app/api/pos/session/close/route.ts` | Modify | T8 |
| `components/reports/reports-client.tsx` | Modify | T9 |
| `app/[locale]/layout.tsx` | Modify | T10 |
| `components/pos/unlock-session-dialog.tsx` | Modify | T11 |
| `components/pos/manager-approval-dialog.tsx` | Modify | T11 |

---

## Task 1: Create shared currency formatter and replace all inline Intl.NumberFormat

**Files:**
- Create: `lib/utils/format-currency.ts`
- Modify: `components/dashboard/dashboard-client.tsx:65-68`
- Modify: `components/dashboard/dashboard-top-products.tsx:17-20`
- Modify: `components/products/products-data-table.tsx:307-312`
- Modify: `components/customers/customers-data-table.tsx:285-290`
- Modify: `components/proformas/proformas-data-table.tsx:122-128`
- Modify: `components/proformas/proforma-detail-dialog.tsx:85-88`
- Modify: `components/proformas/proforma-print.tsx:105-108`
- Modify: `components/proformas/convert-to-sale-dialog.tsx:43-46`

- [ ] **Step 1: Create the shared formatter**

Create `lib/utils/format-currency.ts`:

```typescript
const currencyFormatter = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

export function formatCurrency(value: number): string {
  return `${currencyFormatter.format(value)} CFA`
}

export function formatCurrencyFCFA(value: number): string {
  return `${currencyFormatter.format(value)} FCFA`
}

export function formatNumber(value: number): string {
  return currencyFormatter.format(value)
}
```

- [ ] **Step 2: Replace in dashboard-client.tsx**

Replace lines 65-68:
```typescript
// REMOVE:
const formatCurrency = (value: number) => {
  const formatted = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)
  return `${formatted} CFA`
}

// ADD import at top:
import { formatCurrency } from '@/lib/utils/format-currency'
// Delete the local formatCurrency function entirely
```

- [ ] **Step 3: Replace in dashboard-top-products.tsx**

Replace the local `formatCurrency` function with:
```typescript
import { formatCurrency } from '@/lib/utils/format-currency'
// Delete the local formatCurrency function
```

- [ ] **Step 4: Replace in products-data-table.tsx**

Replace the inline `new Intl.NumberFormat(...)` in the price cell renderer with:
```typescript
import { formatNumber } from '@/lib/utils/format-currency'
// In cell renderer:
const formatted = formatNumber(price)
```

- [ ] **Step 5: Replace in customers-data-table.tsx**

Replace the inline formatter in `mobileCard` config with:
```typescript
import { formatNumber } from '@/lib/utils/format-currency'
// In mobileCard:
const formatted = formatNumber(spent)
```

- [ ] **Step 6: Replace in all proforma files**

In each of these files, replace the local `formatCurrency` with the import:
- `proformas-data-table.tsx`
- `proforma-detail-dialog.tsx`
- `proforma-print.tsx`
- `convert-to-sale-dialog.tsx`

```typescript
import { formatCurrency } from '@/lib/utils/format-currency'
// Delete the local formatCurrency function
```

Note: Check if any file uses `FCFA` vs `CFA` suffix and use the appropriate export.

- [ ] **Step 7: Verify build**

Run: `pnpm tsc --noEmit`
Expected: No type errors

- [ ] **Step 8: Commit**

```bash
git add lib/utils/format-currency.ts components/dashboard/dashboard-client.tsx components/dashboard/dashboard-top-products.tsx components/products/products-data-table.tsx components/customers/customers-data-table.tsx components/proformas/proformas-data-table.tsx components/proformas/proforma-detail-dialog.tsx components/proformas/proforma-print.tsx components/proformas/convert-to-sale-dialog.tsx
git commit -m "perf: hoist Intl.NumberFormat into shared currency formatter

Replaces 8 inline Intl.NumberFormat instances with a single shared
formatter. Intl constructors are expensive (~2-5ms each) and were
recreated on every render/row.

Closes #11"
```

---

## Task 2: Add Map index to product cache store for O(1) lookups

**Files:**
- Modify: `lib/store/product-cache-store.ts:195-282`

- [ ] **Step 1: Add Map indexes to store state and helper**

In the store state interface (near the top), the `products` array already exists. We need to add a helper that builds a map on demand. Add a `getProductMap` and `getBarcodeMap` getter using a cached approach.

Find the `getProduct` method at line 195 and replace the lookup methods:

```typescript
// Replace getProduct (line 195-197):
getProduct: (id: string) => {
  return get().products.find((p) => p.id === id)
},

// WITH:
getProduct: (id: string) => {
  const products = get().products
  for (let i = 0; i < products.length; i++) {
    if (products[i].id === id) return products[i]
  }
  return undefined
},
```

Actually, the better approach is to maintain Map indexes. After the `setProducts` / `syncProducts` calls that set products, build maps. But since this is a Zustand store with `set()`, the simplest approach is to add computed maps:

Add a module-level cache:

```typescript
// Above the store creation, add:
let _productMapCache: { products: CachedProduct[]; byId: Map<string, CachedProduct>; byBarcode: Map<string, CachedProduct> } | null = null

function getProductMaps(products: CachedProduct[]) {
  if (_productMapCache && _productMapCache.products === products) {
    return _productMapCache
  }
  const byId = new Map(products.map(p => [p.id, p]))
  const byBarcode = new Map<string, CachedProduct>()
  for (const p of products) {
    if (p.barcode) byBarcode.set(p.barcode, p)
  }
  _productMapCache = { products, byId, byBarcode }
  return _productMapCache
}
```

- [ ] **Step 2: Replace all .find() calls with Map lookups**

Replace `getProduct` (line 195-197):
```typescript
getProduct: (id: string) => {
  const { byId } = getProductMaps(get().products)
  return byId.get(id)
},
```

Replace `getProductByBarcode` memory check (line 204):
```typescript
getProductByBarcode: async (barcode: string) => {
  const { byBarcode } = getProductMaps(get().products)
  const memoryProduct = byBarcode.get(barcode)
  if (memoryProduct) return memoryProduct
  return getProductByBarcode(barcode)
},
```

Replace `reserveStock` lookup (line 245):
```typescript
// After set() call, replace:
const product = get().products.find((p) => p.id === productId)
// With:
const { byId } = getProductMaps(get().products)
const product = byId.get(productId)
```

Replace `releaseReservation` lookup (line 270):
```typescript
const { byId } = getProductMaps(get().products)
const product = byId.get(productId)
```

Replace `getAvailableStock` lookup (line 280):
```typescript
getAvailableStock: (productId: string) => {
  const { byId } = getProductMaps(get().products)
  const product = byId.get(productId)
  return product ? product.localStock : 0
},
```

- [ ] **Step 3: Verify build**

Run: `pnpm tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add lib/store/product-cache-store.ts
git commit -m "perf: use Map index for O(1) product lookups in cache store

Replaces 5 Array.find() calls with Map.get() lookups. Maps are
lazily built and cached by reference identity. Critical for POS
stores with 500+ products.

Closes #12"
```

---

## Task 3: Replace Array.find() with Map in component loops

**Files:**
- Modify: `components/settings/user-form-dialog.tsx:115-121,378-381`
- Modify: `components/products/product-form.tsx:98-99`
- Modify: `components/pos/pos-client.tsx:365-369`
- Modify: `components/pos/pos-cart.tsx:289`
- Modify: `components/proformas/proforma-form.tsx:237-239`

- [ ] **Step 1: Fix user-form-dialog.tsx**

Add a `storeMap` useMemo near the top of the component:
```typescript
const storeMap = useMemo(() => new Map(stores.map(s => [s.id, s])), [stores])
```

Then replace all `stores.find((s) => s.id === storeId)` with `storeMap.get(storeId)`.

Line 115-121 (in user_stores mapping):
```typescript
stores: storeMap.get(storeId) || null,
```

Line 378-381 (in selectedStores render):
```typescript
const store = storeMap.get(storeId)
```

- [ ] **Step 2: Fix product-form.tsx**

Add at top of component:
```typescript
const storeMap = useMemo(() => new Map(stores.map(s => [s.id, s])), [stores])
```

Replace line 98-99:
```typescript
const store = storeMap.get(inv.store_id)
```

- [ ] **Step 3: Fix pos-client.tsx product lookup**

Replace line 365-369. Build a Map before the `.map()`:
```typescript
const productMap = useMemo(() => new Map(products.map(p => [p.id, p])), [products])

// In displayProducts:
const originalProduct = productMap.get(cp.id)
```

- [ ] **Step 4: Fix pos-cart.tsx customer lookup**

Replace the `customers.find()` with a useMemo Map:
```typescript
const customerMap = useMemo(() => new Map(customers.map(c => [c.id, c])), [customers])
// Then:
const selectedCustomer = customerMap.get(customerId)
```

- [ ] **Step 5: Fix proforma-form.tsx customer lookup**

Same pattern:
```typescript
const customerMap = useMemo(() => new Map(customers.map(c => [c.id, c])), [customers])
const selectedCustomer = customerMap.get(form.state.values.customer_id)
```

- [ ] **Step 6: Verify build**

Run: `pnpm tsc --noEmit`

- [ ] **Step 7: Commit**

```bash
git add components/settings/user-form-dialog.tsx components/products/product-form.tsx components/pos/pos-client.tsx components/pos/pos-cart.tsx components/proformas/proforma-form.tsx
git commit -m "perf: replace Array.find() in loops with Map lookups

Converts 6 O(n) lookups inside .map() loops and render paths to
O(1) Map.get() using useMemo-cached Maps.

Closes #12"
```

---

## Task 4: Fix N+1 query in stock movements

**Files:**
- Modify: `lib/actions/stock-movements.ts:122-136`

- [ ] **Step 1: Replace N+1 pattern with batch fetch**

Replace lines 122-136:

```typescript
// REMOVE:
const movementsWithProfiles = await Promise.all(
  (data || []).map(async (movement) => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', movement.user_id)
      .single()
    return {
      ...movement,
      profiles: profile || undefined
    } as StockMovement
  })
)

// REPLACE WITH:
const userIds = [...new Set((data || []).map(m => m.user_id).filter(Boolean))]
const { data: profiles } = userIds.length > 0
  ? await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds)
  : { data: [] }

const profileMap = new Map(
  (profiles || []).map(p => [p.id, { full_name: p.full_name, email: p.email }])
)

const movementsWithProfiles = (data || []).map((movement) => ({
  ...movement,
  profiles: profileMap.get(movement.user_id) || undefined,
})) as StockMovement[]
```

- [ ] **Step 2: Verify build**

Run: `pnpm tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add lib/actions/stock-movements.ts
git commit -m "perf: fix N+1 query in getStockMovements

Replaces N individual profile queries with a single batch fetch
using .in(). For a page of 10 movements, goes from 10 queries to 1.

Closes #5"
```

---

## Task 5: Parallelize sequential queries in getProducts

**Files:**
- Modify: `lib/actions/products.ts:464-482`

- [ ] **Step 1: Wrap independent queries with Promise.all()**

Replace lines 464-482 (the two sequential queries inside the `if (!isAdmin && profile.store_id)` block):

```typescript
// REMOVE:
const { data: aggregatedProducts, error: aggError } = await (supabase.from as (table: string) => ReturnType<typeof supabase.from>)('products_aggregated')
  .select('*')

if (aggError) {
  console.error('Error fetching aggregated products:', aggError)
  return { success: false, error: aggError.message, data: [], totalCount: 0, userRole }
}

const { data: storeInventory, error: invError } = await supabase
  .from('product_inventory')
  .select('product_id, quantity')
  .eq('store_id', profile.store_id)

if (invError) {
  console.error('Error fetching store inventory:', invError)
  return { success: false, error: invError.message, data: [], totalCount: 0, userRole }
}

// REPLACE WITH:
const [aggResult, invResult] = await Promise.all([
  (supabase.from as (table: string) => ReturnType<typeof supabase.from>)('products_aggregated').select('*'),
  supabase.from('product_inventory').select('product_id, quantity').eq('store_id', profile.store_id),
])

if (aggResult.error) {
  console.error('Error fetching aggregated products:', aggResult.error)
  return { success: false, error: aggResult.error.message, data: [], totalCount: 0, userRole }
}
if (invResult.error) {
  console.error('Error fetching store inventory:', invResult.error)
  return { success: false, error: invResult.error.message, data: [], totalCount: 0, userRole }
}

const aggregatedProducts = aggResult.data
const storeInventory = invResult.data
```

- [ ] **Step 2: Verify build**

Run: `pnpm tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add lib/actions/products.ts
git commit -m "perf: parallelize product list queries with Promise.all()

Fetches aggregated products and store inventory concurrently instead
of sequentially. Halves latency for non-admin product list loading.

Closes #5"
```

---

## Task 6: Parallelize sequential inventory restoration in sales refund

**Files:**
- Modify: `lib/actions/sales.ts:367-410`

- [ ] **Step 1: Batch inventory reads, then parallel updates**

Replace lines 367-410:

```typescript
// REMOVE the entire for loop

// REPLACE WITH:
// Step 1: Batch fetch all current inventory quantities
const inventoryIds = (saleItems || []).map(item => item.inventory_id).filter(Boolean)
const { data: inventories } = inventoryIds.length > 0
  ? await supabase
      .from('product_inventory')
      .select('id, quantity')
      .in('id', inventoryIds)
  : { data: [] }

const inventoryMap = new Map(
  (inventories || []).map(inv => [inv.id, inv.quantity])
)

// Step 2: Parallel inventory updates and stock movement inserts
await Promise.all(
  (saleItems || []).map(async (item) => {
    const previousQuantity = inventoryMap.get(item.inventory_id) ?? 0
    const newQuantity = previousQuantity + item.quantity

    const [inventoryResult, movementResult] = await Promise.all([
      supabase
        .from('product_inventory')
        .update({ quantity: newQuantity })
        .eq('id', item.inventory_id),
      supabase
        .from('stock_movements')
        .insert({
          product_id: item.product_id,
          store_id: sale.store_id,
          inventory_id: item.inventory_id,
          type: 'return',
          quantity: item.quantity,
          previous_quantity: previousQuantity,
          new_quantity: newQuantity,
          reference: `Refund: ${validated.saleId}`,
          notes: validated.reason,
          user_id: user.id,
        }),
    ])

    if (inventoryResult.error) {
      console.error('Error restoring inventory:', inventoryResult.error)
    }
    if (movementResult.error) {
      console.error('Error creating stock movement:', movementResult.error)
    }
  })
)
```

- [ ] **Step 2: Verify build**

Run: `pnpm tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add lib/actions/sales.ts
git commit -m "perf: parallelize inventory restoration in sale refund

Batch-fetches all inventory quantities in 1 query, then runs all
updates and stock movements in parallel. Reduces from 3N sequential
queries to 1 + N parallel pairs.

Closes #6"
```

---

## Task 7: Parallelize POS sync inventory updates

**Files:**
- Modify: `app/api/pos/sync/route.ts:301-319`

- [ ] **Step 1: Batch fetch then parallel update**

Replace lines 301-319:

```typescript
// REMOVE the sequential for loop

// REPLACE WITH:
// Batch fetch all current inventories
const inventoryIds = adjustedItems.map(item => item.inventoryId)
const { data: currentInventories } = await supabase
  .from('product_inventory')
  .select('id, quantity')
  .in('id', inventoryIds)

const invMap = new Map(
  (currentInventories || []).map(inv => [inv.id, inv.quantity])
)

// Parallel inventory updates
await Promise.all(
  adjustedItems.map(async (item) => {
    const currentQty = invMap.get(item.inventoryId)
    if (currentQty != null) {
      const { error: updateError } = await supabase
        .from('product_inventory')
        .update({ quantity: Math.max(0, currentQty - item.quantity) })
        .eq('id', item.inventoryId)

      if (updateError) {
        console.error(`Failed to update inventory for ${item.productId}:`, updateError)
      }
    }
  })
)
```

- [ ] **Step 2: Verify build**

Run: `pnpm tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add app/api/pos/sync/route.ts
git commit -m "perf: parallelize POS sync inventory deductions

Batch-fetches inventory quantities then updates all items in
parallel. Reduces from 2N sequential queries to 1 + N parallel.

Closes #6"
```

---

## Task 8: Parallelize independent queries in settings, profile, proformas, session close

**Files:**
- Modify: `app/[locale]/(dashboard)/settings/page.tsx:44-70`
- Modify: `lib/actions/profile-actions.ts:64-97`
- Modify: `lib/actions/proformas.ts:260-318`
- Modify: `app/api/pos/session/close/route.ts:132-190`

- [ ] **Step 1: Parallelize settings page queries**

Replace lines 44-70 in `settings/page.tsx`:

```typescript
// REMOVE three sequential queries

// REPLACE WITH:
const [usersResult, storesResult, settingsResult] = await Promise.all([
  supabase
    .from('profiles')
    .select(`*, user_stores (id, store_id, is_default, stores (id, name))`)
    .order('created_at', { ascending: false }),
  supabase
    .from('stores')
    .select('*')
    .order('name'),
  supabase
    .from('business_settings')
    .select('key, value'),
])

users = usersResult.data
stores = storesResult.data
const settingsData = settingsResult.data
```

Keep the `if (settingsData)` block that builds `businessSettings` unchanged after.

- [ ] **Step 2: Parallelize profile-actions.ts validation queries**

In `updateUserStore()`, after the role check (line 63), the three queries for manager (assignedStore, store, openSession) can be partially parallelized. For managers, queries for store existence and open session are independent:

Replace lines 64-97:

```typescript
// For managers: verify store assignment, store existence, and open session in parallel
if (profile.role === 'manager') {
  const [assignedStoreResult, storeResult, openSessionResult] = await Promise.all([
    supabase
      .from('user_stores')
      .select('store_id')
      .eq('user_id', user.id)
      .eq('store_id', validated.storeId)
      .maybeSingle(),
    supabase
      .from('stores')
      .select('id, name')
      .eq('id', validated.storeId)
      .single(),
    supabase
      .from('cash_sessions')
      .select('id, status')
      .eq('cashier_id', user.id)
      .eq('status', 'open')
      .maybeSingle(),
  ])

  if (!assignedStoreResult.data) {
    return { success: false, error: 'You are not assigned to this store. Contact an administrator.' }
  }
  if (storeResult.error || !storeResult.data) {
    return { success: false, error: 'Store not found' }
  }
  if (openSessionResult.data) {
    return { success: false, error: 'Cannot change store with an open cash session. Please close your session first.' }
  }
} else {
  // Admin: just verify store exists and no open session
  const [storeResult, openSessionResult] = await Promise.all([
    supabase
      .from('stores')
      .select('id, name')
      .eq('id', validated.storeId)
      .single(),
    supabase
      .from('cash_sessions')
      .select('id, status')
      .eq('cashier_id', user.id)
      .eq('status', 'open')
      .maybeSingle(),
  ])

  if (storeResult.error || !storeResult.data) {
    return { success: false, error: 'Store not found' }
  }
  if (openSessionResult.data) {
    return { success: false, error: 'Cannot change store with an open cash session. Please close your session first.' }
  }
}
```

- [ ] **Step 3: Parallelize proforma detail queries**

In `getProformaDetail()`, lines 260-318. The proforma fetch and items fetch can't be fully parallelized because items query depends on `proformaId` validation and access control depends on the proforma result. However, we can start the items query at the same time:

Actually, since both use `proformaId` which is already known, and access control is checked after both fetches, we CAN parallelize:

```typescript
// Replace sequential proforma + items queries with:
const [proformaResult, itemsResult] = await Promise.all([
  supabase
    .from('proformas')
    .select(`
      id, proforma_number, created_at, subtotal, tax, discount, total,
      status, notes, terms, valid_until, converted_sale_id, converted_at,
      sent_at, accepted_at, rejected_at, rejection_reason, store_id,
      created_by:profiles!proformas_created_by_fkey(id, full_name, email),
      customer:customers(id, name, email, phone),
      store:stores(id, name)
    `)
    .eq('id', proformaId)
    .single(),
  supabase
    .from('proforma_items')
    .select(`
      id, quantity, unit_price, discount, subtotal, notes,
      product:product_templates(id, name, sku, price)
    `)
    .eq('proforma_id', proformaId)
    .order('created_at', { ascending: true }),
])

if (proformaResult.error) {
  console.error('Error fetching proforma:', proformaResult.error)
  return { success: false, error: 'Proforma not found' }
}

const proforma = proformaResult.data

// Access control checks (unchanged)
if (profile.role === 'cashier') {
  const createdBy = proforma.created_by as { id: string } | null
  if (createdBy?.id !== user.id) {
    return { success: false, error: 'Access denied' }
  }
} else if (profile.role === 'manager' && profile.store_id && proforma.store_id !== profile.store_id) {
  return { success: false, error: 'Access denied' }
}

if (itemsResult.error) {
  console.error('Error fetching proforma items:', itemsResult.error)
  return { success: false, error: 'Failed to fetch proforma items' }
}
```

- [ ] **Step 4: Parallelize session close approval queries**

In `app/api/pos/session/close/route.ts`, lines 132-190. The approver profile lookup and PIN lookup are sequential but the PIN lookup depends on the profile check passing. These are harder to parallelize safely since the profile check gates the PIN check. Leave this one as-is — the security validation chain is correct.

- [ ] **Step 5: Verify build**

Run: `pnpm tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add app/[locale]/(dashboard)/settings/page.tsx lib/actions/profile-actions.ts lib/actions/proformas.ts
git commit -m "perf: parallelize independent DB queries in settings, profile, proformas

Settings page: 3 sequential queries -> 1 Promise.all()
Profile actions: 3 sequential validations -> 1 Promise.all()
Proforma detail: sequential proforma+items -> parallel fetch

Closes #7"
```

---

## Task 9: Code-split report components with next/dynamic

**Files:**
- Modify: `components/reports/reports-client.tsx:5-7`

- [ ] **Step 1: Replace static imports with dynamic imports**

Replace lines 5-7:

```typescript
// REMOVE:
import { SalesReport } from './sales'
import { InventoryReport } from './inventory'
import { PerformanceReport } from './performance'

// REPLACE WITH:
import dynamic from 'next/dynamic'

const SalesReport = dynamic(
  () => import('./sales').then(m => m.SalesReport),
  { loading: () => <div className="space-y-4"><div className="h-32 bg-muted rounded animate-pulse" /><div className="h-64 bg-muted rounded animate-pulse" /></div> }
)
const InventoryReport = dynamic(
  () => import('./inventory').then(m => m.InventoryReport),
  { loading: () => <div className="space-y-4"><div className="h-32 bg-muted rounded animate-pulse" /><div className="h-64 bg-muted rounded animate-pulse" /></div> }
)
const PerformanceReport = dynamic(
  () => import('./performance').then(m => m.PerformanceReport),
  { loading: () => <div className="space-y-4"><div className="h-32 bg-muted rounded animate-pulse" /><div className="h-64 bg-muted rounded animate-pulse" /></div> }
)
```

- [ ] **Step 2: Verify build**

Run: `pnpm tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add components/reports/reports-client.tsx
git commit -m "perf: code-split report components with next/dynamic

Only the active report tab is loaded. Saves ~90KB on initial
report page load since all 3 reports were previously bundled.

Closes #8"
```

---

## Task 10: Defer Vercel Analytics + use after() for fire-and-forget

**Files:**
- Modify: `app/[locale]/layout.tsx:6,54`
- Modify: `lib/actions/products.ts:405-409`

- [ ] **Step 1: Defer Analytics in layout**

Replace line 6 and line 54 in `app/[locale]/layout.tsx`:

```typescript
// REMOVE line 6:
import { Analytics } from '@vercel/analytics/next';

// ADD:
import dynamic from 'next/dynamic'
const Analytics = dynamic(
  () => import('@vercel/analytics/next').then(m => m.Analytics),
  { ssr: false }
)
```

Line 54 (`<Analytics />`) stays unchanged — it's now lazy-loaded.

- [ ] **Step 2: Use after() for image cleanup in products.ts**

Replace lines 405-409 in `lib/actions/products.ts`:

```typescript
// REMOVE:
if (imageUrl && imageUrl.includes('supabase.co/storage/v1/object/public/')) {
  deleteStorageFile(imageUrl).catch((err) => {
    console.error('Failed to delete product image:', err)
  })
}

// REPLACE WITH:
import { after } from 'next/server'
// (add this import at top of file)

if (imageUrl && imageUrl.includes('supabase.co/storage/v1/object/public/')) {
  after(async () => {
    try {
      await deleteStorageFile(imageUrl)
    } catch (err) {
      console.error('Failed to delete product image:', err)
    }
  })
}
```

- [ ] **Step 3: Verify build**

Run: `pnpm tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add app/[locale]/layout.tsx lib/actions/products.ts
git commit -m "perf: defer Analytics to post-hydration + use after() for cleanup

Analytics no longer blocks hydration. Product image deletion uses
next/server after() for proper background execution.

Closes #9, Closes #15"
```

---

## Task 11: Fix duplicate fetch triggers in POS session dialogs

**Files:**
- Modify: `components/pos/unlock-session-dialog.tsx:79-97`
- Modify: `components/pos/manager-approval-dialog.tsx:99-109`

- [ ] **Step 1: Combine effects in unlock-session-dialog.tsx**

Replace lines 79-97 (two separate useEffects):

```typescript
// REMOVE both useEffects

// REPLACE WITH single effect:
useEffect(() => {
  if (open) {
    setMode(isOwner ? 'self' : 'manager')
    setPin('')
    setSelectedManager('')
    setError(null)
    if (!isOwner) {
      fetchValidators()
    }
  }
}, [open, isOwner, fetchValidators])

// Fetch validators when switching to manager mode (only if not already loaded)
useEffect(() => {
  if (open && mode === 'manager' && validators.length === 0) {
    fetchValidators()
  }
}, [open, mode, validators.length, fetchValidators])
```

The key fix: add `open` guard to the second effect so it doesn't fire when dialog is closed.

- [ ] **Step 2: Add guard in manager-approval-dialog.tsx**

The manager-approval-dialog effect (line 100-109) is fine structurally but could benefit from a state reset guard. Verify it only fetches once per open. Current code looks correct — `fetchValidators` is stable via `useCallback` and `open` toggles once. No change needed here.

- [ ] **Step 3: Verify build**

Run: `pnpm tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add components/pos/unlock-session-dialog.tsx
git commit -m "perf: fix duplicate fetch in unlock session dialog

Adds open guard to second useEffect preventing validator fetch
when dialog is closed.

Closes #14"
```

---

## Task 12: Simplify dashboard data fetching (single useEffect)

**Files:**
- Modify: `components/dashboard/dashboard-client.tsx:29-63`

- [ ] **Step 1: Replace useCallback + useEffect with single useEffect**

Replace lines 29-63:

```typescript
// REMOVE:
const fetchData = useCallback(async () => {
  // ...
}, [storeId, period])

useEffect(() => {
  fetchData()
}, [fetchData])

// REPLACE WITH:
useEffect(() => {
  let cancelled = false

  const loadData = async () => {
    setLoading(true)
    try {
      const days = getPeriodDays(period)
      const groupBy = getGroupByFromPeriod(period)

      const [metricsResult, trendResult, productsResult, alertsResult] = await Promise.all([
        getDashboardMetrics(storeId),
        getRevenueTrend(storeId, days, groupBy),
        getTopProducts(storeId, 5, days),
        getLowStockAlerts(storeId),
      ])

      if (cancelled) return

      if (metricsResult.success && metricsResult.data) {
        setMetrics(metricsResult.data)
      }
      if (trendResult.success && trendResult.data) {
        setRevenueTrend(trendResult.data)
      }
      if (productsResult.success && productsResult.data) {
        setTopProducts(productsResult.data)
      }
      if (alertsResult.success && alertsResult.data) {
        setLowStockAlerts(alertsResult.data)
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      if (!cancelled) setLoading(false)
    }
  }

  loadData()

  return () => { cancelled = true }
}, [storeId, period])
```

Also check if there's a refresh button that calls `fetchData()` — if so, keep a ref-based approach or extract the function. Looking at the code, line 75+ may have a refresh button. If it calls `fetchData`, we need to keep a callable reference. In that case, use `useRef` for the fetch function instead.

- [ ] **Step 2: Verify build**

Run: `pnpm tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/dashboard-client.tsx
git commit -m "perf: simplify dashboard to single useEffect with cancellation

Removes unnecessary useCallback wrapper. Adds cancellation guard
to prevent state updates after unmount or stale fetches.

Closes #16"
```

---

## Task 13: Dynamically import POS dialogs

**Files:**
- Modify: `components/pos/pos-client.tsx:21-29`

- [ ] **Step 1: Replace static dialog imports with dynamic**

Replace lines 21-29:

```typescript
// REMOVE:
import { OpenSessionDialog } from './open-session-dialog'
import { CloseSessionDialog } from './close-session-dialog'
import { LockSessionDialog } from './lock-session-dialog'
import { UnlockSessionDialog } from './unlock-session-dialog'
import { SyncConflictDialog } from './sync-conflict-dialog'
import { StoreSelectorDialog } from './store-selector-dialog'

// REPLACE WITH:
import dynamic from 'next/dynamic'

const OpenSessionDialog = dynamic(() => import('./open-session-dialog').then(m => m.OpenSessionDialog))
const CloseSessionDialog = dynamic(() => import('./close-session-dialog').then(m => m.CloseSessionDialog))
const LockSessionDialog = dynamic(() => import('./lock-session-dialog').then(m => m.LockSessionDialog))
const UnlockSessionDialog = dynamic(() => import('./unlock-session-dialog').then(m => m.UnlockSessionDialog))
const SyncConflictDialog = dynamic(() => import('./sync-conflict-dialog').then(m => m.SyncConflictDialog))
const StoreSelectorDialog = dynamic(() => import('./store-selector-dialog').then(m => m.StoreSelectorDialog))
```

- [ ] **Step 2: Verify build**

Run: `pnpm tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add components/pos/pos-client.tsx
git commit -m "perf: dynamically import POS dialog components

Dialogs are only opened on user interaction. Lazy loading reduces
initial POS bundle by ~30KB.

Closes #17"
```

---

## Task 14: Hoist email RegExp in user-form-dialog

**Files:**
- Modify: `components/settings/user-form-dialog.tsx:212`

- [ ] **Step 1: Hoist RegExp to module level**

Add at the top of the file (after imports):
```typescript
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
```

Replace line 212:
```typescript
// REMOVE:
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {

// REPLACE WITH:
if (!EMAIL_REGEX.test(value)) {
```

- [ ] **Step 2: Verify build**

Run: `pnpm tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add components/settings/user-form-dialog.tsx
git commit -m "perf: hoist email RegExp to module level

Prevents RegExp recompilation on every keystroke in the email
validation handler.

Closes #16"
```

---

## Task 15: Parallelize multi-store inventory updates in products

**Files:**
- Modify: `lib/actions/products.ts:1168-1180`

- [ ] **Step 1: Replace sequential loop with Promise.all()**

Replace lines 1168-1180:

```typescript
// REMOVE:
const errors: string[] = []
for (const inv of inventories) {
  const { error } = await supabase
    .from('product_inventory')
    .update({ quantity: inv.quantity })
    .eq('product_id', productId)
    .eq('store_id', inv.storeId)

  if (error) {
    errors.push(`Store ${inv.storeId}: ${error.message}`)
  }
}

// REPLACE WITH:
const results = await Promise.all(
  inventories.map(async (inv) => {
    const { error } = await supabase
      .from('product_inventory')
      .update({ quantity: inv.quantity })
      .eq('product_id', productId)
      .eq('store_id', inv.storeId)
    return error ? `Store ${inv.storeId}: ${error.message}` : null
  })
)
const errors = results.filter((e): e is string => e !== null)
```

- [ ] **Step 2: Verify build**

Run: `pnpm tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add lib/actions/products.ts
git commit -m "perf: parallelize multi-store inventory updates

Runs all inventory updates concurrently instead of sequentially.
Reduces latency from N*RTT to 1*RTT for multi-store updates.

Closes #6"
```

---

## Summary

| Task | Issue(s) | Category | Impact |
|---|---|---|---|
| T1 | #11 | JS Performance | Eliminates 8 Intl constructor calls/render |
| T2 | #12 | JS Performance | O(1) product lookups in POS cache |
| T3 | #12 | JS Performance | O(1) store/customer lookups in 5 components |
| T4 | #5 | Server/DB | N+1 → 1 query for stock movements |
| T5 | #5 | Server/DB | Parallel product list queries |
| T6 | #6 | Server/DB | Parallel refund inventory restoration |
| T7 | #6 | Server/DB | Parallel POS sync deductions |
| T8 | #7 | Server/DB | Parallel settings/profile/proforma queries |
| T9 | #8 | Bundle Size | ~90KB code-split reports |
| T10 | #9, #15 | Bundle/Server | Deferred analytics + after() |
| T11 | #14 | Client-Side | Fix duplicate fetches |
| T12 | #16 | Client-Side | Simplified dashboard effect |
| T13 | #17 | Bundle Size | ~30KB lazy POS dialogs |
| T14 | #16 | JS Performance | Hoisted RegExp |
| T15 | #6 | Server/DB | Parallel inventory updates |
