'use server'

import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// Stock movement types from database enum
export type StockMovementType =
  | 'purchase'
  | 'sale'
  | 'adjustment'
  | 'transfer'
  | 'return'
  | 'damage'
  | 'loss'

// Validation schema for stock movement creation
const stockMovementSchema = z.object({
  product_id: z.string().uuid('Invalid product ID'),
  store_id: z.string().uuid('Invalid store ID'),
  type: z.enum(['purchase', 'sale', 'adjustment', 'transfer', 'return', 'damage', 'loss']),
  quantity: z.number().int().refine(val => val !== 0, 'Quantity cannot be zero'),
  notes: z.string().optional(),
  reference: z.string().optional(),
})

type StockMovementInput = z.infer<typeof stockMovementSchema>

interface ActionResult<T = unknown> {
  success: boolean
  error?: string
  data?: T
}

export interface StockMovement {
  id: string
  product_id: string
  store_id: string
  user_id: string
  type: StockMovementType
  quantity: number
  previous_quantity: number
  new_quantity: number
  notes: string | null
  reference: string | null
  created_at: string
  profiles?: {
    full_name: string | null
    email: string
  }
}

export interface ProductStats {
  totalSales: number
  totalRevenue: number
  averageDailyVelocity: number
  daysOfStockRemaining: number | null
  stockTrend: Array<{ date: string; quantity: number }>
}

interface StockMovementsFilters {
  type?: StockMovementType | null
  page?: number
  limit?: number
}

/**
 * Get stock movements for a product with optional filtering and pagination
 */
export async function getStockMovements(
  productId: string,
  filters: StockMovementsFilters = {}
): Promise<ActionResult<{ movements: StockMovement[]; total: number }>> {
  try {
    const supabase = await createClient()

    // Verify user authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Get user profile for permission check
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
      .from('stock_movements')
      .select(`
        *
      `, { count: 'exact' })
      .eq('product_id', productId)
      .order('created_at', { ascending: false })

    // Apply type filter
    if (filters.type) {
      query = query.eq('type', filters.type)
    }

    // Apply pagination
    const page = filters.page || 1
    const limit = filters.limit || 10
    const from = (page - 1) * limit
    const to = from + limit - 1

    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) {
      console.error('Error fetching stock movements:', error)
      return { success: false, error: error.message }
    }

    // Fetch user profiles separately for each movement
    const movementsWithProfiles = await Promise.all(
      (data || []).map(async (movement) => {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', movement.user_id)
          .single()

        return {
          ...movement,
          profiles: profile || undefined
        } as StockMovement
      })
    )

    return {
      success: true,
      data: {
        movements: movementsWithProfiles,
        total: count || 0
      }
    }
  } catch (error) {
    console.error('Unexpected error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch stock movements'
    }
  }
}

/**
 * Create a stock movement manually
 * Note: This should be used carefully as it bypasses the automatic trigger
 */
