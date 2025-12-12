'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { ProformaFilters } from '@/lib/types/filters'

// Types
interface ActionResult<T = unknown> {
  success: boolean
  error?: string
  data?: T
}

export type ProformaStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'converted' | 'expired'

export interface ProformaWithDetails {
  id: string
  proforma_number: string
  created_at: string
  subtotal: number
  tax: number
  discount: number | null
  total: number
  status: ProformaStatus
  notes: string | null
  terms: string | null
  valid_until: string | null
  converted_sale_id: string | null
  converted_at: string | null
  sent_at: string | null
  accepted_at: string | null
  rejected_at: string | null
  rejection_reason: string | null
  created_by: { id: string; full_name: string | null; email: string } | null
  customer: { id: string; name: string; email: string | null; phone: string | null } | null
  store: { id: string; name: string } | null
}

export interface ProformaItemWithProduct {
  id: string
  quantity: number
  unit_price: number
  discount: number | null
  subtotal: number
  notes: string | null
  product: {
    id: string
    name: string
    sku: string
    price: number
  } | null
}

export interface ProformaDetailResponse {
  proforma: ProformaWithDetails
  items: ProformaItemWithProduct[]
}

export interface ProformasListResponse {
  proformas: ProformaWithDetails[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// Validation schemas
const proformaItemSchema = z.object({
  product_id: z.string().uuid('Invalid product ID'),
  quantity: z.number().int().positive('Quantity must be positive'),
  unit_price: z.number().nonnegative('Unit price must be non-negative'),
  discount: z.number().nonnegative('Discount must be non-negative').optional().default(0),
  notes: z.string().optional(),
})

const createProformaSchema = z.object({
  store_id: z.string().uuid('Invalid store ID'),
  customer_id: z.string().uuid('Invalid customer ID').optional().nullable(),
  items: z.array(proformaItemSchema).min(1, 'At least one item is required'),
  tax: z.number().nonnegative('Tax must be non-negative').optional().default(0),
  discount: z.number().nonnegative('Discount must be non-negative').optional().default(0),
  notes: z.string().optional(),
  terms: z.string().optional(),
  valid_until: z.string().optional().nullable(),
})

const updateProformaSchema = z.object({
  proforma_id: z.string().uuid('Invalid proforma ID'),
  customer_id: z.string().uuid('Invalid customer ID').optional().nullable(),
  items: z.array(proformaItemSchema).min(1, 'At least one item is required').optional(),
  tax: z.number().nonnegative('Tax must be non-negative').optional(),
  discount: z.number().nonnegative('Discount must be non-negative').optional(),
  notes: z.string().optional().nullable(),
  terms: z.string().optional().nullable(),
  valid_until: z.string().optional().nullable(),
})

const updateStatusSchema = z.object({
  proforma_id: z.string().uuid('Invalid proforma ID'),
  status: z.enum(['sent', 'accepted', 'rejected']),
  rejection_reason: z.string().optional(),
})

/**
 * Get proformas list with filters and pagination
 */
export async function getProformas(filters: ProformaFilters): Promise<ActionResult<ProformasListResponse>> {
  try {
    const supabase = await createClient()

    // Verify user is authenticated
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Get user profile and role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, store_id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return { success: false, error: 'Profile not found' }
    }

    // Build query
    let query = supabase
      .from('proformas')
      .select(`
        id,
        proforma_number,
        created_at,
        subtotal,
        tax,
        discount,
        total,
        status,
        notes,
        terms,
        valid_until,
        converted_sale_id,
        converted_at,
        sent_at,
        accepted_at,
        rejected_at,
        rejection_reason,
        created_by:profiles!proformas_created_by_fkey(id, full_name, email),
        customer:customers(id, name, email, phone),
        store:stores(id, name)
      `, { count: 'exact' })

    // Filter by role
    if (profile.role === 'cashier') {
      // Cashiers can only see their own proformas
      query = query.eq('created_by', user.id)
    } else if (profile.role === 'manager' && profile.store_id) {
      // Managers can only see their store's proformas
      query = query.eq('store_id', profile.store_id)
    } else if (filters.store) {
      // Admin can filter by store
      query = query.eq('store_id', filters.store)
    }

    // Apply filters
    if (filters.status) {
      query = query.eq('status', filters.status)
    }

    if (filters.search) {
      query = query.or(`proforma_number.ilike.%${filters.search}%`)
    }

    if (filters.dateFrom) {
      query = query.gte('created_at', filters.dateFrom.toISOString())
    }

    if (filters.dateTo) {
      // Add 1 day to include the full end date
      const endDate = new Date(filters.dateTo)
      endDate.setDate(endDate.getDate() + 1)
      query = query.lt('created_at', endDate.toISOString())
    }

    if (filters.customerId) {
      query = query.eq('customer_id', filters.customerId)
    }

    // Apply sorting
    const sortColumn = filters.sortBy === 'total_amount' ? 'total' :
                       filters.sortBy === 'proforma_number' ? 'proforma_number' :
                       filters.sortBy === 'valid_until' ? 'valid_until' :
                       'created_at'
    query = query.order(sortColumn, { ascending: filters.sortOrder === 'asc' })

    // Apply pagination
    const page = filters.page || 1
    const limit = filters.limit || 10
    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to)

    const { data: proformas, error, count } = await query

    if (error) {
      console.error('Error fetching proformas:', error)
      return { success: false, error: error.message }
    }

    const total = count || 0
    const totalPages = Math.ceil(total / limit)

    return {
      success: true,
      data: {
        proformas: (proformas || []) as unknown as ProformaWithDetails[],
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      },
    }
  } catch (error) {
    console.error('Error in getProformas:', error)
    return { success: false, error: 'Failed to fetch proformas' }
  }
}

