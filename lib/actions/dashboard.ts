'use server'

import { createClient } from '@/lib/supabase/server'
import { getCachedUser, getCachedProfile } from '@/lib/server/cached-queries'

// Types
interface ActionResult<T = unknown> {
  success: boolean
  error?: string
  data?: T
}

export interface DashboardMetrics {
  totalRevenue: number
  todayRevenue: number
  yesterdayRevenue: number
  weekRevenue: number
  lastWeekRevenue: number
  monthRevenue: number
  totalTransactions: number
  todayTransactions: number
  avgTransactionValue: number
  refundCount: number
  refundRate: number
  lowStockCount: number
}

export interface RevenueTrend {
  period: string
  periodStart: string
  transactionCount: number
  totalRevenue: number
  avgTransaction: number
  refundCount: number
}

export interface TopProduct {
  productId: string
  productName: string
  sku: string
  categoryName: string | null
  unitsSold: number
  totalRevenue: number
  avgPrice: number
}

export interface LowStockAlert {
  inventoryId: string
  productId: string
  productName: string
  sku: string
  quantity: number
  minStockLevel: number
  storeId: string
  storeName: string
  stockStatus: 'out_of_stock' | 'low_stock'
}

// Helper for server actions - gets authenticated user and profile with effective store ID
async function getActionContext(requestedStoreId?: string) {
  const user = await getCachedUser()
  if (!user) {
    return { error: 'Not authenticated', profile: null, effectiveStoreId: undefined }
  }

  const profile = await getCachedProfile(user.id)
  if (!profile) {
    return { error: 'Profile not found', profile: null, effectiveStoreId: undefined }
  }

  // Determine effective store ID based on role
  let effectiveStoreId = requestedStoreId
  if (profile.role === 'manager' && profile.store_id) {
    effectiveStoreId = profile.store_id
  } else if (profile.role === 'cashier') {
    effectiveStoreId = profile.store_id ?? undefined
  }

  return { error: null, profile, effectiveStoreId }
}

/**
 * Get dashboard metrics for a store or all stores
 */
export async function getDashboardMetrics(storeId?: string): Promise<ActionResult<DashboardMetrics>> {
  try {
    const supabase = await createClient()

    // Get authenticated user and effective store ID
    const { error: authError, effectiveStoreId } = await getActionContext(storeId)
    if (authError) {
      return { success: false, error: authError }
    }

    // Call the database function
    const { data, error } = await supabase
      .rpc('get_dashboard_metrics', {
        p_store_id: effectiveStoreId ?? undefined,
        p_date_from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        p_date_to: new Date().toISOString()
      })

    if (error) {
      console.error('Error fetching dashboard metrics:', error)
      return { success: false, error: error.message }
    }

    // Get low stock count
    const { count: lowStockCount } = await supabase
      .from('product_inventory')
      .select('id', { count: 'exact', head: true })
      .lte('quantity', 10) // Using a default threshold
      .filter(effectiveStoreId ? 'store_id' : 'id', effectiveStoreId ? 'eq' : 'neq', effectiveStoreId || '00000000-0000-0000-0000-000000000000')

    // Cast JSON response to expected shape
    const metricsData = data as {
      totalRevenue?: number
      todayRevenue?: number
      yesterdayRevenue?: number
      weekRevenue?: number
      lastWeekRevenue?: number
      monthRevenue?: number
      totalTransactions?: number
      todayTransactions?: number
      avgTransactionValue?: number
      refundCount?: number
      refundRate?: number
    } | null

    const metrics: DashboardMetrics = {
      totalRevenue: Number(metricsData?.totalRevenue || 0),
      todayRevenue: Number(metricsData?.todayRevenue || 0),
      yesterdayRevenue: Number(metricsData?.yesterdayRevenue || 0),
      weekRevenue: Number(metricsData?.weekRevenue || 0),
      lastWeekRevenue: Number(metricsData?.lastWeekRevenue || 0),
      monthRevenue: Number(metricsData?.monthRevenue || 0),
      totalTransactions: Number(metricsData?.totalTransactions || 0),
      todayTransactions: Number(metricsData?.todayTransactions || 0),
      avgTransactionValue: Number(metricsData?.avgTransactionValue || 0),
      refundCount: Number(metricsData?.refundCount || 0),
      refundRate: Number(metricsData?.refundRate || 0),
      lowStockCount: lowStockCount || 0,
    }

    return { success: true, data: metrics }
  } catch (error) {
    console.error('Error in getDashboardMetrics:', error)
    return { success: false, error: 'Failed to fetch dashboard metrics' }
  }
}

/**
 * Get revenue trend data for charts
 */
