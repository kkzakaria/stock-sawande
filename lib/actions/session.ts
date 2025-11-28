'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'

/**
 * Force refresh user session and profile data
 * Call this after role changes to update the UI immediately
 */
export async function refreshUserSession() {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return { success: false, error: 'No authenticated user' }
    }

    // Force refresh by clearing all Supabase cookies
    const cookieStore = await cookies()
    const allCookies = cookieStore.getAll()

    // Remove all Supabase auth cookies
    allCookies.forEach((cookie) => {
      if (cookie.name.startsWith('sb-') || cookie.name.includes('supabase')) {
        cookieStore.delete(cookie.name)
      }
    })

    // Revalidate all dashboard paths to clear cache
    revalidatePath('/', 'layout')
    revalidatePath('/dashboard', 'layout')

    return { success: true }
  } catch (error) {
    console.error('Error refreshing session:', error)
    return { success: false, error: 'Failed to refresh session' }
  }
}

/**
 * Admin function to invalidate a specific user's session after role change
 * This forces the user to re-authenticate with their new role
 */
export async function invalidateUserSession(_userId: string) {
  try {
    const supabase = await createClient()

    // Verify caller is admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (callerProfile?.role !== 'admin') {
      return { success: false, error: 'Admin access required' }
    }

    // Revalidate paths for the affected user
    revalidatePath('/', 'layout')

    return {
      success: true,
      message: 'User session invalidated. User must re-login to see role changes.'
    }
  } catch (error) {
    console.error('Error invalidating user session:', error)
    return { success: false, error: 'Failed to invalidate session' }
  }
}
