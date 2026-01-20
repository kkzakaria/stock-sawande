import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProductForm } from '@/components/products/product-form'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getAuthenticatedProfile } from '@/lib/server/cached-queries'

export const dynamic = 'force-dynamic'

interface NewProductPageProps {
  params: Promise<{ locale: string }>
}

export default async function NewProductPage({ params }: NewProductPageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('Products.form')

  // Use cached profile (deduplicated with layout)
  const { user, profile } = await getAuthenticatedProfile()

  if (!user) {
    redirect('/login')
  }

  // Only admin and manager can create products
  if (!['admin', 'manager'].includes(profile?.role || '')) {
    redirect('/dashboard')
  }

  const supabase = await createClient()

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
          <h2 className="text-3xl font-bold tracking-tight">{t('title')}</h2>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
      </div>

      <ProductForm
        categories={categories || []}
        stores={stores || []}
        userRole={profile?.role || 'cashier'}
        userStoreId={profile?.store_id || null}
      />
    </div>
  )
}
