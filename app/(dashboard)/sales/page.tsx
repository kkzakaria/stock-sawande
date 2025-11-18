import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getStores } from '@/lib/actions/products'
import { SalesClient } from '@/components/sales/sales-client'

// Disable caching for role checks
export const dynamic = 'force-dynamic'

interface SalesPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function SalesPage({ searchParams }: SalesPageProps) {
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

  // Only admin and manager can access sales
  if (!['admin', 'manager'].includes(profile?.role || '')) {
    redirect('/dashboard')
  }

  // Parse search params (for future use when sales data is implemented)
  const params = await searchParams
  // These will be used when sales data is available in Phase 4
  const _status = ['completed', 'refunded', 'pending'].includes(params.status as string)
    ? (params.status as 'completed' | 'refunded' | 'pending')
    : undefined
  const _sortBy = ['created_at', 'total_amount', 'invoice_number'].includes(params.sortBy as string)
    ? (params.sortBy as 'created_at' | 'total_amount' | 'invoice_number')
    : 'created_at'

  // Fetch stores for filter dropdown
  const { data: stores } = await getStores()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Sales</h2>
        <p className="text-muted-foreground">
          View and manage all sales transactions
        </p>
      </div>

      <SalesClient stores={stores || []} />
    </div>
  )
}
