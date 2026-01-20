import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// === TYPES ===
export interface CachedProfile {
  id: string
  email: string | null
  role: 'admin' | 'manager' | 'cashier'
  store_id: string | null
  full_name: string | null
  avatar_url: string | null
  preferred_language: string | null
  stores: { id: string; name: string } | null
}

// === CACHE TAGS ===
export const CACHE_TAGS = {
  stores: 'stores',
  categories: 'categories',
  businessSettings: 'business-settings',
} as const

// === REQUEST-SCOPED CACHE (React.cache) ===

// Deduplicate profile queries within the same HTTP request
export const getCachedProfile = cache(async (userId: string): Promise<CachedProfile | null> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('id, email, role, store_id, full_name, avatar_url, preferred_language, stores(id, name)')
    .eq('id', userId)
    .single()
  return data as CachedProfile | null
})

export const getCachedUser = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})

// Combined helper for auth + profile
export const getAuthenticatedProfile = cache(async () => {
  const user = await getCachedUser()
  if (!user) return { user: null, profile: null }
  const profile = await getCachedProfile(user.id)
  return { user, profile }
})

// === TIME-BASED CACHE (unstable_cache) ===

// Stores - cache 5 minutes
export const getCachedStores = unstable_cache(
  async () => {
    const supabase = await createClient()
    const { data } = await supabase
      .from('stores')
      .select('id, name, address, phone')
      .order('name')
    return data ?? []
  },
  ['stores-list'],
  { tags: [CACHE_TAGS.stores], revalidate: 300 }
)

// Categories - cache 5 minutes
export const getCachedCategories = unstable_cache(
  async () => {
    const supabase = await createClient()
    const { data } = await supabase
      .from('categories')
      .select('id, name, description')
      .order('name')
    return data ?? []
  },
  ['categories-list'],
  { tags: [CACHE_TAGS.categories], revalidate: 300 }
)

// Store count - cache 2 minutes
export const getCachedStoreCount = unstable_cache(
  async () => {
    const supabase = await createClient()
    const { count } = await supabase
      .from('stores')
      .select('*', { count: 'exact', head: true })
    return count ?? 0
  },
  ['store-count'],
  { tags: [CACHE_TAGS.stores], revalidate: 120 }
)

// === INVALIDATION HELPERS ===
// Note: Next.js 16 revalidateTag requires a second argument (profile or config)
export const invalidateStoresCache = () => revalidateTag(CACHE_TAGS.stores, {})
export const invalidateCategoriesCache = () => revalidateTag(CACHE_TAGS.categories, {})
export const invalidateBusinessSettingsCache = () => revalidateTag(CACHE_TAGS.businessSettings, {})
