import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { DashboardNav } from '@/components/dashboard/dashboard-nav'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { buildLoginUrl } from '@/lib/auth/redirect'

// Force dynamic rendering to always fetch fresh profile data
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
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

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <DashboardNav profile={profile} />

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <DashboardHeader user={user} profile={profile} />

        {/* Page content */}
        <main className="flex-1 p-6 bg-muted/40">{children}</main>
      </div>
    </div>
  )
}
