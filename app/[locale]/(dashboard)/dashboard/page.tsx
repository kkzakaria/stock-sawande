import { createClient } from '@/lib/supabase/server'
import { DashboardClient } from '@/components/dashboard'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Get user profile with store info
  const { data: profile } = await supabase
    .from('profiles')
    .select('*, stores(*)')
    .eq('id', user!.id)
    .single()

  // Determine store context based on role
  const storeId = profile?.role === 'admin' ? undefined : (profile?.store_id ?? undefined)
  const storeName = profile?.role === 'admin'
    ? undefined
    : (profile?.stores as { name: string } | null)?.name ?? undefined

  return (
    <DashboardClient
      storeId={storeId}
      storeName={storeName}
    />
  )
}