/**
 * Get proforma detail with items
 */
export async function getProformaDetail(proformaId: string): Promise<ActionResult<ProformaDetailResponse>> {
  try {
    const supabase = await createClient()

    // Verify user is authenticated
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Get user profile and role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, store_id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return { success: false, error: 'Profile not found' }
    }

    // Fetch proforma with relations
    const { data: proforma, error: proformaError } = await supabase
      .from('proformas')
      .select(`
        id,
        proforma_number,
        created_at,
        subtotal,
        tax,
        discount,
        total,
        status,
        notes,
        terms,
        valid_until,
        converted_sale_id,
        converted_at,
        sent_at,
        accepted_at,
        rejected_at,
        rejection_reason,
        store_id,
        created_by:profiles!proformas_created_by_fkey(id, full_name, email),
        customer:customers(id, name, email, phone),
        store:stores(id, name)
      `)
      .eq('id', proformaId)
      .single()

    if (proformaError) {
      console.error('Error fetching proforma:', proformaError)
      return { success: false, error: 'Proforma not found' }
    }

    // Access control based on role
    if (profile.role === 'cashier') {
      // Cashiers can only view their own proformas
      const createdBy = proforma.created_by as { id: string } | null
      if (createdBy?.id !== user.id) {
        return { success: false, error: 'Access denied' }
      }
    } else if (profile.role === 'manager' && profile.store_id && proforma.store_id !== profile.store_id) {
      // Managers can only view their store's proformas
      return { success: false, error: 'Access denied' }
    }

    // Fetch proforma items with product details
    const { data: items, error: itemsError } = await supabase
      .from('proforma_items')
      .select(`
        id,
        quantity,
        unit_price,
        discount,
        subtotal,
        notes,
        product:product_templates(id, name, sku, price)
      `)
      .eq('proforma_id', proformaId)
      .order('created_at', { ascending: true })

    if (itemsError) {
      console.error('Error fetching proforma items:', itemsError)
      return { success: false, error: 'Failed to fetch proforma items' }
    }

    return {
      success: true,
      data: {
        proforma: proforma as unknown as ProformaWithDetails,
        items: (items || []) as unknown as ProformaItemWithProduct[],
      },
    }
  } catch (error) {
    console.error('Error in getProformaDetail:', error)
    return { success: false, error: 'Failed to fetch proforma detail' }
  }
}

/**
 * Create a new proforma
 */
