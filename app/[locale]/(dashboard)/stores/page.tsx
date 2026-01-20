import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { StoresClient } from '@/components/stores/stores-client'
import { AddStoreDialog } from '@/components/stores/add-store-dialog'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getAuthenticatedProfile } from '@/lib/server/cached-queries'

interface StoresPageProps {
  params: Promise<{ locale: string }>
}

export default async function StoresPage({ params }: StoresPageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('Stores')

  // Use cached profile for role check
  const { user, profile } = await getAuthenticatedProfile()

  if (!user) {
    redirect('/auth/login')
  }

  // Only admins can access stores page
  if (profile?.role !== 'admin') {
    redirect('/dashboard')
  }

  const supabase = await createClient()

  // Get all stores
  const { data: stores } = await supabase
    .from('stores')
    .select('*')
    .order('name')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t('title')}</h2>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
        <AddStoreDialog />
      </div>

      <StoresClient stores={stores || []} />
    </div>
  )
}
