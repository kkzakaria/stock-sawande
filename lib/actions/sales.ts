'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { SaleFilters } from '@/lib/types/filters'

// Types
interface ActionResult<T = unknown> {
  success: boolean
  error?: string
  data?: T
}

export interface SaleWithDetails {
  id: string
  sale_number: string
  created_at: string
  subtotal: number
  tax: number
  discount: number | null
  total: number
  payment_method: string
  status: string
  refund_reason: string | null
  refunded_at: string | null
  notes: string | null
  cashier: { id: string; full_name: string | null; email: string } | null
  customer: { id: string; name: string } | null
  store: { id: string; name: string } | null
}

export interface SaleItemWithProduct {
  id: string
  quantity: number
  unit_price: number
  discount: number | null
  subtotal: number
  product: {
    id: string
    name: string
    sku: string
  } | null
}

export interface SaleDetailResponse {
  sale: SaleWithDetails
  items: SaleItemWithProduct[]
}

export interface SalesListResponse {
  sales: SaleWithDetails[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// Validation schemas
const refundSchema = z.object({
  saleId: z.string().uuid('Invalid sale ID'),
  reason: z.string().min(1, 'Refund reason is required').max(500, 'Reason too long'),
})

/**
 * Get sales list with filters and pagination
 */
export async function getSales(filters: SaleFilters): Promise<ActionResult<SalesListResponse>> {
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
      .from('sales')
      .select(`
        id,
        sale_number,
        created_at,
        subtotal,
        tax,
        discount,
        total,
        payment_method,
        status,
        refund_reason,
        refunded_at,
        notes,
        cashier:profiles!sales_cashier_id_fkey(id, full_name, email),
        customer:customers(id, name),
        store:stores(id, name)
      `, { count: 'exact' })

    // Filter by role
    if (profile.role === 'cashier') {
      // Cashiers can only see their own sales
      query = query.eq('cashier_id', user.id)
    } else if (profile.role === 'manager' && profile.store_id) {
      // Managers can only see their store's sales
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
      query = query.or(`sale_number.ilike.%${filters.search}%`)
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

    // Apply sorting
    const sortColumn = filters.sortBy === 'total_amount' ? 'total' :
                       filters.sortBy === 'invoice_number' ? 'sale_number' :
                       'created_at'
    query = query.order(sortColumn, { ascending: filters.sortOrder === 'asc' })

    // Apply pagination
    const page = filters.page || 1
    const limit = filters.limit || 10
    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to)

    const { data: sales, error, count } = await query

    if (error) {
      console.error('Error fetching sales:', error)
      return { success: false, error: error.message }
    }

    const total = count || 0
    const totalPages = Math.ceil(total / limit)

    return {
      success: true,
      data: {
        sales: (sales || []) as unknown as SaleWithDetails[],
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      },
    }
  } catch (error) {
    console.error('Error in getSales:', error)
    return { success: false, error: 'Failed to fetch sales' }
  }
}

/**
 * Get sale detail with items
 */
export async function getSaleDetail(saleId: string): Promise<ActionResult<SaleDetailResponse>> {
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

    // Fetch sale with relations
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .select(`
        id,
        sale_number,
        created_at,
        subtotal,
        tax,
        discount,
        total,
        payment_method,
        status,
        refund_reason,
        refunded_at,
        notes,
        store_id,
        cashier_id,
        cashier:profiles!sales_cashier_id_fkey(id, full_name, email),
        customer:customers(id, name),
        store:stores(id, name)
      `)
      .eq('id', saleId)
      .single()

    if (saleError) {
      console.error('Error fetching sale:', saleError)
      return { success: false, error: 'Sale not found' }
    }

    // Access control based on role
    if (profile.role === 'cashier') {
      // Cashiers can only view their own sales
      if (sale.cashier_id !== user.id) {
        return { success: false, error: 'Access denied' }
      }
    } else if (profile.role === 'manager' && profile.store_id && sale.store_id !== profile.store_id) {
      // Managers can only view their store's sales
      return { success: false, error: 'Access denied' }
    }

    // Fetch sale items with product details
    const { data: items, error: itemsError } = await supabase
      .from('sale_items')
      .select(`
        id,
        quantity,
        unit_price,
        discount,
        subtotal,
        product:product_templates(id, name, sku)
      `)
      .eq('sale_id', saleId)
      .order('created_at', { ascending: true })

    if (itemsError) {
      console.error('Error fetching sale items:', itemsError)
      return { success: false, error: 'Failed to fetch sale items' }
    }

    return {
      success: true,
      data: {
        sale: sale as unknown as SaleWithDetails,
        items: (items || []) as unknown as SaleItemWithProduct[],
      },
    }
  } catch (error) {
    console.error('Error in getSaleDetail:', error)
    return { success: false, error: 'Failed to fetch sale detail' }
  }
}

