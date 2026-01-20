import { ProformasClient } from '@/components/proformas/proformas-client'
import { getAuthenticatedProfile } from '@/lib/server/cached-queries'
import { redirect } from 'next/navigation'

// Disable caching for role checks
export const dynamic = 'force-dynamic'

export default async function ProformasPage() {
  // Use cached profile (deduplicated with layout)
  const { user, profile } = await getAuthenticatedProfile()

  if (!user) {
    redirect('/login')
  }

  return (
    <ProformasClient
      userStoreId={profile?.store_id}
      userRole={profile?.role as 'admin' | 'manager' | 'cashier'}
      userId={user.id}
    />
  )
}
