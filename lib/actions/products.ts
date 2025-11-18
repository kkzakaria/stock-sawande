'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// Validation schema for product creation/update
const productSchema = z.object({
  sku: z.string().min(1, 'SKU is required'),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  category_id: z.string().uuid('Invalid category').nullable(),
  price: z.number().min(0, 'Price must be positive'),
  cost: z.number().min(0, 'Cost must be positive').optional(),
  quantity: z.number().int().min(0, 'Quantity must be non-negative'),
  min_stock_level: z.number().int().min(0, 'Min stock level must be non-negative').default(10),
  store_id: z.string().uuid('Invalid store'),
  image_url: z.string().url().optional().or(z.literal('')),
  barcode: z.string().optional(),
  is_active: z.boolean().default(true),
})

type ProductInput = z.infer<typeof productSchema>

interface ActionResult<T = unknown> {
  success: boolean
  error?: string
  data?: T
}

/**
 * Create a new product
 */
export async function createProduct(data: ProductInput): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    // Verify user has permission (admin or manager)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, store_id')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'manager'].includes(profile.role)) {
      return { success: false, error: 'Insufficient permissions' }
    }

    // Managers can only create products for their store
    if (profile.role === 'manager' && data.store_id !== profile.store_id) {
      return { success: false, error: 'You can only create products for your assigned store' }
    }

    // Validate input
    const validated = productSchema.parse(data)

    // Check for duplicate SKU
    const { data: existing } = await supabase
      .from('products')
      .select('id')
      .eq('sku', validated.sku)
      .maybeSingle()

    if (existing) {
      return { success: false, error: 'Product with this SKU already exists' }
    }

    // Create product
    const { data: product, error } = await supabase
      .from('products')
      .insert(validated)
      .select()
      .single()

    if (error) {
      console.error('Error creating product:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/products')
    return { success: true, data: product }
  } catch (error) {
    console.error('Product creation error:', error)
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    return { success: false, error: 'Failed to create product' }
  }
}

/**
 * Update an existing product
 */
export async function updateProduct(id: string, data: Partial<ProductInput>): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    // Verify user has permission
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, store_id')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'manager'].includes(profile.role)) {
      return { success: false, error: 'Insufficient permissions' }
    }

    // Get existing product
    const { data: existing } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single()

    if (!existing) {
      return { success: false, error: 'Product not found' }
    }

    // Managers can only update products in their store
    if (profile.role === 'manager' && existing.store_id !== profile.store_id) {
      return { success: false, error: 'You can only update products in your assigned store' }
    }

    // Check for duplicate SKU if SKU is being changed
    if (data.sku && data.sku !== existing.sku) {
      const { data: duplicate } = await supabase
        .from('products')
        .select('id')
        .eq('sku', data.sku)
        .neq('id', id)
        .maybeSingle()

      if (duplicate) {
        return { success: false, error: 'Product with this SKU already exists' }
      }
    }

    // Update product
    const { data: product, error } = await supabase
      .from('products')
      .update(data)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating product:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/products')
    revalidatePath(`/products/${id}`)
    return { success: true, data: product }
  } catch (error) {
    console.error('Product update error:', error)
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    return { success: false, error: 'Failed to update product' }
  }
}

/**
 * Delete a product
 */
export async function deleteProduct(id: string): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    // Verify user has permission
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, store_id')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'manager'].includes(profile.role)) {
      return { success: false, error: 'Insufficient permissions' }
    }

    // Get existing product
    const { data: existing } = await supabase
      .from('products')
      .select('store_id')
      .eq('id', id)
      .single()

    if (!existing) {
      return { success: false, error: 'Product not found' }
    }

    // Managers can only delete products in their store
    if (profile.role === 'manager' && existing.store_id !== profile.store_id) {
      return { success: false, error: 'You can only delete products in your assigned store' }
    }

    // Delete product
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting product:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/products')
    return { success: true }
  } catch (error) {
    console.error('Product deletion error:', error)
    return { success: false, error: 'Failed to delete product' }
  }
}

/**
 * Product filters interface
 */
interface ProductFilters {
  search?: string | null
  category?: string | null
  status?: 'active' | 'inactive' | null
  store?: string | null
  sortBy?: 'name' | 'sku' | 'price' | 'quantity' | 'created_at' | null
  sortOrder?: 'asc' | 'desc'
  page?: number
  limit?: number
}

