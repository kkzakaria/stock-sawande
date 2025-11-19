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

  // Fetch all products (client-side pagination with nuqs)
  const productsResult = await getProducts({
    limit: 1000, // Load all products for client-side pagination
  })

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0">
        <ProductsClient products={productsResult.data || []} />
      </div>
    </div>
  )
}
