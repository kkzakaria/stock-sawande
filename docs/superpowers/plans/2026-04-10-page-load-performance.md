# Page Load Performance Fixes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate redundant auth calls, parallelize data fetching, and move dashboard data loading to server to cut page load times by 50-80%.

**Architecture:** Three-pronged approach: (1) Move dashboard data fetching from client `useEffect` to server component to eliminate 4 separate POST requests, (2) Replace raw `supabase.auth.getUser()` with `getCachedUser()` in server actions called during SSR, (3) Parallelize sequential Supabase queries on POS page.

**Tech Stack:** Next.js 16 Server Components, React 19 `cache()`, Supabase, TypeScript

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `app/[locale]/(dashboard)/dashboard/page.tsx` | Modify | Fetch all dashboard data server-side, pass as props |
| `components/dashboard/dashboard-client.tsx` | Modify | Accept pre-fetched data as props, remove useEffect fetch |
| `lib/actions/dashboard.ts` | Modify | Add `getActionContext` params to accept pre-resolved auth, add combined `getAllDashboardData()` |
| `lib/actions/products.ts` | Modify | Replace raw auth in `getProducts()` and `getProduct()` with cached helpers |
| `app/[locale]/(dashboard)/pos/page.tsx` | Modify | Parallelize sequential Supabase queries |

---

### Task 1: Dashboard — Move data fetching to server component

The `DashboardClient` currently calls 4 server actions via `useEffect`, creating 4 separate POST requests. Each one independently calls `getCachedUser()` + `getCachedProfile()`. Since each POST is a separate HTTP request, `React.cache()` can't deduplicate across them — that's 8 redundant auth calls.

**Fix:** Fetch all data in the server component `page.tsx` using `Promise.all` (single request, auth deduplicated by `React.cache()`), pass results as props.

**Files:**
- Modify: `lib/actions/dashboard.ts`
- Modify: `app/[locale]/(dashboard)/dashboard/page.tsx`
- Modify: `components/dashboard/dashboard-client.tsx`

- [ ] **Step 1: Add `getAllDashboardData()` to dashboard actions**

In `lib/actions/dashboard.ts`, add a combined fetcher that calls all 4 queries in parallel within a single request context (so `React.cache()` deduplicates the auth calls):

```typescript
/**
 * Fetch all dashboard data in a single request context
 * Uses React.cache() deduplication for auth — one getUser() call total
 */
export async function getAllDashboardData(
  storeId?: string,
  days: number = 30,
  groupBy: 'daily' | 'weekly' | 'monthly' = 'daily'
): Promise<{
  metrics: DashboardMetrics | null
  revenueTrend: RevenueTrend[]
  topProducts: TopProduct[]
  lowStockAlerts: LowStockAlert[]
}> {
  const [metricsResult, trendResult, productsResult, alertsResult] = await Promise.all([
    getDashboardMetrics(storeId),
    getRevenueTrend(storeId, days, groupBy),
    getTopProducts(storeId, 5, days),
    getLowStockAlerts(storeId),
  ])

  return {
    metrics: metricsResult.success ? metricsResult.data ?? null : null,
    revenueTrend: trendResult.success ? trendResult.data ?? [] : [],
    topProducts: productsResult.success ? productsResult.data ?? [] : [],
    lowStockAlerts: alertsResult.success ? alertsResult.data ?? [] : [],
  }
}
```

- [ ] **Step 2: Update dashboard page to fetch data server-side**

Replace `app/[locale]/(dashboard)/dashboard/page.tsx` to call `getAllDashboardData()` and pass data as props:

```typescript
import { DashboardClient } from '@/components/dashboard'
import { getAuthenticatedProfile } from '@/lib/server/cached-queries'
import { getAllDashboardData } from '@/lib/actions/dashboard'

export default async function DashboardPage() {
  // Use cached profile (deduplicated with layout)
  const { profile } = await getAuthenticatedProfile()

  // Determine store context based on role
  const storeId = profile?.role === 'admin' ? undefined : (profile?.store_id ?? undefined)
  const storeName = profile?.role === 'admin'
    ? undefined
    : profile?.stores?.name ?? undefined

  // Fetch all dashboard data server-side in a single request
  // React.cache() deduplicates the auth calls across all 4 queries
  const initialData = await getAllDashboardData(storeId)

  return (
    <DashboardClient
      storeId={storeId}
      storeName={storeName}
      initialData={initialData}
    />
  )
}
```

- [ ] **Step 3: Update DashboardClient to accept initialData and use it**

