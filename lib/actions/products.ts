'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// Validation schema for product template
const productTemplateSchema = z.object({
  sku: z.string().min(1, 'SKU is required'),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  category_id: z.string().uuid('Invalid category').nullable(),
  price: z.number().min(0, 'Price must be positive'),
  cost: z.number().min(0, 'Cost must be positive').optional(),
  min_stock_level: z.number().int().min(0, 'Min stock level must be non-negative').default(10),
  image_url: z.string().url().optional().or(z.literal('')),
  barcode: z.string().optional(),
  is_active: z.boolean().default(true),
})

// Validation schema for inventory
const inventorySchema = z.object({
  product_id: z.string().uuid(),
  store_id: z.string().uuid('Invalid store'),
  quantity: z.number().int().min(0, 'Quantity must be non-negative'),
})

// Combined schema for product creation
const productSchema = productTemplateSchema.extend({
  store_id: z.string().uuid('Invalid store'),
  quantity: z.number().int().min(0, 'Quantity must be non-negative'),
})

type ProductInput = z.infer<typeof productSchema>
type ProductTemplateInput = z.infer<typeof productTemplateSchema>

interface ActionResult<T = unknown> {
  success: boolean
  error?: string
  data?: T
}

/**
 * Create a new product (template + inventory)
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
      .from('product_templates')
      .select('id')
      .eq('sku', validated.sku)
      .maybeSingle()

    if (existing) {
      return { success: false, error: 'Product with this SKU already exists' }
    }

    // Extract template and inventory data
    const { store_id, quantity, ...templateData } = validated

    // Create product template
    const { data: template, error: templateError } = await supabase
      .from('product_templates')
      .insert(templateData)
      .select()
      .single()

    if (templateError) {
      console.error('Error creating product template:', templateError)
      return { success: false, error: templateError.message }
    }

    // Create inventory for the store
    const { data: inventory, error: inventoryError } = await supabase
      .from('product_inventory')
      .insert({
        product_id: template.id,
        store_id: store_id,
        quantity: quantity,
      })
      .select()
      .single()

    if (inventoryError) {
      console.error('Error creating inventory:', inventoryError)
      // Rollback template creation
      await supabase.from('product_templates').delete().eq('id', template.id)
      return { success: false, error: inventoryError.message }
    }

    revalidatePath('/products')
    return {
      success: true,
      data: {
        ...template,
        inventory_id: inventory.id,
        store_id: store_id,
        quantity: quantity
      }
    }
  } catch (error) {
    console.error('Product creation error:', error)
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    return { success: false, error: 'Failed to create product' }
  }
}

/**
 * Update an existing product (template and/or inventory)
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

    // Separate template and inventory updates
    const { store_id, quantity, ...templateUpdates } = data

    // Update product template if there are template fields
    if (Object.keys(templateUpdates).length > 0) {
      // Check for duplicate SKU if SKU is being changed
      if (templateUpdates.sku) {
        const { data: existing } = await supabase
          .from('product_templates')
          .select('sku')
          .eq('id', id)
          .single()

        if (existing && templateUpdates.sku !== existing.sku) {
          const { data: duplicate } = await supabase
            .from('product_templates')
            .select('id')
            .eq('sku', templateUpdates.sku)
            .neq('id', id)
            .maybeSingle()

          if (duplicate) {
            return { success: false, error: 'Product with this SKU already exists' }
          }
        }
      }

      const { error: templateError } = await supabase
        .from('product_templates')
        .update(templateUpdates)
        .eq('id', id)

      if (templateError) {
        console.error('Error updating product template:', templateError)
        return { success: false, error: templateError.message }
      }
    }

    // Update inventory if quantity or store_id is provided
    if (quantity !== undefined && store_id) {
      // Check if user has permission for this store
      if (profile.role === 'manager' && store_id !== profile.store_id) {
        return { success: false, error: 'You can only update inventory in your assigned store' }
      }

      const { error: inventoryError } = await supabase
        .from('product_inventory')
        .update({ quantity })
        .eq('product_id', id)
        .eq('store_id', store_id)

      if (inventoryError) {
        console.error('Error updating inventory:', inventoryError)
        return { success: false, error: inventoryError.message }
      }
    }

    revalidatePath('/products')
    revalidatePath(`/products/${id}`)
    return { success: true }
  } catch (error) {
    console.error('Product update error:', error)
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    return { success: false, error: 'Failed to update product' }
  }
}

/**
 * Delete a product template (cascades to inventory)
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

    // Delete product template (cascades to inventory)
    const { error } = await supabase
      .from('product_templates')
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

    // Use the products_with_inventory view
    let query = supabase
      .from('products_with_inventory')
      .select('*', { count: 'exact' })

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
    const sortBy = filters.sortBy || 'name'
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
 * Get a single product with its inventory
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

    // Get product template
    const { data: template, error: templateError } = await supabase
      .from('product_templates')
      .select('*')
      .eq('id', id)
      .single()

    if (templateError || !template) {
      console.error('Error fetching product template:', templateError)
      return { success: false, error: 'Product not found', data: null }
    }

    // Get inventory for user's store (or all stores for admin)
    let inventoryQuery = supabase
      .from('product_inventory')
      .select('*')
      .eq('product_id', id)

    if (profile.role !== 'admin' && profile.store_id) {
      inventoryQuery = inventoryQuery.eq('store_id', profile.store_id)
    }

    const { data: inventories } = await inventoryQuery

    // Get category
    let category = null
    if (template.category_id) {
      const { data: categoryData } = await supabase
        .from('categories')
        .select('id, name')
        .eq('id', template.category_id)
        .single()
      category = categoryData
    }

    // Get store info for inventory
    const storeIds = inventories?.map(inv => inv.store_id) || []
    let stores: Array<{ id: string; name: string }> = []
    if (storeIds.length > 0) {
      const { data: storesData } = await supabase
        .from('stores')
        .select('id, name')
        .in('id', storeIds)
      stores = storesData || []
    }

    // For non-admin users, get primary inventory (their store)
    const primaryInventory = inventories && inventories.length > 0 ? inventories[0] : null
    const primaryStore = primaryInventory ? stores.find(s => s.id === primaryInventory.store_id) : null

    // Combine data in both old and new format for compatibility
    const productWithRelations = {
      ...template,
      template_id: template.id, // New format
      quantity: primaryInventory?.quantity || 0,
      store_id: primaryInventory?.store_id || null,
      inventory_id: primaryInventory?.id || null,
      category_name: category?.name || null, // New format
      store_name: primaryStore?.name || null, // New format
      categories: category, // Old format for compatibility
      stores: primaryStore, // Old format for compatibility
      all_inventories: inventories, // Include all inventories for admin
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
 * Update product quantity for a specific store
 */
