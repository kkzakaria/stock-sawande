import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { FileText, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { ProformaForm } from '@/components/proformas/proforma-form'
import { Button } from '@/components/ui/button'

// Disable caching for role checks
export const dynamic = 'force-dynamic'

interface EditProformaPageProps {
  params: Promise<{ id: string }>
}

export default async function EditProformaPage({ params }: EditProformaPageProps) {
  const { id } = await params
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

  // Fetch proforma
  const { data: proforma, error: proformaError } = await supabase
    .from('proformas')
    .select(`
      id,
      store_id,
      customer_id,
      tax,
      discount,
      notes,
      terms,
      valid_until,
      status,
      created_by
    `)
    .eq('id', id)
    .single()

  if (proformaError || !proforma) {
    notFound()
  }

  // Check access control
  if (profile.role === 'cashier' && proforma.created_by !== user.id) {
    redirect('/proformas')
  }

  if (profile.role === 'manager' && profile.store_id && proforma.store_id !== profile.store_id) {
    redirect('/proformas')
  }

  // Check if proforma can be edited
  if (!['draft', 'sent'].includes(proforma.status)) {
    redirect('/proformas')
  }

  // Fetch proforma items
  const { data: proformaItems } = await supabase
    .from('proforma_items')
    .select(`
      product_id,
      quantity,
      unit_price,
      discount,
      notes,
      product:product_templates(id, name, sku)
    `)
    .eq('proforma_id', id)

  // Format items for form
  const items = (proformaItems || []).map((item) => {
    const product = item.product as { id: string; name: string; sku: string } | null
    return {
      product_id: item.product_id,
      product_name: product?.name || 'Unknown',
      product_sku: product?.sku || '',
      quantity: item.quantity,
      unit_price: item.unit_price,
      discount: item.discount || 0,
      notes: item.notes || '',
    }
  })

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

  const initialData = {
    id: proforma.id,
    store_id: proforma.store_id,
    customer_id: proforma.customer_id,
    tax: proforma.tax,
    discount: proforma.discount || 0,
    notes: proforma.notes,
    terms: proforma.terms,
    valid_until: proforma.valid_until,
    items,
  }

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
          <h1 className="text-2xl font-bold">{t('edit.title')}</h1>
        </div>
      </div>

      {/* Form */}
      <ProformaForm
        initialData={initialData}
        products={products}
        customers={customers}
        stores={stores}
        userRole={profile.role}
        userStoreId={profile.store_id}
      />
    </div>
  )
}