Modify `components/dashboard/dashboard-client.tsx`:
- Add `initialData` prop with pre-fetched data
- Initialize state from `initialData` instead of `null`/`[]`
- Set `loading` initial state to `false` (data is already loaded)
- Keep the `useEffect` fetch only for period changes (when user selects a different period)
- Remove the initial fetch from `useEffect` (only refetch on period change)

```typescript
interface DashboardClientProps {
  storeId?: string
  storeName?: string
  initialData: {
    metrics: DashboardMetrics | null
    revenueTrend: RevenueTrend[]
    topProducts: TopProduct[]
    lowStockAlerts: LowStockAlert[]
  }
}

export function DashboardClient({ storeId, storeName, initialData }: DashboardClientProps) {
  const t = useTranslations('Dashboard')
  const [period, setPeriod] = useState<Period>('30d')
  const [loading, setLoading] = useState(false)
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(initialData.metrics)
  const [revenueTrend, setRevenueTrend] = useState<RevenueTrend[]>(initialData.revenueTrend)
  const [topProducts, setTopProducts] = useState<TopProduct[]>(initialData.topProducts)
  const [lowStockAlerts, setLowStockAlerts] = useState<LowStockAlert[]>(initialData.lowStockAlerts)

  const isInitialPeriod = useRef(true)
  const fetchDataRef = useRef<() => void>(() => {})

  useEffect(() => {
    // Skip initial fetch — data is already loaded server-side
    if (isInitialPeriod.current) {
      isInitialPeriod.current = false
      return
    }

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

    fetchDataRef.current = loadData
    loadData()

    return () => { cancelled = true }
  }, [storeId, period])

  // ... rest unchanged
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add lib/actions/dashboard.ts app/\[locale\]/\(dashboard\)/dashboard/page.tsx components/dashboard/dashboard-client.tsx
git commit -m "perf(dashboard): fetch data server-side to eliminate 4 POST requests + 8 redundant auth calls"
```

---

### Task 2: Products — Replace raw auth with cached helpers in `getProducts()`

`getProducts()` in `lib/actions/products.ts` is called from the Products page during SSR. It makes raw `supabase.auth.getUser()` + `profiles` query instead of using `getCachedUser()`/`getCachedProfile()` which are already resolved by the layout. Since server actions called during SSR share the same request context, `React.cache()` will deduplicate.

**Files:**
- Modify: `lib/actions/products.ts:443-566` (getProducts function)
- Modify: `lib/actions/products.ts:633-680` (getProduct function)

- [ ] **Step 1: Update `getProducts()` to use cached auth helpers**

Replace lines 443-465 in `lib/actions/products.ts`. Change from raw `supabase.auth.getUser()` + profile query to `getCachedUser()` + `getCachedProfile()`:

Add import at top of file:
```typescript
import { getCachedUser, getCachedProfile } from '@/lib/server/cached-queries'
```

Replace the auth block in `getProducts()` (lines 445-460):

Old:
```typescript
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated', data: [], totalCount: 0, userRole: null }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, store_id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return { success: false, error: 'Profile not found', data: [], totalCount: 0, userRole: null }
    }
```

New:
```typescript
    const user = await getCachedUser()
    if (!user) {
      return { success: false, error: 'Not authenticated', data: [], totalCount: 0, userRole: null }
    }

    const cachedProfile = await getCachedProfile(user.id)
    if (!cachedProfile) {
      return { success: false, error: 'Profile not found', data: [], totalCount: 0, userRole: null }
    }

    const profile = { role: cachedProfile.role, store_id: cachedProfile.store_id }
    const supabase = await createClient()
```

Note: `supabase` client creation moves after auth check — no need to create it if auth fails. The rest of the function continues using `supabase` for data queries as before.

- [ ] **Step 2: Update `getProduct()` to use cached auth helpers**

Same pattern for `getProduct()` at line 633. Replace the auth block:

Old (lines 635-640):
```typescript
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated', data: null }
    }
```

New:
```typescript
    const user = await getCachedUser()
    if (!user) {
      return { success: false, error: 'Not authenticated', data: null }
    }

    const supabase = await createClient()
```

And replace the parallel profile query (lines 643-648) — remove the profile fetch from `Promise.all` since we can use cached:

Old:
```typescript
    const [profileResult, productResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('role, store_id')
        .eq('id', user.id)
        .single(),
      supabase
        .from('product_templates')
        ...
    ])

    const profile = profileResult.data
```

New:
```typescript
    const [cachedProfile, productResult] = await Promise.all([
      getCachedProfile(user.id),
      supabase
        .from('product_templates')
        ...
    ])

    const profile = cachedProfile ? { role: cachedProfile.role, store_id: cachedProfile.store_id } : null
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add lib/actions/products.ts
git commit -m "perf(products): use cached auth helpers to eliminate redundant getUser/profile calls during SSR"
```

