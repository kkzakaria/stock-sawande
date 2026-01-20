'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { invalidateCategoriesCache } from '@/lib/server/cached-queries'

// Validation schema for category
const categorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
})

type CategoryInput = z.infer<typeof categorySchema>

interface ActionResult<T = unknown> {
  success: boolean
  error?: string
  data?: T
}

/**
 * Get all categories
 */
export async function getCategories(): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    // Verify user is authenticated
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Get categories with product count
    const { data: categories, error } = await supabase
      .from('categories')
      .select('*, product_templates(count)')
      .order('name')

    if (error) {
      console.error('Error fetching categories:', error)
      return { success: false, error: 'Failed to fetch categories' }
    }

    // Transform to include product count
    const categoriesWithCount = categories?.map((cat) => ({
      ...cat,
      product_count: cat.product_templates?.[0]?.count ?? 0,
    }))

    return { success: true, data: categoriesWithCount }
  } catch (error) {
    console.error('Error fetching categories:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Create a new category (admin/manager only)
 */
export async function createCategory(data: CategoryInput): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    // Verify user is admin or manager
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'manager'].includes(profile.role)) {
      return { success: false, error: 'Only admins and managers can create categories' }
    }

    // Validate input
    const validated = categorySchema.parse(data)

    // Check for duplicate name
    const { data: existing } = await supabase
      .from('categories')
      .select('id')
      .ilike('name', validated.name)
      .single()

    if (existing) {
      return { success: false, error: 'A category with this name already exists' }
    }

    // Create category
    const { data: category, error } = await supabase
      .from('categories')
      .insert(validated)
      .select()
      .single()

    if (error) {
      console.error('Error creating category:', error)
      return { success: false, error: 'Failed to create category' }
    }

    revalidatePath('/settings')
    revalidatePath('/products')
    invalidateCategoriesCache()
    return { success: true, data: category }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    console.error('Error creating category:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Update an existing category (admin/manager only)
 */
export async function updateCategory(id: string, data: Partial<CategoryInput>): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    // Verify user is admin or manager
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'manager'].includes(profile.role)) {
      return { success: false, error: 'Only admins and managers can update categories' }
    }

    // Validate input
    const validated = categorySchema.partial().parse(data)

    // Check for duplicate name if name is being updated
    if (validated.name) {
      const { data: existing } = await supabase
        .from('categories')
        .select('id')
        .ilike('name', validated.name)
        .neq('id', id)
        .single()

      if (existing) {
        return { success: false, error: 'A category with this name already exists' }
      }
    }

    // Update category
    const { data: category, error } = await supabase
      .from('categories')
      .update(validated)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating category:', error)
      return { success: false, error: 'Failed to update category' }
    }

    revalidatePath('/settings')
    revalidatePath('/products')
    invalidateCategoriesCache()
    return { success: true, data: category }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    console.error('Error updating category:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Delete a category (admin/manager only)
 */
export async function deleteCategory(id: string): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    // Verify user is admin or manager
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'manager'].includes(profile.role)) {
      return { success: false, error: 'Only admins and managers can delete categories' }
    }

    // Check if category has associated products
    const { count: productCount } = await supabase
      .from('product_templates')
      .select('*', { count: 'exact', head: true })
      .eq('category_id', id)

    if (productCount && productCount > 0) {
      // Set products to uncategorized (null category_id)
      const { error: updateError } = await supabase
        .from('product_templates')
        .update({ category_id: null })
        .eq('category_id', id)

      if (updateError) {
        console.error('Error updating products:', updateError)
        return { success: false, error: 'Failed to update associated products' }
      }
    }

    // Delete category
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting category:', error)
      return { success: false, error: 'Failed to delete category' }
    }

    revalidatePath('/settings')
    revalidatePath('/products')
    invalidateCategoriesCache()
    return { success: true }
  } catch (error) {
    console.error('Error deleting category:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}
