/**
 * POS Page (Server Component)
 * Fetches products and inventory for the current user's store
 * Passes data to POSClient for rendering
 */

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { POSClient } from '@/components/pos/pos-client'
import { StoreSelectorRequired } from '@/components/pos/store-selector-required'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getAuthenticatedProfile } from '@/lib/server/cached-queries'

// Force dynamic rendering to always get fresh inventory data
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Point of Sale | Next-Stock',
  description: 'Point of sale checkout system',
}

interface POSPageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ store?: string }>
}

export default async function POSPage({ params, searchParams }: POSPageProps) {
  const { locale } = await params
  const { store: storeFromUrl } = await searchParams
  setRequestLocale(locale)
  const t = await getTranslations('POS')

  // Use cached profile for auth check (deduplicated with layout)
  const { user, profile: cachedProfile } = await getAuthenticatedProfile()

  if (!user) {
    redirect('/auth/login')
  }

  if (!cachedProfile) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">{t('errors.profileError')}</h2>
          <p className="mt-2 text-gray-600">
            {t('errors.contactAdmin')}
          </p>
        </div>
      </div>
    )
  }

  const supabase = await createClient()

  const isAdmin = cachedProfile.role === 'admin'
  const isManagerOrAdmin = cachedProfile.role === 'admin' || cachedProfile.role === 'manager'

  // Run extended profile + store count queries in parallel
  const [profileResult, storeCountResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, store_id, role, full_name, store:stores(id, name, address, phone)')
      .eq('id', user.id)
      .single(),
    isAdmin
      ? supabase.from('stores').select('*', { count: 'exact', head: true })
      : cachedProfile.role === 'manager'
        ? supabase
            .from('user_stores')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
        : Promise.resolve({ count: 0 } as { count: number }),
  ])

  const profile = profileResult.data
  if (!profile) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">{t('errors.profileError')}</h2>
          <p className="mt-2 text-gray-600">
            {t('errors.contactAdmin')}
          </p>
        </div>
      </div>
    )
  }

  const availableStoresCount = storeCountResult.count || 0
  const canSelectStore = isManagerOrAdmin && availableStoresCount > 1

  // For admins: use store from URL param (session-based, not persisted)
  // For managers/cashiers: use their assigned store from profile
  const activeStoreId = isAdmin ? storeFromUrl : profile.store_id

  // Show store selector if:
  // - Admin without URL store param (free choice each session)
  // - Non-admin without assigned store
  if (!activeStoreId) {
    // Admins and managers can select a store
    if (canSelectStore) {
      return (
        <StoreSelectorRequired
          userId={user.id}
          userRole={profile.role}
        />
      )
    }

    // Cashiers without store must contact admin
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">{t('errors.noStoreAssigned')}</h2>
          <p className="mt-2 text-gray-600">
            {t('errors.noStoreDescription')}
          </p>
          <p className="mt-1 text-sm text-gray-500">{t('errors.contactAdmin')}</p>
        </div>
      </div>
    )
  }

  // Customers are loaded on-demand in the client component to reduce initial payload

  // Limit products to optimize initial page load
  const PRODUCT_LIMIT = 200

  // Type for the product query result
  type ProductQueryResult = {
    id: string
    sku: string
    name: string
    price: number
    min_price: number | null
    max_price: number | null
    barcode: string | null
    image_url: string | null
    category: { id: string; name: string } | null
    inventory: Array<{
      id: string
      quantity: number
      store_id: string
      stores: { name: string } | null
    }>
  }

  // Fetch products and optional admin store info in parallel
  const [productsQueryResult, storeInfoResult] = await Promise.all([
    supabase
      .from('product_templates')
      .select(
        'id, sku, name, price, min_price, max_price, barcode, image_url, category:categories(id, name), inventory:product_inventory!inner(id, quantity, store_id, stores:store_id(name))'
      )
      .eq('is_active', true)
      .eq('product_inventory.store_id', activeStoreId)
      .order('name')
      .limit(PRODUCT_LIMIT)
      .returns<ProductQueryResult[]>(),
    isAdmin && storeFromUrl
      ? supabase.from('stores').select('id, name, address, phone').eq('id', storeFromUrl).single()
      : Promise.resolve({ data: null, error: null }),
  ])

  const { data: products, error: productsError } = productsQueryResult

  // Update storeInfo from parallel result
  let storeInfo = profile.store
  if (storeInfoResult.data) {
    storeInfo = storeInfoResult.data
  }

  if (productsError) {
    console.error('Error fetching products:', productsError)
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600">{t('errors.loadingError')}</h2>
          <p className="mt-2 text-gray-600">{productsError.message}</p>
        </div>
      </div>
    )
  }

  // Transform products to include current store's inventory + multi-store info
  const productsWithInventory = products
    ?.map((product) => {
      const storeInventory = product.inventory.find(
        (inv: { store_id: string }) => inv.store_id === activeStoreId
      )

      if (!storeInventory) return null

      // Calculate total quantity across all stores and other stores info
      const allInventories = product.inventory as Array<{
        id: string
        quantity: number
        store_id: string
        stores: { name: string } | null
      }>

      const totalQuantity = allInventories.reduce((sum, inv) => sum + inv.quantity, 0)
      const otherStoresInventory = allInventories
        .filter(inv => inv.store_id !== activeStoreId && inv.quantity > 0)
        .map(inv => ({
          storeId: inv.store_id,
          storeName: inv.stores?.name || 'Unknown',
          quantity: inv.quantity,
        }))

      return {
        id: product.id,
        sku: product.sku,
        name: product.name,
        price: Number(product.price),
        minPrice: product.min_price !== null ? Number(product.min_price) : null,
        maxPrice: product.max_price !== null ? Number(product.max_price) : null,
        barcode: product.barcode || '',
        imageUrl: product.image_url || null,
        category: product.category,
        inventoryId: storeInventory.id,
        quantity: storeInventory.quantity,
        // Multi-store info
        totalQuantity,
        otherStoresInventory,
      }
    })
    .filter((p): p is NonNullable<typeof p> => p !== null) || []

  return (
    <div className="h-full overflow-hidden">
      <POSClient
        products={productsWithInventory}
        customers={[]}
        storeId={activeStoreId}
        cashierId={user.id}
        cashierName={profile.full_name || 'User'}
        storeInfo={{
          name: storeInfo?.name || 'Store',
          address: storeInfo?.address || null,
          phone: storeInfo?.phone || null,
        }}
        canSelectStore={canSelectStore}
        userRole={profile.role}
      />
    </div>
  )
}