export async function createProforma(
  input: z.infer<typeof createProformaSchema>
): Promise<ActionResult<{ id: string; proforma_number: string }>> {
  try {
    // Validate input
    const validated = createProformaSchema.parse(input)

    const supabase = await createClient()

    // Verify user is authenticated
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Get user profile and role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, store_id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return { success: false, error: 'Profile not found' }
    }

    // Validate store access
    if (profile.role === 'manager' && profile.store_id && profile.store_id !== validated.store_id) {
      return { success: false, error: 'Access denied to this store' }
    }

    if (profile.role === 'cashier' && profile.store_id && profile.store_id !== validated.store_id) {
      return { success: false, error: 'Access denied to this store' }
    }

    // Calculate totals
    let subtotal = 0
    for (const item of validated.items) {
      const itemSubtotal = item.unit_price * item.quantity - (item.discount || 0)
      subtotal += itemSubtotal
    }
    const total = subtotal + validated.tax - validated.discount

    // Create proforma
    const { data: proforma, error: proformaError } = await supabase
      .from('proformas')
      .insert({
        store_id: validated.store_id,
        created_by: user.id,
        customer_id: validated.customer_id || null,
        proforma_number: '', // Will be auto-generated by trigger
        subtotal,
        tax: validated.tax,
        discount: validated.discount,
        total,
        status: 'draft',
        notes: validated.notes || null,
        terms: validated.terms || null,
        valid_until: validated.valid_until || null,
      })
      .select('id, proforma_number')
      .single()

    if (proformaError) {
      console.error('Error creating proforma:', proformaError)
      return { success: false, error: proformaError.message }
    }

    // Create proforma items
    const itemsToInsert = validated.items.map(item => ({
      proforma_id: proforma.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      discount: item.discount || 0,
      subtotal: item.unit_price * item.quantity - (item.discount || 0),
      notes: item.notes || null,
    }))

    const { error: itemsError } = await supabase
      .from('proforma_items')
      .insert(itemsToInsert)

    if (itemsError) {
      console.error('Error creating proforma items:', itemsError)
      // Rollback proforma creation
      await supabase.from('proformas').delete().eq('id', proforma.id)
      return { success: false, error: itemsError.message }
    }

    revalidatePath('/proformas')

    return {
      success: true,
      data: {
        id: proforma.id,
        proforma_number: proforma.proforma_number,
      },
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    console.error('Error in createProforma:', error)
    return { success: false, error: 'Failed to create proforma' }
  }
}

/**
 * Update an existing proforma
 */
export async function updateProforma(
  input: z.infer<typeof updateProformaSchema>
): Promise<ActionResult> {
  try {
    // Validate input
    const validated = updateProformaSchema.parse(input)

    const supabase = await createClient()

    // Verify user is authenticated
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Get user profile and role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, store_id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return { success: false, error: 'Profile not found' }
    }

    // Fetch existing proforma
    const { data: proforma, error: fetchError } = await supabase
      .from('proformas')
      .select('id, store_id, created_by, status')
      .eq('id', validated.proforma_id)
      .single()

    if (fetchError || !proforma) {
      return { success: false, error: 'Proforma not found' }
    }

    // Check if proforma can be edited
    if (!['draft', 'sent'].includes(proforma.status)) {
      return { success: false, error: 'Cannot edit proforma with current status' }
    }

    // Access control
    if (profile.role === 'cashier' && proforma.created_by !== user.id) {
      return { success: false, error: 'Access denied' }
    }

    if (profile.role === 'manager' && profile.store_id && proforma.store_id !== profile.store_id) {
      return { success: false, error: 'Access denied' }
    }

    // Update proforma data
    const updateData: Record<string, unknown> = {}
    if (validated.customer_id !== undefined) updateData.customer_id = validated.customer_id
    if (validated.tax !== undefined) updateData.tax = validated.tax
    if (validated.discount !== undefined) updateData.discount = validated.discount
    if (validated.notes !== undefined) updateData.notes = validated.notes
    if (validated.terms !== undefined) updateData.terms = validated.terms
    if (validated.valid_until !== undefined) updateData.valid_until = validated.valid_until

    // Update items if provided
    if (validated.items) {
      // Delete existing items
      const { error: deleteError } = await supabase
        .from('proforma_items')
        .delete()
        .eq('proforma_id', validated.proforma_id)

      if (deleteError) {
        console.error('Error deleting proforma items:', deleteError)
        return { success: false, error: 'Failed to update items' }
      }

      // Calculate new totals
      let subtotal = 0
      for (const item of validated.items) {
        const itemSubtotal = item.unit_price * item.quantity - (item.discount || 0)
        subtotal += itemSubtotal
      }
      updateData.subtotal = subtotal
      updateData.total = subtotal + (validated.tax ?? 0) - (validated.discount ?? 0)

      // Insert new items
      const itemsToInsert = validated.items.map(item => ({
        proforma_id: validated.proforma_id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount: item.discount || 0,
        subtotal: item.unit_price * item.quantity - (item.discount || 0),
        notes: item.notes || null,
      }))

      const { error: itemsError } = await supabase
        .from('proforma_items')
        .insert(itemsToInsert)

      if (itemsError) {
        console.error('Error creating proforma items:', itemsError)
        return { success: false, error: itemsError.message }
      }
    }

    // Update proforma
    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabase
        .from('proformas')
        .update(updateData)
        .eq('id', validated.proforma_id)

      if (updateError) {
        console.error('Error updating proforma:', updateError)
        return { success: false, error: updateError.message }
      }
    }

    revalidatePath('/proformas')
    revalidatePath(`/proformas/${validated.proforma_id}`)

    return { success: true }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    console.error('Error in updateProforma:', error)
    return { success: false, error: 'Failed to update proforma' }
  }
}

