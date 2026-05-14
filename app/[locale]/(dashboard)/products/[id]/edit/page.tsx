import { redirect } from 'next/navigation'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProductForm } from '@/components/products/product-form'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { getProduct } from '@/lib/actions/products'
import { getAuthenticatedProfile } from '@/lib/server/cached-queries'

interface EditProductPageProps {
  params: Promise<{
    id: string
    locale: string
  }>
}

export default async function EditProductPage({ params }: EditProductPageProps) {
  const { id, locale: _locale } = await params

  // Use cached profile (deduplicated with layout)
  const { user, profile } = await getAuthenticatedProfile()

  if (!user) {
    redirect('/login')
  }

  // Only admin and manager can edit products
  if (!['admin', 'manager'].includes(profile?.role || '')) {
    redirect('/dashboard')
  }

  // Fetch product, categories, and stores in parallel.
  // (getCachedCategories/getCachedStores in cached-queries.ts can't be wired
  // up here yet — their unstable_cache wrapper calls createClient() which
  // reads cookies, which Next 16 forbids inside cached scopes.)
  const supabase = await createClient()
  const [productResult, categoriesResult, storesResult] = await Promise.all([
    getProduct(id),
    supabase.from('categories').select('id, name').order('name'),
    supabase.from('stores').select('id, name').order('name'),
  ])

  if (!productResult.success || !productResult.data) {
    notFound()
  }

  const product = productResult.data
  const categories = categoriesResult.data
  const stores = storesResult.data

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/products">
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Edit Product</h2>
          <p className="text-muted-foreground">Update product information</p>
        </div>
      </div>

      <ProductForm
        initialData={product}
        categories={categories || []}
        stores={stores || []}
        userRole={profile?.role || 'cashier'}
        userStoreId={profile?.store_id || null}
      />
    </div>
  )
}