export async function createStockMovement(
  input: StockMovementInput,
  previousQuantity: number,
  newQuantity: number
): Promise<ActionResult<StockMovement>> {
  try {
    const supabase = await createClient()

    // Verify user authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Validate input
    const validationResult = stockMovementSchema.safeParse(input)
    if (!validationResult.success) {
      return {
        success: false,
        error: validationResult.error.issues[0].message
      }
    }

    const validated = validationResult.data

    // Get user profile for permission check
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role, store_id')
      .eq('id', user.id)
      .single()

    if (!userProfile) {
      return { success: false, error: 'Profile not found' }
    }

    // Verify user has access to this store
    if (userProfile.role !== 'admin' && userProfile.store_id !== validated.store_id) {
      return { success: false, error: 'Access denied to this store' }
    }

    // Create the stock movement
    const { data, error } = await supabase
      .from('stock_movements')
      .insert({
        product_id: validated.product_id,
        store_id: validated.store_id,
        user_id: user.id,
        type: validated.type,
        quantity: validated.quantity,
        previous_quantity: previousQuantity,
        new_quantity: newQuantity,
        notes: validated.notes || null,
        reference: validated.reference || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating stock movement:', error)
      return { success: false, error: error.message }
    }

    // Fetch user profile separately
    const { data: userProfileData } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single()

    const movementWithProfile: StockMovement = {
      ...data,
      profiles: userProfileData || undefined
    }

    return { success: true, data: movementWithProfile }
  } catch (error) {
    console.error('Unexpected error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create stock movement'
    }
  }
}

/**
 * Get product statistics based on stock movements
 */
export async function getProductStats(
  productId: string,
  days: number = 30
): Promise<ActionResult<ProductStats>> {
  try {
    const supabase = await createClient()

    // Verify user authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Get product template data
    const { data: template } = await supabase
      .from('product_templates')
      .select('price')
      .eq('id', productId)
      .single()

    if (!template) {
      return { success: false, error: 'Product not found' }
    }

    // Get inventory data for current store (needed for quantity)
    const { data: profile } = await supabase
      .from('profiles')
      .select('store_id')
      .eq('id', user.id)
      .single()

    let currentQuantity = 0
    if (profile?.store_id) {
      const { data: inventory } = await supabase
        .from('product_inventory')
        .select('quantity')
        .eq('product_id', productId)
        .eq('store_id', profile.store_id)
        .single()

      currentQuantity = inventory?.quantity || 0
    }

    // Calculate date range
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Get sales movements for the period
    const { data: salesMovements } = await supabase
      .from('stock_movements')
      .select('quantity, created_at')
      .eq('product_id', productId)
      .eq('type', 'sale')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true })

    // Calculate total sales (sum of negative quantities)
    const totalSales = Math.abs(
      (salesMovements || []).reduce((sum, m) => sum + m.quantity, 0)
    )

    // Calculate total revenue
    const totalRevenue = totalSales * template.price

    // Calculate average daily velocity
    const averageDailyVelocity = days > 0 ? totalSales / days : 0

    // Calculate days of stock remaining
    const daysOfStockRemaining = averageDailyVelocity > 0
      ? Math.round(currentQuantity / averageDailyVelocity)
      : null

    // Get stock trend data (daily snapshots)
    const { data: allMovements } = await supabase
      .from('stock_movements')
      .select('new_quantity, created_at')
      .eq('product_id', productId)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true })

    // Create daily stock snapshots
    const stockTrend: Array<{ date: string; quantity: number }> = []
    if (allMovements && allMovements.length > 0) {
      // Group movements by day and take the last quantity of each day
      const dailyMap = new Map<string, number>()

      allMovements.forEach(movement => {
        const date = new Date(movement.created_at).toISOString().split('T')[0]
        dailyMap.set(date, movement.new_quantity)
      })

      // Convert to array and fill in missing days
      const dates = Array.from(dailyMap.keys()).sort()
      let lastQuantity = allMovements[0].new_quantity

      for (let i = 0; i < days; i++) {
        const date = new Date(startDate)
        date.setDate(date.getDate() + i)
        const dateStr = date.toISOString().split('T')[0]

        if (dailyMap.has(dateStr)) {
          lastQuantity = dailyMap.get(dateStr)!
        }

        stockTrend.push({
          date: dateStr,
          quantity: lastQuantity
        })
      }
    } else {
      // No movements, use current quantity for all days
      for (let i = 0; i < days; i++) {
        const date = new Date(startDate)
        date.setDate(date.getDate() + i)
        stockTrend.push({
          date: date.toISOString().split('T')[0],
          quantity: currentQuantity
        })
      }
    }

    return {
      success: true,
      data: {
        totalSales,
        totalRevenue,
        averageDailyVelocity,
        daysOfStockRemaining,
        stockTrend
      }
    }
  } catch (error) {
    console.error('Unexpected error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to calculate product stats'
    }
  }
}
