import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardNav } from '@/components/dashboard/dashboard-nav'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'

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
    redirect('/login')
  }

  // Get user profile with role
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
