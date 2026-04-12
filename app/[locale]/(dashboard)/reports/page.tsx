import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ReportsClient } from '@/components/reports/reports-client'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getAuthenticatedProfile } from '@/lib/server/cached-queries'
import { getUserAccessibleStoreIds } from '@/lib/helpers/store-access'

// Disable caching for role checks
export const dynamic = 'force-dynamic'

interface ReportsPageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function ReportsPage({ params, searchParams }: ReportsPageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('Reports')

  // Use cached profile (deduplicated with layout)
  const { user, profile } = await getAuthenticatedProfile()

  if (!user) {
    redirect('/login')
  }

  // Only admin and manager can access reports
  if (!profile || !['admin', 'manager'].includes(profile.role)) {
    redirect('/dashboard')
  }

  // searchParams available for future server-side filtering
  await searchParams

  // Fetch stores for filter dropdown, scoped by role
  // Non-admins only see their assigned store (mirrors previous getStores() behavior)
  const supabase = await createClient()
  let storesQuery = supabase
    .from('stores')
    .select('id, name')
    .order('name')

  if (profile.role !== 'admin') {
    const accessibleStoreIds = await getUserAccessibleStoreIds(supabase, user.id, profile.store_id)
    if (accessibleStoreIds.length === 0) {
      redirect('/dashboard')
    }
    storesQuery = storesQuery.in('id', accessibleStoreIds)
  }

  const { data: stores, error: storesError } = await storesQuery
  if (storesError) {
    console.error('Error fetching stores for reports:', storesError)
    throw storesError
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">{t('title')}</h2>
        <p className="text-muted-foreground">
          {t('description')}
        </p>
      </div>

      <ReportsClient stores={stores || []} />
    </div>
  )
}
