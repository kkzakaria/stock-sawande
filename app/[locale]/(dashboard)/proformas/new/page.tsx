import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { FileText, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { ProformaForm } from '@/components/proformas/proforma-form'
import { Button } from '@/components/ui/button'

// Disable caching for role checks
export const dynamic = 'force-dynamic'

export default async function NewProformaPage() {
  const t = await getTranslations('Proformas')
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user profile to check role and store
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, store_id')
    .eq('id', user.id)
    .single()

  if (!profile) {
    redirect('/login')
  }

  // Fetch required data in parallel
  const [productsResult, customersResult, storesResult] = await Promise.all([
    // Fetch products
    supabase
      .from('product_templates')
      .select('id, name, sku, price')
      .eq('is_active', true)
      .order('name'),

    // Fetch customers
    supabase
      .from('customers')
      .select('id, name, email, phone')
      .order('name'),

    // Fetch stores
    supabase
      .from('stores')
      .select('id, name')
      .order('name'),
  ])

  const products = productsResult.data || []
  const customers = customersResult.data || []
  const stores = storesResult.data || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/proformas">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <FileText className="h-6 w-6" />
          <h1 className="text-2xl font-bold">{t('new.title')}</h1>
        </div>
      </div>

      {/* Form */}
      <ProformaForm
        products={products}
        customers={customers}
        stores={stores}
        userRole={profile.role}
        userStoreId={profile.store_id}
      />
    </div>
  )
}