export async function updateProductQuantity(
  productId: string,
  storeId: string,
  newQuantity: number
): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Update inventory
    const { error } = await supabase
      .from('product_inventory')
      .update({ quantity: newQuantity })
      .eq('product_id', productId)
      .eq('store_id', storeId)

    if (error) {
      console.error('Error updating quantity:', error)
      return { success: false, error: error.message }
    }

    revalidatePath(`/products/${productId}`)
    revalidatePath('/products')

    return { success: true, data: { newQuantity } }
  } catch (error) {
    console.error('Update quantity error:', error)
    return { success: false, error: 'Failed to update quantity' }
  }
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
  storeId: string,
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

    // Get current inventory
    const { data: inventory } = await supabase
      .from('product_inventory')
      .select('id, quantity')
      .eq('product_id', productId)
      .eq('store_id', storeId)
      .single()

    if (!inventory) {
      return { success: false, error: 'Inventory not found' }
    }

    // Verify access
    if (profile.role !== 'admin' && storeId !== profile.store_id) {
      return { success: false, error: 'Access denied to this store inventory' }
    }

    const newQuantity = inventory.quantity + adjustment

    // Validate new quantity
    if (newQuantity < 0) {
      return { success: false, error: 'Quantity cannot be negative' }
    }

    // Update inventory quantity
    const { error: updateError } = await supabase
      .from('product_inventory')
      .update({ quantity: newQuantity })
      .eq('id', inventory.id)

    if (updateError) {
      console.error('Error adjusting quantity:', updateError)
      return { success: false, error: updateError.message }
    }

    // Create stock movement with custom reason
    const { error: movementError } = await supabase
      .from('stock_movements')
      .insert({
        product_id: productId,
        store_id: storeId,
        inventory_id: inventory.id,
        user_id: user.id,
        type: 'adjustment' as const,
        quantity: adjustment,
        previous_quantity: inventory.quantity,
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
 * Duplicate a product template and optionally create inventory
 */
export async function duplicateProduct(productId: string, createInventory: boolean = true): Promise<ActionResult> {
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

    // Get original product template
    const { data: original, error: fetchError } = await supabase
      .from('product_templates')
      .select('*')
      .eq('id', productId)
      .single()

    if (fetchError || !original) {
      return { success: false, error: 'Product not found' }
    }

    // Generate new SKU
    let newSku = `${original.sku}-COPY`
    let counter = 1

    while (true) {
      const { data: existing } = await supabase
        .from('product_templates')
        .select('id')
        .eq('sku', newSku)
        .maybeSingle()

      if (!existing) break

      counter++
      newSku = `${original.sku}-COPY${counter}`
    }

    // Create duplicate template
    const duplicateData = {
      sku: newSku,
      name: `${original.name} (Copy)`,
      description: original.description,
      category_id: original.category_id,
      price: original.price,
      cost: original.cost,
      min_stock_level: original.min_stock_level,
      image_url: original.image_url,
      barcode: null, // Don't copy barcode
      is_active: false, // Start as inactive
    }

    const { data: duplicate, error: createError } = await supabase
      .from('product_templates')
      .insert(duplicateData)
      .select()
      .single()

    if (createError) {
      console.error('Error duplicating product:', createError)
      return { success: false, error: createError.message }
    }

    // Optionally create inventory for user's store
    if (createInventory && profile.store_id) {
      await supabase
        .from('product_inventory')
        .insert({
          product_id: duplicate.id,
          store_id: profile.store_id,
          quantity: 0,
        })
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
