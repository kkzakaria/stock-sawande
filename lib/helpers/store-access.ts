import type { createClient } from '@/lib/supabase/server'

/**
 * Check if a user role + accessible stores grants access to a target store.
 * Pure function — no DB calls.
 */
export function hasStoreAccess(
  role: string,
  accessibleStoreIds: string[],
  targetStoreId: string | null | undefined
): boolean {
  if (!targetStoreId) return false
  if (role === 'admin') return true
  return accessibleStoreIds.includes(targetStoreId)
}

/**
 * Fetch all store IDs the current user can access via user_stores.
 * Falls back to profiles.store_id if user_stores is empty.
 */
export async function getUserAccessibleStoreIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  profileStoreId?: string | null
): Promise<string[]> {
  const { data: userStores, error } = await supabase
    .from('user_stores')
    .select('store_id')
    .eq('user_id', userId)

  if (error) {
    console.error('Failed to fetch user store assignments:', error, { userId })
    // Fall back to profile store_id rather than crashing
    return profileStoreId ? [profileStoreId] : []
  }

  const storeIds = userStores?.map(us => us.store_id).filter((id): id is string => Boolean(id)) ?? []

  // Fallback: if user_stores is empty but profiles.store_id exists
  if (storeIds.length === 0 && profileStoreId) {
    return [profileStoreId]
  }

  return storeIds
}
