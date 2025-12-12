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

  const supabase = await createClient()

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Get user profile with store information (including address/phone for offline receipts)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, store_id, role, full_name, store:stores(id, name, address, phone)')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
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

  // Check if user can select store (admin or manager with multiple stores)
  const isAdmin = profile.role === 'admin'
  const isManagerOrAdmin = profile.role === 'admin' || profile.role === 'manager'

  // Count available stores to determine if store switching makes sense
  let availableStoresCount = 0
  if (isAdmin) {
    // Admins can access all stores
    const { count } = await supabase
      .from('stores')
      .select('*', { count: 'exact', head: true })
    availableStoresCount = count || 0
  } else if (profile.role === 'manager') {
    // Managers can only access assigned stores
    const { count } = await supabase
      .from('user_stores')
      .select('*', { count: 'exact', head: true })
    availableStoresCount = count || 0
  }

  // Only show store selector if user has role permission AND multiple stores available
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

  // Fetch the store info for admins (since they use URL param, not profile.store)
  let storeInfo = profile.store
  if (isAdmin && storeFromUrl) {
    const { data: storeData } = await supabase
      .from('stores')
      .select('id, name, address, phone')
      .eq('id', storeFromUrl)
      .single()

    if (storeData) {
      storeInfo = storeData
    }
  }

  // Fetch customers for proforma creation
  const { data: customers } = await supabase
    .from('customers')
    .select('id, name, email, phone')
    .order('name')

  // Fetch products with ALL inventory (not just current store) for multi-store visibility
  const { data: products, error: productsError } = await supabase
    .from('product_templates')
    .select(
      `
      id,
      sku,
      name,
      price,
      barcode,
      image_url,
      category:categories(id, name),
      inventory:product_inventory!product_inventory_product_id_fkey(
        id,
        quantity,
        store_id,
        stores:store_id(name)
      )
    `
    )
    .eq('is_active', true)
    .order('name')

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
        customers={customers || []}
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