/**
 * Get all products for the current user's store(s) with filtering, sorting, and pagination
 */
export async function getProducts(filters: ProductFilters = {}) {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated', data: [], totalCount: 0 }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, store_id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return { success: false, error: 'Profile not found', data: [], totalCount: 0 }
    }

    // Build query based on role and filters
    let query = supabase
      .from('products')
      .select(`
        *,
        categories (
          id,
          name
        ),
        stores (
          id,
          name
        )
      `, { count: 'exact' })

    // Apply role-based store filter
    if (profile.role !== 'admin' && profile.store_id) {
      query = query.eq('store_id', profile.store_id)
    }

    // Apply search filter (name or SKU)
    if (filters.search) {
      query = query.or(`name.ilike.%${filters.search}%,sku.ilike.%${filters.search}%`)
    }

    // Apply category filter
    if (filters.category) {
      query = query.eq('category_id', filters.category)
    }

    // Apply status filter
    if (filters.status === 'active') {
      query = query.eq('is_active', true)
    } else if (filters.status === 'inactive') {
      query = query.eq('is_active', false)
    }

    // Apply store filter (for admins)
    if (filters.store && profile.role === 'admin') {
      query = query.eq('store_id', filters.store)
    }

    // Apply sorting
    const sortBy = filters.sortBy || 'created_at'
    const sortOrder = filters.sortOrder || 'asc'
    query = query.order(sortBy, { ascending: sortOrder === 'asc' })

    // Apply pagination
    const page = filters.page || 1
    const limit = filters.limit || 10
    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to)

    const { data: products, error, count } = await query

    if (error) {
      console.error('Error fetching products:', error)
      return { success: false, error: error.message, data: [], totalCount: 0 }
    }

    return {
      success: true,
      data: products || [],
      totalCount: count || 0
    }
  } catch (error) {
    console.error('Get products error:', error)
    return { success: false, error: 'Failed to fetch products', data: [], totalCount: 0 }
  }
}

/**
 * Get a single product by ID
 */
export async function getProduct(id: string) {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated', data: null }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, store_id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return { success: false, error: 'Profile not found', data: null }
    }

    // First get the product
    const { data: product, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching product:', error)
      return { success: false, error: error.message || error.toString() || 'Product not found', data: null }
    }

    if (!product) {
      return { success: false, error: 'Product not found', data: null }
    }

    // Verify access based on role
    if (profile.role !== 'admin' && product.store_id !== profile.store_id) {
      return { success: false, error: 'Insufficient permissions', data: null }
    }

    // Fetch category separately if it exists
    let category = null
    if (product.category_id) {
      const { data: categoryData } = await supabase
        .from('categories')
        .select('id, name')
        .eq('id', product.category_id)
        .single()
      category = categoryData
    }

    // Fetch store separately if it exists
    let store = null
    if (product.store_id) {
      const { data: storeData } = await supabase
        .from('stores')
        .select('id, name')
        .eq('id', product.store_id)
        .single()
      store = storeData
    }

    // Combine the data
    const productWithRelations = {
      ...product,
      categories: category,
      stores: store
    }

    return { success: true, data: productWithRelations }
  } catch (error) {
    console.error('Get product error:', error)
    return { success: false, error: 'Failed to fetch product', data: null }
  }
}

/**
 * Toggle product active status
 */
export async function toggleProductStatus(id: string, isActive: boolean): Promise<ActionResult> {
  return updateProduct(id, { is_active: isActive })
}

/**
 * Update product quantity (creates stock movement automatically via trigger)
 */
export async function updateProductQuantity(
  id: string,
  newQuantity: number
): Promise<ActionResult> {
  return updateProduct(id, { quantity: newQuantity })
}

/**
 * Get all categories
 */
export async function getCategories() {
  try {
    const supabase = await createClient()

    const { data: categories, error } = await supabase
      .from('categories')
      .select('id, name')
      .order('name')

    if (error) {
      console.error('Error fetching categories:', error)
      return { success: false, error: error.message, data: [] }
    }

    return { success: true, data: categories || [] }
  } catch (error) {
    console.error('Get categories error:', error)
    return { success: false, error: 'Failed to fetch categories', data: [] }
  }
}

/**
 * Get all stores (admin) or current user's store (manager/cashier)
 */
