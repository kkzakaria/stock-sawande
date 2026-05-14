import { redirect } from 'next/navigation'
import { getProducts } from '@/lib/actions/products'
import { ProductsClient } from '@/components/products/products-client'
import { getAuthenticatedProfile } from '@/lib/server/cached-queries'

// Disable caching for role checks
export const dynamic = 'force-dynamic'

// Cap initial payload. Client still paginates locally, but loading 1000
// rows on every page hit (the previous default) shipped ~500KB JSON to
// every dashboard user even when most of it was never displayed.
// Beyond PRODUCTS_INITIAL_LIMIT we log a server warning to signal the
// need for proper server pagination — tracked as a follow-up.
const PRODUCTS_INITIAL_LIMIT = 250

export default async function ProductsPage() {
  // Use cached profile (deduplicated with layout)
  const { user, profile } = await getAuthenticatedProfile()

  if (!user) {
    redirect('/login')
  }

  // Only admin and manager can access products
  if (!['admin', 'manager'].includes(profile?.role || '')) {
    redirect('/dashboard')
  }

  const productsResult = await getProducts({
    limit: PRODUCTS_INITIAL_LIMIT,
  })

  if (
    productsResult.success &&
    productsResult.totalCount > PRODUCTS_INITIAL_LIMIT
  ) {
    console.warn(
      `[products] Inventory of ${productsResult.totalCount} products exceeds the initial fetch cap of ${PRODUCTS_INITIAL_LIMIT}. Older rows are not visible until server pagination ships.`
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0">
        {/* Type assertion needed because getProducts returns dynamic shape based on user role */}
        <ProductsClient
          products={(productsResult.data || []) as Parameters<typeof ProductsClient>[0]['products']}
          userRole={productsResult.userRole}
        />
      </div>
    </div>
  )
}
