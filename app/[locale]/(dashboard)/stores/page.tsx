import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { StoresClient } from '@/components/stores/stores-client'
import { AddStoreDialog } from '@/components/stores/add-store-dialog'
import { getTranslations, setRequestLocale } from 'next-intl/server'

// Disable caching for role checks
export const dynamic = 'force-dynamic'

interface StoresPageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function StoresPage({ params, searchParams }: StoresPageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('Stores')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Get user profile to check role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single()

  // Only admins can access stores page
  if (profile?.role !== 'admin') {
    redirect('/dashboard')
  }

  // searchParams available for future server-side filtering
  await searchParams

  // Get all stores (filtering is done client-side for simplicity)
  const { data: stores } = await supabase
    .from('stores')
    .select('*')
    .order('name')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t('title')}</h2>
          <p className="text-muted-foreground">
            {t('description')}
          </p>
        </div>
        <AddStoreDialog />
      </div>

      <StoresClient stores={stores || []} />
    </div>
  )
}
