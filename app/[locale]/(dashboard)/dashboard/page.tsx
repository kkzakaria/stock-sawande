import { DashboardClient } from '@/components/dashboard'
import { getAuthenticatedProfile } from '@/lib/server/cached-queries'
import { getAllDashboardData } from '@/lib/actions/dashboard'

export default async function DashboardPage() {
  // Use cached profile (deduplicated with layout)
  const { profile } = await getAuthenticatedProfile()

  // Determine store context based on role
  const storeId = profile?.role === 'admin' ? undefined : (profile?.store_id ?? undefined)
  const storeName = profile?.role === 'admin'
    ? undefined
    : profile?.stores?.name ?? undefined

  // Fetch all dashboard data server-side in a single request
  // React.cache() deduplicates the auth calls across all 4 queries
  const initialData = await getAllDashboardData(storeId)

  return (
    <DashboardClient
      storeId={storeId}
      storeName={storeName}
      initialData={initialData}
    />
  )
}
