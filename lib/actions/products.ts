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

// Combined schema for product creation (single store - for managers)
const productSchema = productTemplateSchema.extend({
  store_id: z.string().uuid('Invalid store'),
  quantity: z.number().int().min(0, 'Quantity must be non-negative'),
})

// Schema for multi-store inventory (for admins)
const storeInventorySchema = z.object({
  store_id: z.string().uuid('Invalid store'),
  quantity: z.number().int().min(0, 'Quantity must be non-negative'),
})

// Extended schema for multi-store product creation
const productMultiStoreSchema = productTemplateSchema.extend({
  store_id: z.string().uuid('Invalid store').optional(),
  quantity: z.number().int().min(0, 'Quantity must be non-negative').optional(),
  storeInventories: z.array(storeInventorySchema).optional(),
})

type ProductInput = z.infer<typeof productSchema>
type ProductMultiStoreInput = z.infer<typeof productMultiStoreSchema>

interface ActionResult<T = unknown> {
  success: boolean
  error?: string
  data?: T
}

/**
 * Create a new product (template + inventory)
 * Supports two modes:
 * - Single store: store_id + quantity (for managers)
 * - Multi-store: storeInventories[] (for admins)
 */
export async function createProduct(data: ProductMultiStoreInput): Promise<ActionResult> {
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

    // Validate input
    const validated = productMultiStoreSchema.parse(data)

    // Determine inventory mode: multi-store or single store
    const isMultiStoreMode = validated.storeInventories && validated.storeInventories.length > 0

    // Only admins can use multi-store mode
    if (isMultiStoreMode && profile.role !== 'admin') {
      return { success: false, error: 'Only admins can create products for multiple stores' }
    }

    // For single store mode, validate store access
    if (!isMultiStoreMode) {
      if (!validated.store_id || validated.quantity === undefined) {
        return { success: false, error: 'Store and quantity are required' }
      }
      // Managers can only create products for their store
      if (profile.role === 'manager' && validated.store_id !== profile.store_id) {
        return { success: false, error: 'You can only create products for your assigned store' }
      }
    }

    // Check for duplicate SKU
    const { data: existing } = await supabase
      .from('product_templates')
      .select('id')
      .eq('sku', validated.sku)
      .maybeSingle()

    if (existing) {
      return { success: false, error: 'Product with this SKU already exists' }
    }

    // Extract template data (remove inventory fields)
    const { store_id, quantity, storeInventories, ...templateData } = validated

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

    // Create inventory records
    let inventoryRecords: Array<{ product_id: string; store_id: string; quantity: number }> = []

    if (isMultiStoreMode && storeInventories) {
      // Multi-store mode: create inventory for each selected store
      inventoryRecords = storeInventories.map(inv => ({
        product_id: template.id,
        store_id: inv.store_id,
        quantity: inv.quantity,
      }))
    } else if (store_id && quantity !== undefined) {
      // Single store mode
      inventoryRecords = [{
        product_id: template.id,
        store_id: store_id,
        quantity: quantity,
      }]
    }

    if (inventoryRecords.length > 0) {
      const { error: inventoryError } = await supabase
        .from('product_inventory')
        .insert(inventoryRecords)

      if (inventoryError) {
        console.error('Error creating inventory:', inventoryError)
        // Rollback template creation
        await supabase.from('product_templates').delete().eq('id', template.id)
        return { success: false, error: inventoryError.message }
      }
    }

    revalidatePath('/products')
    return {
      success: true,
      data: {
        ...template,
        store_id: isMultiStoreMode ? null : store_id,
        quantity: isMultiStoreMode ? null : quantity,
        storeInventories: isMultiStoreMode ? storeInventories : null,
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
 * - Admins see aggregated view (total quantity across all stores)
 * - Managers see only their store's inventory
 */
export async function getProducts(filters: ProductFilters = {}) {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated', data: [], totalCount: 0, userRole: null }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, store_id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return { success: false, error: 'Profile not found', data: [], totalCount: 0, userRole: null }
    }

    const isAdmin = profile.role === 'admin'
    const userRole = profile.role

    // For non-admin users with a store, fetch products with both their store's quantity and totals
    // RLS now allows reading all inventory, so we can see true totals
    if (!isAdmin && profile.store_id) {
      // Get aggregated totals from the view (now accessible thanks to updated RLS)
      const { data: aggregatedProducts, error: aggError } = await (supabase.from as (table: string) => ReturnType<typeof supabase.from>)('products_aggregated')
        .select('*')

      if (aggError) {
        console.error('Error fetching aggregated products:', aggError)
        return { success: false, error: aggError.message, data: [], totalCount: 0, userRole }
      }

      // Get this store's inventory
      const { data: storeInventory, error: invError } = await supabase
        .from('product_inventory')
        .select('product_id, quantity')
        .eq('store_id', profile.store_id)

      if (invError) {
        console.error('Error fetching store inventory:', invError)
        return { success: false, error: invError.message, data: [], totalCount: 0, userRole }
      }

      // Create a map of product_id -> my_quantity
      const myInventoryMap = new Map<string, number>()
      for (const inv of storeInventory || []) {
        myInventoryMap.set(inv.product_id, inv.quantity)
      }

      // Merge the data: add my_quantity to each aggregated product
      const rpcProducts = (aggregatedProducts || []).map((p: Record<string, unknown>) => ({
        ...p,
        my_quantity: myInventoryMap.get(p.template_id as string) ?? 0,
      })).filter((p: Record<string, unknown>) =>
        // Only show products that exist in this store OR have inventory somewhere
        myInventoryMap.has(p.template_id as string) || (p.total_quantity as number) > 0
      )

      // Apply client-side filtering and pagination for RPC results
      let filteredProducts = rpcProducts || []

      // Apply search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase()
        filteredProducts = filteredProducts.filter((p: Record<string, unknown>) =>
          (p.name as string)?.toLowerCase().includes(searchLower) ||
          (p.sku as string)?.toLowerCase().includes(searchLower)
        )
      }

      // Apply category filter
      if (filters.category) {
        filteredProducts = filteredProducts.filter((p: Record<string, unknown>) =>
          p.category_id === filters.category
        )
      }

      // Apply status filter
      if (filters.status === 'active') {
        filteredProducts = filteredProducts.filter((p: Record<string, unknown>) => p.is_active === true)
      } else if (filters.status === 'inactive') {
        filteredProducts = filteredProducts.filter((p: Record<string, unknown>) => p.is_active === false)
      }

      // Get total count before pagination
      const totalCount = filteredProducts.length

      // Apply sorting
      const sortBy = filters.sortBy || 'name'
      const sortOrder = filters.sortOrder || 'asc'
      filteredProducts.sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
        const aVal = a[sortBy]
        const bVal = b[sortBy]
        if (aVal === null || aVal === undefined) return 1
        if (bVal === null || bVal === undefined) return -1
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
        }
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortOrder === 'asc' ? aVal - bVal : bVal - aVal
        }
        return 0
      })

      // Apply pagination
      const page = filters.page || 1
      const limit = filters.limit || 10
      const from = (page - 1) * limit
      const to = from + limit
      const paginatedProducts = filteredProducts.slice(from, to)

      // Normalize: map my_quantity to quantity for backward compatibility
      const normalizedProducts = paginatedProducts.map((p: Record<string, unknown>) => ({
        ...p,
        quantity: p.my_quantity,
      }))

      return {
        success: true,
        data: normalizedProducts,
        totalCount,
        userRole
      }
    }

    // Admin path: Use aggregated view (shows total stock)
    // @ts-expect-error - View exists in database but may not be in generated types
    let query = supabase.from('products_aggregated').select('*', { count: 'exact' })

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

    // Apply sorting
    const sortBy = filters.sortBy || 'name'
    // Map quantity to the correct column name for aggregated view
    const actualSortBy = sortBy === 'quantity' ? 'total_quantity' : sortBy
    const sortOrder = filters.sortOrder || 'asc'
    query = query.order(actualSortBy, { ascending: sortOrder === 'asc' })

    // Apply pagination
    const page = filters.page || 1
    const limit = filters.limit || 10
    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to)

    const { data: products, error, count } = await query

    if (error) {
      console.error('Error fetching products:', error)
      return { success: false, error: error.message, data: [], totalCount: 0, userRole }
    }

    // Normalize the response: map total_quantity to quantity for consistency
    const normalizedProducts = (products || []).map((p) => {
      const product = p as Record<string, unknown>
      return {
        ...product,
        quantity: product.total_quantity,
      }
    })

    return {
      success: true,
      data: normalizedProducts as Record<string, unknown>[],
      totalCount: count || 0,
      userRole
    }
  } catch (error) {
    console.error('Get products error:', error)
    return { success: false, error: 'Failed to fetch products', data: [], totalCount: 0, userRole: null }
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

    // Enrich inventories with store information
    const inventoriesWithStores = inventories?.map(inv => {
      const store = stores.find(s => s.id === inv.store_id)
      return {
        ...inv,
        store_name: store?.name || null,
        store: store || null,
      }
    }) || []

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
      all_inventories: inventoriesWithStores, // Include all inventories with store info
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

/**
 * Add an existing product to a store with initial inventory
 * Permissions: Admin can add to any store, Manager can add to their store only
 */
export async function addProductToStore(
  productId: string,
  storeId: string,
  quantity: number
): Promise<ActionResult<{ inventory_id: string }>> {
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

    // Managers can only add products to their assigned store
    if (profile.role === 'manager' && storeId !== profile.store_id) {
      return { success: false, error: 'You can only add products to your assigned store' }
    }

    // Validate quantity
    if (quantity < 0 || !Number.isInteger(quantity)) {
      return { success: false, error: 'Quantity must be a non-negative integer' }
    }

    // Check if product template exists
    const { data: template } = await supabase
      .from('product_templates')
      .select('id')
      .eq('id', productId)
      .single()

    if (!template) {
      return { success: false, error: 'Product not found' }
    }

    // Check if inventory already exists for this product-store combination
    const { data: existingInventory } = await supabase
      .from('product_inventory')
      .select('id')
      .eq('product_id', productId)
      .eq('store_id', storeId)
      .maybeSingle()

    if (existingInventory) {
      return { success: false, error: 'Product already exists in this store' }
    }

    // Create inventory record
    const { data: inventory, error } = await supabase
      .from('product_inventory')
      .insert({
        product_id: productId,
        store_id: storeId,
        quantity: quantity,
      })
      .select()
      .single()

    if (error) {
      console.error('Error adding product to store:', error)
      return { success: false, error: error.message }
    }

    revalidatePath(`/products/${productId}`)
    revalidatePath('/products')

    return { success: true, data: { inventory_id: inventory.id } }
  } catch (error) {
    console.error('Add product to store error:', error)
    return { success: false, error: 'Failed to add product to store' }
  }
}

