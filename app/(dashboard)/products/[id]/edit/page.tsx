import { redirect } from 'next/navigation'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProductForm } from '@/components/products/product-form'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { getProduct } from '@/lib/actions/products'

export const dynamic = 'force-dynamic'

interface EditProductPageProps {
  params: {
    id: string
  }
}

export default async function EditProductPage({ params }: EditProductPageProps) {
  // Next.js 16: params is now a Promise and must be awaited
  const resolvedParams = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Get user profile to check role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, store_id')
    .eq('id', user!.id)
    .single()

  // Only admin and manager can edit products
  if (!['admin', 'manager'].includes(profile?.role || '')) {
    redirect('/dashboard')
  }

  // Fetch product
  const productResult = await getProduct(resolvedParams.id)
  if (!productResult.success || !productResult.data) {
    notFound()
  }

  const product = productResult.data

  // Fetch categories
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
    .order('name')

  // Fetch stores
  const { data: stores } = await supabase
    .from('stores')
    .select('id, name')
    .order('name')

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