---

### Task 3: POS — Parallelize sequential Supabase queries

The POS page makes 3-4 sequential Supabase queries that could run in parallel. Currently:
1. `getAuthenticatedProfile()` → wait
2. Extended profile query → wait
3. Store count query → wait
4. Products query → wait

After auth, queries 2+3+4 can all run in parallel.

**Files:**
- Modify: `app/[locale]/(dashboard)/pos/page.tsx:53-178`

- [ ] **Step 1: Restructure POS page to parallelize queries**

After the auth check and early returns (line 51), restructure to run queries in parallel. Replace lines 53-178 with:

```typescript
  const supabase = await createClient()

  // Determine store context
  const isAdmin = cachedProfile.role === 'admin'
  const isManagerOrAdmin = cachedProfile.role === 'admin' || cachedProfile.role === 'manager'
  const activeStoreId = isAdmin ? storeFromUrl : cachedProfile.store_id

  // Run all independent queries in parallel
  const [profileResult, storeCountResult] = await Promise.all([
    // Extended profile with store details for receipts
    supabase
      .from('profiles')
      .select('id, store_id, role, full_name, store:stores(id, name, address, phone)')
      .eq('id', user.id)
      .single(),
    // Count available stores (for store selector logic)
    isAdmin
      ? supabase.from('stores').select('*', { count: 'exact', head: true })
      : cachedProfile.role === 'manager'
        ? supabase.from('user_stores').select('*', { count: 'exact', head: true })
        : Promise.resolve({ count: 0 }),
  ])

  const profile = profileResult.data
  if (!profile) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">{t('errors.profileError')}</h2>
          <p className="mt-2 text-gray-600">{t('errors.contactAdmin')}</p>
        </div>
      </div>
    )
  }

  const availableStoresCount = storeCountResult.count || 0
  const canSelectStore = isManagerOrAdmin && availableStoresCount > 1
```

Then for the products query + optional store info fetch (after the `activeStoreId` check), parallelize those too:

```typescript
  // Fetch products and optional admin store info in parallel
  const PRODUCT_LIMIT = 200

  const [productsResult, storeInfoResult] = await Promise.all([
    supabase
      .from('product_templates')
      .select(
        'id, sku, name, price, min_price, max_price, barcode, image_url, category:categories(id, name), inventory:product_inventory!inner(id, quantity, store_id, stores:store_id(name))'
      )
      .eq('is_active', true)
      .eq('product_inventory.store_id', activeStoreId)
      .order('name')
      .limit(PRODUCT_LIMIT),
    // Only fetch store info for admins using URL param
    isAdmin && storeFromUrl
      ? supabase.from('stores').select('id, name, address, phone').eq('id', storeFromUrl).single()
      : Promise.resolve({ data: null }),
  ])
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add app/\[locale\]/\(dashboard\)/pos/page.tsx
git commit -m "perf(pos): parallelize sequential Supabase queries to reduce page load time"
```

---

### Task 4: Reports page — Use `getStores` from cached-queries

**Files:**
- Modify: `app/[locale]/(dashboard)/reports/page.tsx`

- [ ] **Step 1: Replace `getStores()` server action with direct cached query**

The reports page calls `getStores()` which is a server action that does its own auth. Since we're already in a server component with auth resolved, use `getCachedStores()` instead:

Old (line 2, 36):
```typescript
import { getStores } from '@/lib/actions/products'
// ...
const { data: stores } = await getStores()
```

New:
```typescript
import { getCachedStores } from '@/lib/server/cached-queries'
// ...
const stores = await getCachedStores()
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add app/\[locale\]/\(dashboard\)/reports/page.tsx
git commit -m "perf(reports): use cached stores query instead of server action with redundant auth"
```

---

## Summary of Performance Impact

| Fix | Before | After | Savings |
|-----|--------|-------|---------|
| Task 1: Dashboard server-side fetch | 8 POST requests (4 actions × 2 auth each) | 1 SSR request (auth deduplicated) | ~7 network round-trips eliminated |
| Task 2: Products cached auth | 2 extra Supabase calls (getUser + profile) | 0 extra (deduplicated by React.cache) | ~200-400ms per page load |
| Task 3: POS parallel queries | 4 sequential queries (~4× latency) | 2 parallel batches (~2× latency) | ~50% faster POS load |
| Task 4: Reports cached stores | 1 extra auth round-trip | 0 (uses 5min cache) | ~100-200ms per page load |
