import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CustomersDataTable } from '@/components/customers/customers-data-table'
import { AddCustomerDialog } from '@/components/customers/add-customer-dialog'
import { getTranslations, setRequestLocale } from 'next-intl/server'

export const dynamic = 'force-dynamic'

interface CustomersPageProps {
  params: Promise<{ locale: string }>
}

export default async function CustomersPage({ params }: CustomersPageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('Customers')
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user profile to check role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  // All authenticated users can view customers page
  if (!profile) {
    redirect('/dashboard')
  }

  // Get all customers
  const { data: customers } = await supabase
    .from('customers')
    .select('*')
    .order('name')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t('title')}</h2>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
        <AddCustomerDialog />
      </div>

      <CustomersDataTable
        customers={customers || []}
        userRole={profile.role}
      />
    </div>
  )
}
