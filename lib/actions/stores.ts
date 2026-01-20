'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { invalidateStoresCache } from '@/lib/server/cached-queries'

// Validation schema for store
const storeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
})

type StoreInput = z.infer<typeof storeSchema>

interface ActionResult<T = unknown> {
  success: boolean
  error?: string
  data?: T
}

/**
 * Create a new store (admin only)
 */
export async function createStore(data: StoreInput): Promise<ActionResult> {
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
      return { success: false, error: 'Only admins can create stores' }
    }

    // Validate input
    const validated = storeSchema.parse(data)

    // Create store
    const { data: store, error } = await supabase
      .from('stores')
      .insert({
        ...validated,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating store:', error)
      return { success: false, error: 'Failed to create store' }
    }

    revalidatePath('/stores')
    invalidateStoresCache()
    return { success: true, data: store }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    console.error('Error creating store:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Update an existing store (admin only)
 */
export async function updateStore(id: string, data: Partial<StoreInput>): Promise<ActionResult> {
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
      return { success: false, error: 'Only admins can update stores' }
    }

    // Validate input
    const validated = storeSchema.partial().parse(data)

    // Update store
    const { data: store, error } = await supabase
      .from('stores')
      .update(validated)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating store:', error)
      return { success: false, error: 'Failed to update store' }
    }

    revalidatePath('/stores')
    invalidateStoresCache()
    return { success: true, data: store }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    console.error('Error updating store:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Delete a store (admin only)
 */
export async function deleteStore(id: string): Promise<ActionResult> {
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
      return { success: false, error: 'Only admins can delete stores' }
    }

    // Check if store has associated data
    const { count: productCount } = await supabase
      .from('product_inventory')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', id)

    if (productCount && productCount > 0) {
      return {
        success: false,
        error: 'Cannot delete store with existing inventory. Please transfer or remove products first.'
      }
    }

    // Delete store
    const { error } = await supabase
      .from('stores')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting store:', error)
      return { success: false, error: 'Failed to delete store' }
    }

    revalidatePath('/stores')
    invalidateStoresCache()
    return { success: true }
  } catch (error) {
    console.error('Error deleting store:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}
