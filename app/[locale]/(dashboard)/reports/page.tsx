import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getStores } from '@/lib/actions/products'
import { ReportsClient } from '@/components/reports/reports-client'

// Disable caching for role checks
export const dynamic = 'force-dynamic'

interface ReportsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
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

  // Only admin and manager can access reports
  if (!['admin', 'manager'].includes(profile?.role || '')) {
    redirect('/dashboard')
  }

  // searchParams available for future server-side filtering
  await searchParams

  // Fetch stores for filter dropdown
  const { data: stores } = await getStores()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Reports</h2>
        <p className="text-muted-foreground">
          Analytics and business intelligence
        </p>
      </div>

      <ReportsClient stores={stores || []} />
    </div>
  )
}
