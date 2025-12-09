'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// Validation schema for profile update
const profileSchema = z.object({
  full_name: z.string().min(1, 'Name is required').optional(),
  avatar_url: z.string().url('Invalid URL').optional().or(z.literal('')),
})

type ProfileInput = z.infer<typeof profileSchema>

interface ActionResult<T = unknown> {
  success: boolean
  error?: string
  data?: T
}

/**
 * Get current user's profile
 */
export async function getCurrentProfile(): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*, stores(*)')
      .eq('id', user.id)
      .single()

    if (error) {
      console.error('Error fetching profile:', error)
      return { success: false, error: 'Failed to fetch profile' }
    }

    return { success: true, data: profile }
  } catch (error) {
    console.error('Error fetching profile:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Update current user's profile
 */
export async function updateProfile(data: ProfileInput): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Validate input
    const validated = profileSchema.parse(data)

    // Clean up empty strings
    const updateData: Record<string, string | null> = {}
    if (validated.full_name !== undefined) {
      updateData.full_name = validated.full_name || null
    }
    if (validated.avatar_url !== undefined) {
      updateData.avatar_url = validated.avatar_url || null
    }

    // Update profile
    const { data: profile, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating profile:', error)
      return { success: false, error: 'Failed to update profile' }
    }

    revalidatePath('/settings')
    return { success: true, data: profile }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    console.error('Error updating profile:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Update user's preferred language
 */
export async function updateLanguage(language: string): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Validate language
    if (!['fr', 'en'].includes(language)) {
      return { success: false, error: 'Invalid language' }
    }

    // Update profile
    const { data: profile, error } = await supabase
      .from('profiles')
      .update({ preferred_language: language })
      .eq('id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating language:', error)
      return { success: false, error: 'Failed to update language' }
    }

    revalidatePath('/settings')
    return { success: true, data: profile }
  } catch (error) {
    console.error('Error updating language:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}