/**
 * Batch update inventory quantities across multiple stores
 * Permissions: Admin can update all, Manager can only update their store
 */
export async function updateMultiStoreInventory(
  productId: string,
  inventories: Array<{ storeId: string; quantity: number }>
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

    if (!profile || !['admin', 'manager'].includes(profile.role)) {
      return { success: false, error: 'Insufficient permissions' }
    }

    // Validate inventories array
    if (!inventories || inventories.length === 0) {
      return { success: false, error: 'At least one inventory update is required' }
    }

    // Validate each inventory entry
    for (const inv of inventories) {
      if (inv.quantity < 0 || !Number.isInteger(inv.quantity)) {
        return { success: false, error: 'All quantities must be non-negative integers' }
      }
      // Managers can only update their own store
      if (profile.role === 'manager' && inv.storeId !== profile.store_id) {
        return { success: false, error: 'You can only update inventory for your assigned store' }
      }
    }

    // Update each inventory record
    const errors: string[] = []
    for (const inv of inventories) {
      const { error } = await supabase
        .from('product_inventory')
        .update({ quantity: inv.quantity })
        .eq('product_id', productId)
        .eq('store_id', inv.storeId)

      if (error) {
        errors.push(`Store ${inv.storeId}: ${error.message}`)
      }
    }

    if (errors.length > 0) {
      console.error('Errors updating inventories:', errors)
      return { success: false, error: `Failed to update some inventories: ${errors.join(', ')}` }
    }

    revalidatePath(`/products/${productId}`)
    revalidatePath('/products')

    return { success: true }
  } catch (error) {
    console.error('Update multi-store inventory error:', error)
    return { success: false, error: 'Failed to update inventories' }
  }
}

/**
 * Get all stores (for admin) - used to show stores where product can be added
 */
export async function getAllStores(): Promise<ActionResult<Array<{ id: string; name: string }>>> {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated', data: [] }
    }

    const { data: stores, error } = await supabase
      .from('stores')
      .select('id, name')
      .order('name')

    if (error) {
      console.error('Error fetching all stores:', error)
      return { success: false, error: error.message, data: [] }
    }

    return { success: true, data: stores || [] }
  } catch (error) {
    console.error('Get all stores error:', error)
    return { success: false, error: 'Failed to fetch stores', data: [] }
  }
}