/**
 * Refund a sale
 * - Updates sale status to 'refunded'
 * - Restores inventory
 * - Creates stock movement records
 */
export async function refundSale(
  saleId: string,
  reason: string
): Promise<ActionResult> {
  try {
    // Validate input
    const validated = refundSchema.parse({ saleId, reason })

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

    // Fetch the sale
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .select('id, status, store_id')
      .eq('id', validated.saleId)
      .single()

    if (saleError || !sale) {
      return { success: false, error: 'Sale not found' }
    }

    // Managers can only refund their store's sales
    if (profile.role === 'manager' && profile.store_id && sale.store_id !== profile.store_id) {
      return { success: false, error: 'Access denied' }
    }

    // Check if sale is already refunded
    if (sale.status === 'refunded') {
      return { success: false, error: 'Sale is already refunded' }
    }

    // Check if sale is completed (can only refund completed sales)
    if (sale.status !== 'completed') {
      return { success: false, error: 'Only completed sales can be refunded' }
    }

    // Fetch sale items to restore inventory
    const { data: saleItems, error: itemsError } = await supabase
      .from('sale_items')
      .select('id, product_id, inventory_id, quantity')
      .eq('sale_id', validated.saleId)

    if (itemsError) {
      console.error('Error fetching sale items:', itemsError)
      return { success: false, error: 'Failed to fetch sale items' }
    }

    // Update sale status to refunded
    const { error: updateError } = await supabase
      .from('sales')
      .update({
        status: 'refunded',
        refund_reason: validated.reason,
        refunded_at: new Date().toISOString(),
      })
      .eq('id', validated.saleId)

    if (updateError) {
      console.error('Error updating sale:', updateError)
      return { success: false, error: 'Failed to update sale status' }
    }

    // Restore inventory and create stock movements for each item
    for (const item of saleItems || []) {
      // Get current inventory quantity
      const { data: inventory } = await supabase
        .from('product_inventory')
        .select('quantity')
        .eq('id', item.inventory_id)
        .single()

      const previousQuantity = inventory?.quantity || 0
      const newQuantity = previousQuantity + item.quantity

      // Update inventory
      const { error: inventoryError } = await supabase
        .from('product_inventory')
        .update({ quantity: newQuantity })
        .eq('id', item.inventory_id)

      if (inventoryError) {
        console.error('Error restoring inventory:', inventoryError)
        // Continue with other items even if one fails
      }

      // Create stock movement record
      const { error: movementError } = await supabase
        .from('stock_movements')
        .insert({
          product_id: item.product_id,
          store_id: sale.store_id,
          inventory_id: item.inventory_id,
          type: 'return',
          quantity: item.quantity,
          previous_quantity: previousQuantity,
          new_quantity: newQuantity,
          reference: `Refund: ${validated.saleId}`,
          notes: validated.reason,
          user_id: user.id,
        })

      if (movementError) {
        console.error('Error creating stock movement:', movementError)
        // Continue with other items even if one fails
      }
    }

    revalidatePath('/sales')
    revalidatePath('/pos')

    return { success: true }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    console.error('Error in refundSale:', error)
    return { success: false, error: 'Failed to refund sale' }
  }
}