/**
 * Update proforma status (send, accept, reject)
 */
export async function updateProformaStatus(
  input: z.infer<typeof updateStatusSchema>
): Promise<ActionResult> {
  try {
    // Validate input
    const validated = updateStatusSchema.parse(input)

    const supabase = await createClient()

    // Verify user is authenticated
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Get user profile and role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, store_id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return { success: false, error: 'Profile not found' }
    }

    // Fetch existing proforma
    const { data: proforma, error: fetchError } = await supabase
      .from('proformas')
      .select('id, store_id, created_by, status')
      .eq('id', validated.proforma_id)
      .single()

    if (fetchError || !proforma) {
      return { success: false, error: 'Proforma not found' }
    }

    // Access control
    if (profile.role === 'cashier' && proforma.created_by !== user.id) {
      return { success: false, error: 'Access denied' }
    }

    if (profile.role === 'manager' && profile.store_id && proforma.store_id !== profile.store_id) {
      return { success: false, error: 'Access denied' }
    }

    // Validate status transition
    const validTransitions: Record<string, string[]> = {
      draft: ['sent'],
      sent: ['accepted', 'rejected'],
      accepted: [],
      rejected: [],
      converted: [],
      expired: [],
    }

    if (!validTransitions[proforma.status]?.includes(validated.status)) {
      return { success: false, error: `Cannot change status from ${proforma.status} to ${validated.status}` }
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {
      status: validated.status,
    }

    if (validated.status === 'sent') {
      updateData.sent_at = new Date().toISOString()
    } else if (validated.status === 'accepted') {
      updateData.accepted_at = new Date().toISOString()
    } else if (validated.status === 'rejected') {
      updateData.rejected_at = new Date().toISOString()
      if (validated.rejection_reason) {
        updateData.rejection_reason = validated.rejection_reason
      }
    }

    // Update proforma
    const { error: updateError } = await supabase
      .from('proformas')
      .update(updateData)
      .eq('id', validated.proforma_id)

    if (updateError) {
      console.error('Error updating proforma status:', updateError)
      return { success: false, error: updateError.message }
    }

    revalidatePath('/proformas')
    revalidatePath(`/proformas/${validated.proforma_id}`)

    return { success: true }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    console.error('Error in updateProformaStatus:', error)
    return { success: false, error: 'Failed to update proforma status' }
  }
}

/**
 * Delete a proforma
 */
