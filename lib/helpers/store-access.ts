import type { createClient } from '@/lib/supabase/server'

/**
 * Get the user's default store ID from user_stores (is_default=true).
 * Falls back to first accessible store, then profiles.store_id.
 */
export async function getUserDefaultStoreId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  accessibleStoreIds: string[],
  profileStoreId?: string | null
): Promise<string | null> {
  const { data: defaultStore, error } = await supabase
    .from('user_stores')
    .select('store_id')
    .eq('user_id', userId)
    .eq('is_default', true)
    .maybeSingle()

  if (error) {
    console.error('Failed to fetch default store:', error, { userId })
  }

  return defaultStore?.store_id ?? accessibleStoreIds[0] ?? profileStoreId ?? null
}

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
 * Fetch both the user's accessible store IDs and their default store ID
 * in a single query. Preferable to calling getUserAccessibleStoreIds +
 * getUserDefaultStoreId sequentially when both pieces are needed.
 */
export async function getUserStoresAccess(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  profileStoreId?: string | null
): Promise<{ accessibleStoreIds: string[]; defaultStoreId: string | null }> {
  const { data: userStores, error } = await supabase
    .from('user_stores')
    .select('store_id, is_default')
    .eq('user_id', userId)

  if (error) {
    console.error('Failed to fetch user store assignments:', error, { userId })
    return {
      accessibleStoreIds: profileStoreId ? [profileStoreId] : [],
      defaultStoreId: profileStoreId ?? null,
    }
  }

  const rows = userStores ?? []
  const accessibleStoreIds = rows
    .map((row) => row.store_id)
    .filter((id): id is string => Boolean(id))

  const defaultFromUserStores =
    rows.find((row) => row.is_default && row.store_id)?.store_id ?? null

  if (accessibleStoreIds.length === 0 && profileStoreId) {
    return {
      accessibleStoreIds: [profileStoreId],
      defaultStoreId: profileStoreId,
    }
  }

  return {
    accessibleStoreIds,
    defaultStoreId:
      defaultFromUserStores ?? accessibleStoreIds[0] ?? profileStoreId ?? null,
  }
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

  const rawStoreIds = userStores?.map(us => us.store_id) ?? []
  const nullCount = rawStoreIds.filter(id => !id).length
  if (nullCount > 0) {
    console.warn('user_stores contains null store_id rows:', { userId, nullCount })
  }
  const storeIds = rawStoreIds.filter((id): id is string => Boolean(id))

  // Fallback: if user_stores is empty but profiles.store_id exists
  if (storeIds.length === 0 && profileStoreId) {
    return [profileStoreId]
  }

  return storeIds
}
