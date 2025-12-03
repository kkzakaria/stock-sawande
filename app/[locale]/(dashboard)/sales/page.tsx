import { createClient } from '@/lib/supabase/server'
import { SalesClient } from '@/components/sales/sales-client'

// Disable caching for role checks
export const dynamic = 'force-dynamic'

export default async function SalesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Get user profile to check role and store
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, store_id')
    .eq('id', user!.id)
    .single()

  return (
    <SalesClient
      userStoreId={profile?.store_id}
      userRole={profile?.role as 'admin' | 'manager' | 'cashier'}
      userId={user!.id}
    />
  )
}
