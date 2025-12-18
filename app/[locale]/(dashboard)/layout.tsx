import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { DashboardNav } from '@/components/dashboard/dashboard-nav'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { BottomNav } from '@/components/layout/bottom-nav'
import { buildLoginUrl } from '@/lib/auth/redirect'

// Force dynamic rendering to always fetch fresh profile data
export const dynamic = 'force-dynamic'
export const revalidate = 0

interface DashboardLayoutProps {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default async function DashboardLayout({
  children,
  params,
}: DashboardLayoutProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    // Get the current URL to redirect back after login
    const headersList = await headers()
    const pathname = headersList.get('x-pathname') || headersList.get('x-invoke-path') || '/dashboard'
    const searchParams = headersList.get('x-search-params') || ''
    const currentUrl = searchParams ? `${pathname}?${searchParams}` : pathname

    // Build login URL with redirect parameter
    const loginUrl = buildLoginUrl(currentUrl)
    redirect(loginUrl)
  }

  // Get user profile with role (no cache to reflect role changes immediately)
  const { data: profile } = await supabase
    .from('profiles')
    .select('*, stores(*)')
    .eq('id', user.id)
    .single()

  // Get navigation translations for client component
  const t = await getTranslations('Navigation')
  const navTranslations = {
    dashboard: t('dashboard'),
    products: t('products'),
    customers: t('customers'),
    sales: t('sales'),
    proformas: t('proformas'),
    pos: t('pos'),
    reports: t('reports'),
    stores: t('stores'),
    settings: t('settings'),
    more: t('more'),
    logout: t('logout'),
    menu: t('menu'),
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar - hidden on mobile */}
      <DashboardNav profile={profile} translations={navTranslations} />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <DashboardHeader user={user} profile={profile} />

        {/* Page content - add bottom padding on mobile for nav */}
        <main className="flex-1 p-6 pb-20 md:pb-6 bg-muted/40 overflow-auto">{children}</main>
      </div>

      {/* Bottom nav - mobile only */}
      <BottomNav profile={profile} translations={navTranslations} />
    </div>
  )
}