export async function getRevenueTrend(
  storeId?: string,
  days: number = 30,
  groupBy: 'daily' | 'weekly' | 'monthly' = 'daily'
): Promise<ActionResult<RevenueTrend[]>> {
  try {
    const supabase = await createClient()

    // Get authenticated user and effective store ID
    const { error: authError, effectiveStoreId } = await getActionContext(storeId)
    if (authError) {
      return { success: false, error: authError }
    }

    // Calculate date range
    const dateFrom = new Date()
    dateFrom.setDate(dateFrom.getDate() - days)
    const dateTo = new Date()

    // Call the database function
    const { data, error } = await supabase
      .rpc('get_sales_trend', {
        p_store_id: effectiveStoreId ?? undefined,
        p_date_from: dateFrom.toISOString().split('T')[0],
        p_date_to: dateTo.toISOString().split('T')[0],
        p_group_by: groupBy
      })

    if (error) {
      console.error('Error fetching revenue trend:', error)
      return { success: false, error: error.message }
    }

    const trends: RevenueTrend[] = (data || []).map((row: {
      period: string
      period_start: string
      transaction_count: number
      total_revenue: number
      avg_transaction: number
      refund_count: number
    }) => ({
      period: row.period,
      periodStart: row.period_start,
      transactionCount: Number(row.transaction_count),
      totalRevenue: Number(row.total_revenue),
      avgTransaction: Number(row.avg_transaction),
      refundCount: Number(row.refund_count),
    }))

    return { success: true, data: trends }
  } catch (error) {
    console.error('Error in getRevenueTrend:', error)
    return { success: false, error: 'Failed to fetch revenue trend' }
  }
}

/**
 * Get top selling products
 */
export async function getTopProducts(
  storeId?: string,
  limit: number = 5,
  days: number = 30
): Promise<ActionResult<TopProduct[]>> {
  try {
    const supabase = await createClient()

    // Get authenticated user and effective store ID
    const { error: authError, effectiveStoreId } = await getActionContext(storeId)
    if (authError) {
      return { success: false, error: authError }
    }

    // Calculate date range
    const dateFrom = new Date()
    dateFrom.setDate(dateFrom.getDate() - days)
    const dateTo = new Date()

    // Call the database function
    const { data, error } = await supabase
      .rpc('get_top_products', {
        p_store_id: effectiveStoreId ?? undefined,
        p_date_from: dateFrom.toISOString().split('T')[0],
        p_date_to: dateTo.toISOString().split('T')[0],
        p_limit: limit
      })

    if (error) {
      console.error('Error fetching top products:', error)
      return { success: false, error: error.message }
    }

    const products: TopProduct[] = (data || []).map((row: {
      product_id: string
      product_name: string
      sku: string
      category_name: string | null
      units_sold: number
      total_revenue: number
      avg_price: number
    }) => ({
      productId: row.product_id,
      productName: row.product_name,
      sku: row.sku,
      categoryName: row.category_name,
      unitsSold: Number(row.units_sold),
      totalRevenue: Number(row.total_revenue),
      avgPrice: Number(row.avg_price),
    }))

    return { success: true, data: products }
  } catch (error) {
    console.error('Error in getTopProducts:', error)
    return { success: false, error: 'Failed to fetch top products' }
  }
}

/**
 * Get low stock alerts
 */
export async function getLowStockAlerts(storeId?: string): Promise<ActionResult<LowStockAlert[]>> {
  try {
    const supabase = await createClient()

    // Get authenticated user and effective store ID
    const { error: authError, effectiveStoreId } = await getActionContext(storeId)
    if (authError) {
      return { success: false, error: authError }
    }

    // Call the database function
    const { data, error } = await supabase
      .rpc('get_low_stock_alerts', {
        p_store_id: effectiveStoreId ?? undefined
      })

    if (error) {
      console.error('Error fetching low stock alerts:', error)
      return { success: false, error: error.message }
    }

    const alerts: LowStockAlert[] = (data || []).map((row: {
      inventory_id: string
      product_id: string
      product_name: string
      sku: string
      quantity: number
      min_stock_level: number
      store_id: string
      store_name: string
      stock_status: string
    }) => ({
      inventoryId: row.inventory_id,
      productId: row.product_id,
      productName: row.product_name,
      sku: row.sku,
      quantity: Number(row.quantity),
      minStockLevel: Number(row.min_stock_level),
      storeId: row.store_id,
      storeName: row.store_name,
      stockStatus: row.stock_status as 'out_of_stock' | 'low_stock',
    }))

    return { success: true, data: alerts }
  } catch (error) {
    console.error('Error in getLowStockAlerts:', error)
    return { success: false, error: 'Failed to fetch low stock alerts' }
  }
}