export async function getStores() {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated', data: [] }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, store_id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return { success: false, error: 'Profile not found', data: [] }
    }

    let query = supabase
      .from('stores')
      .select('id, name')
      .order('name')

    // Non-admins only see their assigned store
    if (profile.role !== 'admin' && profile.store_id) {
      query = query.eq('id', profile.store_id)
    }

    const { data: stores, error } = await query

    if (error) {
      console.error('Error fetching stores:', error)
      return { success: false, error: error.message, data: [] }
    }

    return { success: true, data: stores || [] }
  } catch (error) {
    console.error('Get stores error:', error)
    return { success: false, error: 'Failed to fetch stores', data: [] }
  }
}

/**
 * Adjust product quantity with reason
 * Creates a stock movement of type 'adjustment'
 */
export async function adjustQuantity(
  productId: string,
  adjustment: number,
  reason: string
): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    // Verify user has permission
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, store_id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return { success: false, error: 'Profile not found' }
    }

    // Get current product
    const { data: product } = await supabase
      .from('products')
      .select('quantity, store_id')
      .eq('id', productId)
      .single()

    if (!product) {
      return { success: false, error: 'Product not found' }
    }

    // Verify access
    if (profile.role !== 'admin' && product.store_id !== profile.store_id) {
      return { success: false, error: 'Access denied to this product' }
    }

    const newQuantity = product.quantity + adjustment

    // Validate new quantity
    if (newQuantity < 0) {
      return { success: false, error: 'Quantity cannot be negative' }
    }

    // Update product quantity (this will trigger automatic stock movement creation)
    // But we'll also create a manual one with our reason
    const { error: updateError } = await supabase
      .from('products')
      .update({ quantity: newQuantity })
      .eq('id', productId)

    if (updateError) {
      console.error('Error adjusting quantity:', updateError)
      return { success: false, error: updateError.message }
    }

    // Create stock movement with custom reason
    const { error: movementError } = await supabase
      .from('stock_movements')
      .insert({
        product_id: productId,
        store_id: product.store_id!,
        user_id: user.id,
        type: 'adjustment' as const,
        quantity: adjustment,
        previous_quantity: product.quantity,
        new_quantity: newQuantity,
        notes: reason || null,
      })

    if (movementError) {
      console.error('Error creating stock movement:', movementError)
      // Don't fail the operation if movement creation fails
    }

    revalidatePath(`/products/${productId}`)
    revalidatePath('/products')

    return { success: true, data: { newQuantity } }
  } catch (error) {
    console.error('Adjust quantity error:', error)
    return { success: false, error: 'Failed to adjust quantity' }
  }
}

/**
 * Duplicate a product with a new SKU
 */
export async function duplicateProduct(productId: string): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    // Verify user has permission
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, store_id')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'manager'].includes(profile.role)) {
      return { success: false, error: 'Insufficient permissions' }
    }

    // Get original product
    const { data: original, error: fetchError } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single()

    if (fetchError || !original) {
      return { success: false, error: 'Product not found' }
    }

    // Verify access
    if (profile.role === 'manager' && original.store_id !== profile.store_id) {
      return { success: false, error: 'Access denied to this product' }
    }

    // Generate new SKU by appending -COPY and a number if needed
    let newSku = `${original.sku}-COPY`
    let counter = 1

    // Check if SKU exists and increment until we find a unique one
    while (true) {
      const { data: existing } = await supabase
        .from('products')
        .select('id')
        .eq('sku', newSku)
        .maybeSingle()

      if (!existing) {
        break
      }

      counter++
      newSku = `${original.sku}-COPY${counter}`
    }

    // Create duplicate product
    const duplicateData = {
      sku: newSku,
      name: `${original.name} (Copy)`,
      description: original.description,
      category_id: original.category_id,
      price: original.price,
      cost: original.cost,
      quantity: 0, // Start with 0 quantity for safety
      min_stock_level: original.min_stock_level,
      store_id: original.store_id,
      image_url: original.image_url,
      barcode: null, // Don't copy barcode as it should be unique
      is_active: false, // Start as inactive for review
    }

    const { data: duplicate, error: createError } = await supabase
      .from('products')
      .insert(duplicateData)
      .select()
      .single()

    if (createError) {
      console.error('Error duplicating product:', createError)
      return { success: false, error: createError.message }
    }

    revalidatePath('/products')

    return {
      success: true,
      data: duplicate
    }
  } catch (error) {
    console.error('Duplicate product error:', error)
    return { success: false, error: 'Failed to duplicate product' }
  }
}
