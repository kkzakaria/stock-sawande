/**
 * POS Page (Server Component)
 * Fetches products and inventory for the current user's store
 * Passes data to POSClient for rendering
 */

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { POSClient } from '@/components/pos/pos-client'
import { getTranslations, setRequestLocale } from 'next-intl/server'

// Force dynamic rendering to always get fresh inventory data
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Point of Sale | Next-Stock',
  description: 'Point of sale checkout system',
}

interface POSPageProps {
  params: Promise<{ locale: string }>
}

export default async function POSPage({ params }: POSPageProps) {
  const { locale } = await params
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

  if (profileError || !profile || !profile.store_id) {
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

  // Fetch products with inventory for current store
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
        store_id
      )
    `
    )
    .eq('is_active', true)
    .eq('inventory.store_id', profile.store_id)
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

  // Transform products to include only current store's inventory
  const productsWithInventory = products
    ?.map((product) => {
      const storeInventory = product.inventory.find(
        (inv: { store_id: string }) => inv.store_id === profile.store_id
      )

      if (!storeInventory) return null

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
      }
    })
    .filter((p): p is NonNullable<typeof p> => p !== null) || []

  return (
    <div className="h-full overflow-hidden">
      <POSClient
        products={productsWithInventory}
        storeId={profile.store_id}
        cashierId={user.id}
        cashierName={profile.full_name || 'User'}
        storeInfo={{
          name: profile.store?.name || 'Store',
          address: profile.store?.address || null,
          phone: profile.store?.phone || null,
        }}
      />
    </div>
  )
}
