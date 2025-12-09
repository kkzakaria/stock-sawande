import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { SettingsTabs } from '@/components/settings/settings-tabs'
import { Settings } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface SettingsPageProps {
  params: Promise<{ locale: string }>
}

export default async function SettingsPage({ params }: SettingsPageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('Settings')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Get user profile with stores
  const { data: profile } = await supabase
    .from('profiles')
    .select('*, stores(*)')
    .eq('id', user.id)
    .single()

  if (!profile) {
    redirect('/auth/login')
  }

  const isAdmin = profile.role === 'admin'
  const isManager = ['admin', 'manager'].includes(profile.role)

  // Only admins and managers can access settings
  if (!isManager) {
    redirect('/dashboard')
  }

  // Fetch data based on role
  let users = null
  let stores = null
  let businessSettings = null

  if (isAdmin) {
    // Admin: fetch all users with store assignments
    const { data: usersData } = await supabase
      .from('profiles')
      .select(`
        *,
        user_stores (
          id,
          store_id,
          is_default,
          stores (
            id,
            name
          )
        )
      `)
      .order('created_at', { ascending: false })

    users = usersData

    // Fetch all stores
    const { data: storesData } = await supabase
      .from('stores')
      .select('*')
      .order('name')

    stores = storesData

    // Fetch business settings
    const { data: settingsData } = await supabase
      .from('business_settings')
      .select('key, value')

    if (settingsData) {
      const settingsMap: Record<string, unknown> = {}
      settingsData.forEach((setting) => {
        settingsMap[setting.key] = setting.value
      })

      businessSettings = {
        tax_rate: (settingsMap.tax_rate as { rate: number; enabled: boolean }) || {
          rate: 0.0875,
          enabled: true,
        },
        currency: (settingsMap.currency as {
          code: string
          locale: string
          symbol: string
          fractionDigits?: number
        }) || {
          code: 'XOF',
          locale: 'fr-FR',
          symbol: 'CFA',
          fractionDigits: 0,
        },
        stock_alerts: (settingsMap.stock_alerts as {
          defaultThreshold: number
          enabled: boolean
        }) || {
          defaultThreshold: 10,
          enabled: true,
        },
      }
    }
  }

  // Admin/Manager: fetch categories
  let categories = null
  if (isManager) {
    const { data: categoriesData } = await supabase
      .from('categories')
      .select('*, product_templates(count)')
      .order('name')

    // Transform to include product count
    categories = categoriesData?.map((cat) => ({
      ...cat,
      product_count: cat.product_templates?.[0]?.count ?? 0,
    }))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-8 w-8 text-muted-foreground" />
        <div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
      </div>

      <SettingsTabs
        userRole={profile.role as 'admin' | 'manager' | 'cashier'}
        profile={profile}
        users={users || undefined}
        categories={categories || undefined}
        stores={stores || undefined}
        businessSettings={businessSettings || undefined}
      />
    </div>
  )
}
