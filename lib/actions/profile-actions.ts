'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// Validation schema for store update
const updateStoreSchema = z.object({
  storeId: z.string().uuid('Invalid store ID'),
})

type UpdateStoreInput = z.infer<typeof updateStoreSchema>

interface ActionResult<T = unknown> {
  success: boolean
  error?: string
  data?: T
}

/**
 * Update user's assigned store (admin and manager only)
 * Validates that no cash session is open before allowing the change
 */
export async function updateUserStore(
  data: UpdateStoreInput
): Promise<ActionResult<{ success: true }>> {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Get user profile with role
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role, store_id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return { success: false, error: 'Profile not found' }
    }

    // Only admins and managers can update store
    if (profile.role !== 'admin' && profile.role !== 'manager') {
      return {
        success: false,
        error: 'Only administrators and managers can change stores',
      }
    }

    // Validate input
    const validated = updateStoreSchema.parse(data)

    // For managers: verify the store is in their assigned stores
    if (profile.role === 'manager') {
      const { data: assignedStore } = await supabase
        .from('user_stores')
        .select('store_id')
        .eq('user_id', user.id)
        .eq('store_id', validated.storeId)
        .maybeSingle()

      if (!assignedStore) {
        return {
          success: false,
          error: 'You are not assigned to this store. Contact an administrator.',
        }
      }
    }

    // Verify the store exists
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('id, name')
      .eq('id', validated.storeId)
      .single()

    if (storeError || !store) {
      return { success: false, error: 'Store not found' }
    }

    // CRITICAL: Check if user has an open cash session
    const { data: openSession } = await supabase
      .from('cash_sessions')
      .select('id, status')
      .eq('cashier_id', user.id)
      .eq('status', 'open')
      .maybeSingle()

    if (openSession) {
      return {
        success: false,
        error:
          'Cannot change store with an open cash session. Please close your session first.',
      }
    }

    // Update user's store_id
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ store_id: validated.storeId })
      .eq('id', user.id)

    if (updateError) {
      console.error('Error updating store:', updateError)
      return { success: false, error: 'Failed to update store' }
    }

    // Revalidate relevant paths
    revalidatePath('/pos')
    revalidatePath('/dashboard')

    return {
      success: true,
      data: { success: true },
    }
  } catch (error) {
    console.error('Error in updateUserStore:', error)
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    return { success: false, error: 'Failed to update store' }
  }
}
