import { redirect } from 'next/navigation'
import { getProducts } from '@/lib/actions/products'
import { ProductsClient } from '@/components/products/products-client'
import { getAuthenticatedProfile } from '@/lib/server/cached-queries'
import { createClient } from '@/lib/supabase/server'
import type { ColumnFiltersState, SortingState } from '@tanstack/react-table'

// Disable caching for role checks
export const dynamic = 'force-dynamic'

const DEFAULT_PAGE_SIZE = 10
const SORT_BY_VALUES = ['name', 'sku', 'price', 'quantity', 'created_at', 'category'] as const
type SortByValue = (typeof SORT_BY_VALUES)[number]

interface ProductsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

function parseJsonParam<T>(value: string | string[] | undefined, fallback: T): T {
  if (typeof value !== 'string') return fallback
  try {
    const parsed = JSON.parse(value)
    return parsed as T
  } catch {
    return fallback
  }
}

function readInt(value: string | string[] | undefined, fallback: number): number {
  if (typeof value !== 'string') return fallback
  const n = Number.parseInt(value, 10)
  return Number.isFinite(n) ? n : fallback
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  // Use cached profile (deduplicated with layout)
  const { user, profile } = await getAuthenticatedProfile()

  if (!user) {
    redirect('/login')
  }

  // Only admin and manager can access products
  if (!['admin', 'manager'].includes(profile?.role || '')) {
    redirect('/dashboard')
  }

  const sp = await searchParams

  // URL state lives in the same JSON-shaped keys that the data table writes —
  // see lib/url-state-parsers.ts (columnFiltersParser, sortingStateParser).
  // We translate that into ProductFilters here so getProducts can paginate,
  // search and sort on the server instead of shipping every row to the client.
  const pageIndex = Math.max(0, readInt(sp.pageIndex, 0))
  const pageSize = Math.max(1, readInt(sp.pageSize, DEFAULT_PAGE_SIZE))
  const columnFilters = parseJsonParam<ColumnFiltersState>(sp.filters, [])
  const sorting = parseJsonParam<SortingState>(sp.sorting, [])

  const nameFilter = columnFilters.find((f) => f.id === 'name')
  const categoryFilter = columnFilters.find((f) => f.id === 'category')
  const statusFilter = columnFilters.find((f) => f.id === 'is_active')

  const search = typeof nameFilter?.value === 'string' ? nameFilter.value : ''
  const selectedCategoryNames = Array.isArray(categoryFilter?.value)
    ? (categoryFilter.value as string[])
    : []
  const statusValues = Array.isArray(statusFilter?.value)
    ? (statusFilter.value as string[])
    : []
  const status: 'active' | 'inactive' | null =
    statusValues.length === 1
      ? statusValues[0] === 'active'
        ? 'active'
        : statusValues[0] === 'inactive'
          ? 'inactive'
          : null
      : null

  const firstSort = sorting[0]
  const sortBy: SortByValue | null =
    firstSort && (SORT_BY_VALUES as readonly string[]).includes(firstSort.id)
      ? (firstSort.id as SortByValue)
      : null
  const sortOrder: 'asc' | 'desc' = firstSort?.desc ? 'desc' : 'asc'

  // Categories are needed both for the facet options (the data table only sees
  // the current page, so it can't build the full list itself) and for mapping
  // selected names back to UUIDs for server-side filtering.
  const supabase = await createClient()
  const categoriesPromise = supabase
    .from('categories')
    .select('id, name')
    .order('name')

  const categoriesResult = await categoriesPromise
  const allCategories = (categoriesResult.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
  }))
  const categoryNameToId = new Map(allCategories.map((c) => [c.name, c.id]))
  const selectedCategoryIds = selectedCategoryNames
    .map((name) => categoryNameToId.get(name))
    .filter((id): id is string => typeof id === 'string')

  const productsResult = await getProducts({
    search: search || null,
    categoryIds: selectedCategoryIds.length > 0 ? selectedCategoryIds : null,
    status,
    sortBy,
    sortOrder,
    page: pageIndex + 1,
    limit: pageSize,
  })

  const totalCount = productsResult.totalCount ?? 0
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize))

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0">
        {/* Type assertion needed because getProducts returns dynamic shape based on user role */}
        <ProductsClient
          products={(productsResult.data || []) as Parameters<typeof ProductsClient>[0]['products']}
          userRole={productsResult.userRole}
          totalCount={totalCount}
          pageCount={pageCount}
          allCategories={allCategories}
        />
      </div>
    </div>
  )
}
