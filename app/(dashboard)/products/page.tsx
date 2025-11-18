import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { getProducts, getCategories, getStores } from '@/lib/actions/products'
import { ProductsClient } from '@/components/products/products-client'
import type { ProductFilters } from '@/lib/types/filters'

// Disable caching for role checks
export const dynamic = 'force-dynamic'

interface ProductsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Get user profile to check role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, store_id')
    .eq('id', user!.id)
    .single()

  // Only admin and manager can access products
  if (!['admin', 'manager'].includes(profile?.role || '')) {
    redirect('/dashboard')
  }

  // Parse search params into filters
  const params = await searchParams
  const filters: ProductFilters = {
    search: typeof params.search === 'string' ? params.search : undefined,
    category: typeof params.category === 'string' ? params.category : undefined,
    status: params.status === 'active' || params.status === 'inactive' ? params.status : undefined,
    store: typeof params.store === 'string' ? params.store : undefined,
    sortBy: ['name', 'sku', 'price', 'quantity', 'created_at'].includes(params.sortBy as string)
      ? (params.sortBy as 'name' | 'sku' | 'price' | 'quantity' | 'created_at')
      : 'created_at',
    sortOrder: params.sortOrder === 'desc' ? 'desc' : 'asc',
    page: typeof params.page === 'string' ? parseInt(params.page, 10) : 1,
    limit: typeof params.limit === 'string' ? parseInt(params.limit, 10) : 10,
  }

  // Fetch data in parallel
  const [productsResult, categoriesResult, storesResult] = await Promise.all([
    getProducts(filters),
    getCategories(),
    getStores(),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Products</h2>
          <p className="text-muted-foreground">
            Manage your inventory and products
          </p>
        </div>
        <Button asChild>
          <Link href="/products/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </Link>
        </Button>
      </div>

      <ProductsClient
        products={productsResult.data || []}
        categories={categoriesResult.data || []}
        stores={storesResult.data || []}
        totalCount={productsResult.totalCount || 0}
      />
    </div>
  )
}
