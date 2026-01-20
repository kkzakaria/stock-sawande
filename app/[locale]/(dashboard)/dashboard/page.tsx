import { DashboardClient } from '@/components/dashboard'
import { getAuthenticatedProfile } from '@/lib/server/cached-queries'

export default async function DashboardPage() {
  // Use cached profile (deduplicated with layout)
  const { profile } = await getAuthenticatedProfile()

  // Determine store context based on role
  const storeId = profile?.role === 'admin' ? undefined : (profile?.store_id ?? undefined)
  const storeName = profile?.role === 'admin'
    ? undefined
    : profile?.stores?.name ?? undefined

  return (
    <DashboardClient
      storeId={storeId}
      storeName={storeName}
    />
  )
}