export async function deleteProforma(proformaId: string): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    // Verify user is authenticated
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Get user profile and role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, store_id')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'manager'].includes(profile.role)) {
      return { success: false, error: 'Insufficient permissions' }
    }

    // Fetch existing proforma
    const { data: proforma, error: fetchError } = await supabase
      .from('proformas')
      .select('id, store_id, status')
      .eq('id', proformaId)
      .single()

    if (fetchError || !proforma) {
      return { success: false, error: 'Proforma not found' }
    }

    // Access control
    if (profile.role === 'manager' && profile.store_id && proforma.store_id !== profile.store_id) {
      return { success: false, error: 'Access denied' }
    }

    // Cannot delete converted proformas
    if (proforma.status === 'converted') {
      return { success: false, error: 'Cannot delete converted proforma' }
    }

    // Delete proforma (items will be cascade deleted)
    const { error: deleteError } = await supabase
      .from('proformas')
      .delete()
      .eq('id', proformaId)

    if (deleteError) {
      console.error('Error deleting proforma:', deleteError)
      return { success: false, error: deleteError.message }
    }

    revalidatePath('/proformas')

    return { success: true }
  } catch (error) {
    console.error('Error in deleteProforma:', error)
    return { success: false, error: 'Failed to delete proforma' }
  }
}

/**
 * Convert proforma to sale
 */
export async function convertProformaToSale(
  proformaId: string,
  paymentMethod: 'cash' | 'card' | 'mobile' | 'other',
  paymentReference?: string
): Promise<ActionResult<{ sale_id: string; sale_number: string }>> {
  try {
    const supabase = await createClient()

    // Verify user is authenticated
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Get user profile and role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, store_id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return { success: false, error: 'Profile not found' }
    }

    // Fetch proforma with items
    const { data: proforma, error: proformaError } = await supabase
      .from('proformas')
      .select(`
        id,
        store_id,
        customer_id,
        subtotal,
        tax,
        discount,
        total,
        status,
        notes,
        created_by
      `)
      .eq('id', proformaId)
      .single()

    if (proformaError || !proforma) {
      return { success: false, error: 'Proforma not found' }
    }

    // Access control
    if (profile.role === 'cashier' && proforma.created_by !== user.id) {
      return { success: false, error: 'Access denied' }
    }

    if (profile.role === 'manager' && profile.store_id && proforma.store_id !== profile.store_id) {
      return { success: false, error: 'Access denied' }
    }

    // Check if proforma can be converted
    if (!['draft', 'sent', 'accepted'].includes(proforma.status)) {
      return { success: false, error: 'Proforma cannot be converted with current status' }
    }

    // Fetch proforma items
    const { data: proformaItems, error: itemsError } = await supabase
      .from('proforma_items')
      .select('product_id, quantity, unit_price, discount, subtotal')
      .eq('proforma_id', proformaId)

    if (itemsError || !proformaItems?.length) {
      return { success: false, error: 'Failed to fetch proforma items' }
    }

    // Get inventory IDs for each product in the store
    const productIds = proformaItems.map(item => item.product_id)
    const { data: inventories, error: invError } = await supabase
      .from('product_inventory')
      .select('id, product_id, quantity')
      .eq('store_id', proforma.store_id)
      .in('product_id', productIds)

    if (invError) {
      return { success: false, error: 'Failed to fetch inventory' }
    }

    // Create inventory map
    const inventoryMap = new Map(inventories?.map(inv => [inv.product_id, inv]) || [])

    // Check stock availability and prepare sale items
    const saleItems = []
    for (const item of proformaItems) {
      const inventory = inventoryMap.get(item.product_id)
      if (!inventory) {
        return { success: false, error: `Product not available in this store` }
      }
      if (inventory.quantity < item.quantity) {
        return { success: false, error: `Insufficient stock for product` }
      }
      saleItems.push({
        product_id: item.product_id,
        inventory_id: inventory.id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount: item.discount || 0,
        subtotal: item.subtotal,
      })
    }

    // Create sale
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert({
        store_id: proforma.store_id,
        cashier_id: user.id,
        customer_id: proforma.customer_id,
        sale_number: '', // Will be auto-generated
        subtotal: proforma.subtotal,
        tax: proforma.tax,
        discount: proforma.discount || 0,
        total: proforma.total,
        payment_method: paymentMethod,
        payment_reference: paymentReference || null,
        status: 'completed',
        notes: proforma.notes,
      })
      .select('id, sale_number')
      .single()

    if (saleError) {
      console.error('Error creating sale:', saleError)
      return { success: false, error: saleError.message }
    }

    // Create sale items
    const saleItemsToInsert = saleItems.map(item => ({
      sale_id: sale.id,
      product_id: item.product_id,
      inventory_id: item.inventory_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      discount: item.discount,
      subtotal: item.subtotal,
    }))

    const { error: saleItemsError } = await supabase
      .from('sale_items')
      .insert(saleItemsToInsert)

    if (saleItemsError) {
      console.error('Error creating sale items:', saleItemsError)
      // Rollback sale creation
      await supabase.from('sales').delete().eq('id', sale.id)
      return { success: false, error: saleItemsError.message }
    }

    // Update proforma status to converted
    const { error: updateError } = await supabase
      .from('proformas')
      .update({
        status: 'converted',
        converted_sale_id: sale.id,
        converted_at: new Date().toISOString(),
      })
      .eq('id', proformaId)

    if (updateError) {
      console.error('Error updating proforma status:', updateError)
      // Don't rollback as sale was created successfully
    }

    revalidatePath('/proformas')
    revalidatePath('/sales')
    revalidatePath('/pos')

    return {
      success: true,
      data: {
        sale_id: sale.id,
        sale_number: sale.sale_number,
      },
    }
  } catch (error) {
    console.error('Error in convertProformaToSale:', error)
    return { success: false, error: 'Failed to convert proforma to sale' }
  }
}

