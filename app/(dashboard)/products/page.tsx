import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProducts } from '@/lib/actions/products'
import { ProductsClient } from '@/components/products/products-client'

// Disable caching for role checks
export const dynamic = 'force-dynamic'

interface ProductsPageProps {
  searchParams: Promise<{
    page?: string
    limit?: string
    search?: string
    category?: string
    status?: string
  }>
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

  // Parse pagination and filter params
  const params = await searchParams
  const page = Number(params.page) || 1
  const limit = Number(params.limit) || 10
  const search = params.search || undefined
  const category = params.category || undefined
  const status =
    params.status === 'active' || params.status === 'inactive'
      ? params.status
      : undefined

  // Fetch paginated products
  const productsResult = await getProducts({
    page,
    limit,
    search,
    category,
    status,
  })

  // Calculate total pages
  const totalProducts = productsResult.totalCount || 0
  const pageCount = Math.ceil(totalProducts / limit)

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Products</h2>
          <p className="text-muted-foreground">
            Manage your inventory and products
          </p>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <ProductsClient
          products={productsResult.data || []}
          pageCount={pageCount}
          pageSize={limit}
        />
      </div>
    </div>
  )
}
