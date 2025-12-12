import { createClient } from '@/lib/supabase/server'
import { ProformasClient } from '@/components/proformas/proformas-client'

// Disable caching for role checks
export const dynamic = 'force-dynamic'

export default async function ProformasPage() {
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
    <ProformasClient
      userStoreId={profile?.store_id}
      userRole={profile?.role as 'admin' | 'manager' | 'cashier'}
      userId={user!.id}
    />
  )
}