/**
 * Duplicate a proforma
 */
export async function duplicateProforma(
  proformaId: string
): Promise<ActionResult<{ id: string; proforma_number: string }>> {
  try {
    const supabase = await createClient()

    // Verify user is authenticated
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Get user profile and role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, store_id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return { success: false, error: 'Profile not found' }
    }

    // Fetch proforma with items
    const { data: proforma, error: proformaError } = await supabase
      .from('proformas')
      .select(`
        store_id,
        customer_id,
        subtotal,
        tax,
        discount,
        total,
        notes,
        terms,
        created_by
      `)
      .eq('id', proformaId)
      .single()

    if (proformaError || !proforma) {
      return { success: false, error: 'Proforma not found' }
    }

    // Access control
    if (profile.role === 'cashier' && proforma.created_by !== user.id) {
      return { success: false, error: 'Access denied' }
    }

    if (profile.role === 'manager' && profile.store_id && proforma.store_id !== profile.store_id) {
      return { success: false, error: 'Access denied' }
    }

    // Fetch proforma items
    const { data: items, error: itemsError } = await supabase
      .from('proforma_items')
      .select('product_id, quantity, unit_price, discount, subtotal, notes')
      .eq('proforma_id', proformaId)

    if (itemsError) {
      return { success: false, error: 'Failed to fetch proforma items' }
    }

    // Create new proforma
    const { data: newProforma, error: createError } = await supabase
      .from('proformas')
      .insert({
        store_id: proforma.store_id,
        created_by: user.id,
        customer_id: proforma.customer_id,
        proforma_number: '', // Will be auto-generated
        subtotal: proforma.subtotal,
        tax: proforma.tax,
        discount: proforma.discount,
        total: proforma.total,
        status: 'draft',
        notes: proforma.notes,
        terms: proforma.terms,
      })
      .select('id, proforma_number')
      .single()

    if (createError) {
      console.error('Error creating proforma:', createError)
      return { success: false, error: createError.message }
    }

    // Create new items
    if (items?.length) {
      const itemsToInsert = items.map(item => ({
        proforma_id: newProforma.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount: item.discount,
        subtotal: item.subtotal,
        notes: item.notes,
      }))

      const { error: insertError } = await supabase
        .from('proforma_items')
        .insert(itemsToInsert)

      if (insertError) {
        // Rollback
        await supabase.from('proformas').delete().eq('id', newProforma.id)
        return { success: false, error: insertError.message }
      }
    }

    revalidatePath('/proformas')

    return {
      success: true,
      data: {
        id: newProforma.id,
        proforma_number: newProforma.proforma_number,
      },
    }
  } catch (error) {
    console.error('Error in duplicateProforma:', error)
    return { success: false, error: 'Failed to duplicate proforma' }
  }
}
