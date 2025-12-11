'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// Validation schema for user update
const userUpdateSchema = z.object({
  full_name: z.string().min(1, 'Name is required').optional(),
  role: z.enum(['admin', 'manager', 'cashier']).optional(),
})

// UUID regex that accepts any UUID format (not just RFC 4122 compliant)
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Validation schema for store assignments (simple version - normalization done before validation)
const storeAssignmentSchema = z.object({
  store_ids: z.array(z.string().regex(uuidRegex, 'Invalid UUID')),
  default_store_id: z.string().regex(uuidRegex, 'Invalid UUID').optional(),
})

type UserUpdateInput = z.infer<typeof userUpdateSchema>
type StoreAssignmentInput = z.infer<typeof storeAssignmentSchema>

interface ActionResult<T = unknown> {
  success: boolean
  error?: string
  data?: T
}

/**
 * Get all users with their store assignments (admin only)
 */
export async function getUsers(filters?: {
  search?: string
  role?: string
  includeDeleted?: boolean
}): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    // Verify user is admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return { success: false, error: 'Only admins can view all users' }
    }

    // Build query
    let query = supabase
      .from('profiles')
      .select(`
        *,
        user_stores (
          id,
          store_id,
          is_default,
          stores (
            id,
            name
          )
        )
      `)
      .order('created_at', { ascending: false })

    // Filter deleted users by default (only show active users)
    if (!filters?.includeDeleted) {
      query = query.is('deleted_at', null)
    }

    // Apply filters
    if (filters?.search) {
      query = query.or(`email.ilike.%${filters.search}%,full_name.ilike.%${filters.search}%`)
    }

    if (filters?.role && filters.role !== 'all') {
      query = query.eq('role', filters.role as 'admin' | 'manager' | 'cashier')
    }

    const { data: users, error } = await query

    if (error) {
      console.error('Error fetching users:', error)
      return { success: false, error: 'Failed to fetch users' }
    }

    return { success: true, data: users }
  } catch (error) {
    console.error('Error fetching users:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Get a single user by ID (admin only)
 */
export async function getUser(userId: string): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    // Verify user is admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return { success: false, error: 'Only admins can view user details' }
    }

    const { data: targetUser, error } = await supabase
      .from('profiles')
      .select(`
        *,
        user_stores (
          id,
          store_id,
          is_default,
          stores (
            id,
            name
          )
        )
      `)
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Error fetching user:', error)
      return { success: false, error: 'Failed to fetch user' }
    }

    return { success: true, data: targetUser }
  } catch (error) {
    console.error('Error fetching user:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Update a user's profile and role (admin only)
 */
export async function updateUser(userId: string, data: UserUpdateInput): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    // Verify user is admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return { success: false, error: 'Only admins can update users' }
    }

    // Prevent admin from demoting themselves
    if (userId === user.id && data.role && data.role !== 'admin') {
      return { success: false, error: 'You cannot change your own role' }
    }

    // Validate input
    const validated = userUpdateSchema.parse(data)

    // Update profile
    const { data: updatedUser, error } = await supabase
      .from('profiles')
      .update(validated)
      .eq('id', userId)
      .select()
      .single()

    if (error) {
      console.error('Error updating user:', error)
      return { success: false, error: 'Failed to update user' }
    }

    revalidatePath('/settings')
    return { success: true, data: updatedUser }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    console.error('Error updating user:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Update a user's store assignments (admin only)
 */
export async function updateUserStores(userId: string, data: StoreAssignmentInput): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    // Verify user is admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return { success: false, error: 'Only admins can update store assignments' }
    }

    // Normalize the input data to ensure arrays are properly formed
    const normalizedStoreIds = Array.isArray(data.store_ids)
      ? data.store_ids.filter((id): id is string => typeof id === 'string' && id.trim() !== '')
      : []
    const normalizedDefaultStoreId = typeof data.default_store_id === 'string' && data.default_store_id.trim() !== ''
      ? data.default_store_id
      : undefined

    // UUID validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    for (const storeId of normalizedStoreIds) {
      if (!uuidRegex.test(storeId)) {
        return { success: false, error: 'Invalid store ID format' }
      }
    }
    if (normalizedDefaultStoreId && !uuidRegex.test(normalizedDefaultStoreId)) {
      return { success: false, error: 'Invalid default store ID format' }
    }

    const validated = {
      store_ids: normalizedStoreIds,
      default_store_id: normalizedDefaultStoreId,
    }

    // Delete existing store assignments
    const { error: deleteError } = await supabase
      .from('user_stores')
      .delete()
      .eq('user_id', userId)

    if (deleteError) {
      console.error('Error deleting store assignments:', deleteError)
      return { success: false, error: 'Failed to update store assignments' }
    }

    // Insert new store assignments
    if (validated.store_ids.length > 0) {
      const assignments = validated.store_ids.map((storeId) => ({
        user_id: userId,
        store_id: storeId,
        is_default: storeId === validated.default_store_id,
      }))

      const { error: insertError } = await supabase
        .from('user_stores')
        .insert(assignments)

      if (insertError) {
        console.error('Error inserting store assignments:', insertError)
        return { success: false, error: 'Failed to update store assignments' }
      }
    }

    // Update the user's current store_id to the default store
    if (validated.default_store_id) {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ store_id: validated.default_store_id })
        .eq('id', userId)

      if (updateError) {
        console.error('Error updating user store:', updateError)
        // Don't fail the whole operation for this
      }
    }

    revalidatePath('/settings')
    return { success: true }
  } catch (error) {
    console.error('Error updating store assignments:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Soft delete a user (admin only)
 * Uses soft_delete_user() database function to preserve sales/session history
 */
export async function deleteUser(userId: string): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    // Verify user is admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Check if user has open cash sessions before soft delete
    const { count: sessionCount } = await supabase
      .from('cash_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('cashier_id', userId)
      .is('closed_at', null)

    if (sessionCount && sessionCount > 0) {
      return { success: false, error: 'Cannot delete user with open cash sessions' }
    }

    // Call the soft_delete_user database function
    const { data, error } = await supabase.rpc('soft_delete_user', {
      target_user_id: userId,
    })

    if (error) {
      console.error('Error soft deleting user:', error)
      return { success: false, error: 'Failed to delete user' }
    }

    // The function returns a JSONB object with success/error
    const result = data as { success: boolean; error?: string; message?: string; preserved_records?: { sales: number; cash_sessions: number } }

    if (!result.success) {
      return { success: false, error: result.error || 'Failed to delete user' }
    }

    revalidatePath('/settings')
    return { success: true, data: result }
  } catch (error) {
    console.error('Error deleting user:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Restore a soft-deleted user (admin only)
 */
export async function restoreUser(userId: string): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    // Verify user is admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Call the restore_deleted_user database function
    const { data, error } = await supabase.rpc('restore_deleted_user', {
      target_user_id: userId,
    })

    if (error) {
      console.error('Error restoring user:', error)
      return { success: false, error: 'Failed to restore user' }
    }

    // The function returns a JSONB object with success/error
    const result = data as { success: boolean; error?: string; message?: string }

    if (!result.success) {
      return { success: false, error: result.error || 'Failed to restore user' }
    }

    revalidatePath('/settings')
    return { success: true, data: result }
  } catch (error) {
    console.error('Error restoring user:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}
