'use server'

import { createClient } from '@/lib/supabase/server'
import type { ReportFilters } from '@/lib/types/filters'

// Types
interface ActionResult<T = unknown> {
  success: boolean
  error?: string
  data?: T
}

// Sales Report Types
export interface SalesReportSummary {
  totalRevenue: number
  totalTransactions: number
  avgTransactionValue: number
  refundCount: number
  refundRate: number
  totalTax: number
  totalDiscount: number
}

export interface SalesTrendItem {
  period: string
  periodStart: string
  revenue: number
  transactions: number
  avgTransaction: number
  refundCount: number
}

export interface PaymentBreakdownItem {
  method: string
  count: number
  total: number
  percentage: number
}

export interface TopProductItem {
  productId: string
  name: string
  sku: string
  categoryName: string | null
  unitsSold: number
  revenue: number
  avgPrice: number
}

export interface SalesReportData {
  summary: SalesReportSummary
  trend: SalesTrendItem[]
  paymentBreakdown: PaymentBreakdownItem[]
  topProducts: TopProductItem[]
}

// Inventory Report Types
export interface InventoryReportSummary {
  totalProducts: number
  totalStockValue: number
  lowStockCount: number
  outOfStockCount: number
  inStockCount: number
}

export interface StockLevelItem {
  inventoryId: string
  productId: string
  name: string
  sku: string
  categoryName: string | null
  storeId: string
  storeName: string
  quantity: number
  minStockLevel: number
  stockValue: number
  status: 'in_stock' | 'low_stock' | 'out_of_stock'
}

export interface CategoryBreakdownItem {
  category: string
  productCount: number
  totalQuantity: number
  totalValue: number
}

export interface InventoryReportData {
  summary: InventoryReportSummary
  stockLevels: StockLevelItem[]
  categoryBreakdown: CategoryBreakdownItem[]
}

// Performance Report Types
export interface StoreComparisonItem {
  storeId: string
  storeName: string
  revenue: number
  transactions: number
  avgTransaction: number
  refundCount: number
  refundRate: number
}

export interface CashierPerformanceItem {
  cashierId: string
  cashierName: string
  cashierEmail: string
  storeId: string
  storeName: string
  transactions: number
  totalSales: number
  avgTransaction: number
  refundCount: number
}

export interface PerformanceReportData {
  storeComparison: StoreComparisonItem[]
  cashierPerformance: CashierPerformanceItem[]
}

/**
 * Get sales report data
 */
export async function getSalesReport(filters: ReportFilters): Promise<ActionResult<SalesReportData>> {
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

    // Cashiers cannot access reports
    if (profile.role === 'cashier') {
      return { success: false, error: 'Access denied' }
    }

    // Determine effective store ID
    let effectiveStoreId = filters.store
    if (profile.role === 'manager' && profile.store_id) {
      effectiveStoreId = profile.store_id
    }

    // Calculate date range with defaults
    const dateFrom = filters.dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const dateTo = filters.dateTo || new Date()
    const groupBy = filters.groupBy || 'daily'

    // Get sales trend data
    const { data: trendData, error: trendError } = await supabase
      .rpc('get_sales_trend', {
        p_store_id: effectiveStoreId ?? undefined,
        p_date_from: dateFrom.toISOString().split('T')[0],
        p_date_to: dateTo.toISOString().split('T')[0],
        p_group_by: groupBy
      })

    if (trendError) {
      console.error('Error fetching sales trend:', trendError)
      return { success: false, error: trendError.message }
    }

    // Get payment breakdown
    const { data: paymentData, error: paymentError } = await supabase
      .rpc('get_payment_breakdown', {
        p_store_id: effectiveStoreId ?? undefined,
        p_date_from: dateFrom.toISOString().split('T')[0],
        p_date_to: dateTo.toISOString().split('T')[0]
      })

    if (paymentError) {
      console.error('Error fetching payment breakdown:', paymentError)
      return { success: false, error: paymentError.message }
    }

    // Get top products
    const { data: topProductsData, error: topProductsError } = await supabase
      .rpc('get_top_products', {
        p_store_id: effectiveStoreId ?? undefined,
        p_date_from: dateFrom.toISOString().split('T')[0],
        p_date_to: dateTo.toISOString().split('T')[0],
        p_limit: 10
      })

    if (topProductsError) {
      console.error('Error fetching top products:', topProductsError)
      return { success: false, error: topProductsError.message }
    }

    // Calculate summary from trend data
    const trend: SalesTrendItem[] = (trendData || []).map((row: {
      period: string
      period_start: string
      transaction_count: number
      total_revenue: number
      avg_transaction: number
      refund_count: number
    }) => ({
      period: row.period,
      periodStart: row.period_start,
      revenue: Number(row.total_revenue),
      transactions: Number(row.transaction_count),
      avgTransaction: Number(row.avg_transaction),
      refundCount: Number(row.refund_count),
    }))

    const totalRevenue = trend.reduce((sum, t) => sum + t.revenue, 0)
    const totalTransactions = trend.reduce((sum, t) => sum + t.transactions, 0)
    const totalRefunds = trend.reduce((sum, t) => sum + t.refundCount, 0)

    const summary: SalesReportSummary = {
      totalRevenue,
      totalTransactions,
      avgTransactionValue: totalTransactions > 0 ? totalRevenue / totalTransactions : 0,
      refundCount: totalRefunds,
      refundRate: totalTransactions > 0 ? (totalRefunds / (totalTransactions + totalRefunds)) * 100 : 0,
      totalTax: 0, // Would need separate query
      totalDiscount: 0, // Would need separate query
    }

    const paymentBreakdown: PaymentBreakdownItem[] = (paymentData || []).map((row: {
      payment_method: string
      transaction_count: number
      total_amount: number
      percentage: number
    }) => ({
      method: row.payment_method,
      count: Number(row.transaction_count),
      total: Number(row.total_amount),
      percentage: Number(row.percentage),
    }))

    const topProducts: TopProductItem[] = (topProductsData || []).map((row: {
      product_id: string
      product_name: string
      sku: string
      category_name: string | null
      units_sold: number
      total_revenue: number
      avg_price: number
    }) => ({
      productId: row.product_id,
      name: row.product_name,
      sku: row.sku,
      categoryName: row.category_name,
      unitsSold: Number(row.units_sold),
      revenue: Number(row.total_revenue),
      avgPrice: Number(row.avg_price),
    }))

    return {
      success: true,
      data: {
        summary,
        trend,
        paymentBreakdown,
        topProducts,
      },
    }
  } catch (error) {
    console.error('Error in getSalesReport:', error)
    return { success: false, error: 'Failed to fetch sales report' }
  }
}

/**
 * Get inventory report data
 */
export async function getInventoryReport(filters: ReportFilters): Promise<ActionResult<InventoryReportData>> {
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

    // Cashiers cannot access reports
    if (profile.role === 'cashier') {
      return { success: false, error: 'Access denied' }
    }

    // Determine effective store ID
    let effectiveStoreId = filters.store
    if (profile.role === 'manager' && profile.store_id) {
      effectiveStoreId = profile.store_id
    }

    // Get inventory report data
    const { data: inventoryData, error: inventoryError } = await supabase
      .rpc('get_inventory_report', {
        p_store_id: effectiveStoreId ?? undefined
      })

    if (inventoryError) {
      console.error('Error fetching inventory report:', inventoryError)
      return { success: false, error: inventoryError.message }
    }

    // Transform data
    const stockLevels: StockLevelItem[] = (inventoryData || []).map((row: {
      inventory_id: string
      product_id: string
      product_name: string
      sku: string
      category_name: string | null
      store_id: string
      store_name: string
      quantity: number
      min_stock_level: number
      stock_value: number
      stock_status: string
    }) => ({
      inventoryId: row.inventory_id,
      productId: row.product_id,
      name: row.product_name,
      sku: row.sku,
      categoryName: row.category_name,
      storeId: row.store_id,
      storeName: row.store_name,
      quantity: Number(row.quantity),
      minStockLevel: Number(row.min_stock_level),
      stockValue: Number(row.stock_value),
      status: row.stock_status as 'in_stock' | 'low_stock' | 'out_of_stock',
    }))

    // Calculate summary
    const summary: InventoryReportSummary = {
      totalProducts: stockLevels.length,
      totalStockValue: stockLevels.reduce((sum, item) => sum + item.stockValue, 0),
      lowStockCount: stockLevels.filter(item => item.status === 'low_stock').length,
      outOfStockCount: stockLevels.filter(item => item.status === 'out_of_stock').length,
      inStockCount: stockLevels.filter(item => item.status === 'in_stock').length,
    }

    // Calculate category breakdown
    const categoryMap = new Map<string, { productCount: number; totalQuantity: number; totalValue: number }>()
    for (const item of stockLevels) {
      const category = item.categoryName || 'Uncategorized'
      const existing = categoryMap.get(category) || { productCount: 0, totalQuantity: 0, totalValue: 0 }
      categoryMap.set(category, {
        productCount: existing.productCount + 1,
        totalQuantity: existing.totalQuantity + item.quantity,
        totalValue: existing.totalValue + item.stockValue,
      })
    }

    const categoryBreakdown: CategoryBreakdownItem[] = Array.from(categoryMap.entries()).map(([category, data]) => ({
      category,
      productCount: data.productCount,
      totalQuantity: data.totalQuantity,
      totalValue: data.totalValue,
    }))

    return {
      success: true,
      data: {
        summary,
        stockLevels,
        categoryBreakdown,
      },
    }
  } catch (error) {
    console.error('Error in getInventoryReport:', error)
    return { success: false, error: 'Failed to fetch inventory report' }
  }
}

/**
 * Get performance report data
 */
export async function getPerformanceReport(filters: ReportFilters): Promise<ActionResult<PerformanceReportData>> {
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

    // Cashiers cannot access reports
    if (profile.role === 'cashier') {
      return { success: false, error: 'Access denied' }
    }

    // Determine effective store ID
    let effectiveStoreId = filters.store
    if (profile.role === 'manager' && profile.store_id) {
      effectiveStoreId = profile.store_id
    }

    // Calculate date range with defaults
    const dateFrom = filters.dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const dateTo = filters.dateTo || new Date()

    // Get store comparison (only for admins)
    let storeComparison: StoreComparisonItem[] = []
    if (profile.role === 'admin') {
      const { data: storeData, error: storeError } = await supabase
        .rpc('get_store_comparison', {
          p_date_from: dateFrom.toISOString().split('T')[0],
          p_date_to: dateTo.toISOString().split('T')[0]
        })

      if (storeError) {
        console.error('Error fetching store comparison:', storeError)
      } else {
        storeComparison = (storeData || []).map((row: {
          store_id: string
          store_name: string
          transaction_count: number
          total_revenue: number
          avg_transaction: number
          refund_count: number
          refund_rate: number
        }) => ({
          storeId: row.store_id,
          storeName: row.store_name,
          revenue: Number(row.total_revenue),
          transactions: Number(row.transaction_count),
          avgTransaction: Number(row.avg_transaction),
          refundCount: Number(row.refund_count),
          refundRate: Number(row.refund_rate || 0),
        }))
      }
    }

    // Get cashier performance
    const { data: cashierData, error: cashierError } = await supabase
      .rpc('get_cashier_performance', {
        p_store_id: effectiveStoreId ?? undefined,
        p_date_from: dateFrom.toISOString().split('T')[0],
        p_date_to: dateTo.toISOString().split('T')[0]
      })

    if (cashierError) {
      console.error('Error fetching cashier performance:', cashierError)
      return { success: false, error: cashierError.message }
    }

    const cashierPerformance: CashierPerformanceItem[] = (cashierData || []).map((row: {
      cashier_id: string
      cashier_name: string
      cashier_email: string
      store_id: string
      store_name: string
      transaction_count: number
      total_sales: number
      avg_transaction: number
      refund_count: number
    }) => ({
      cashierId: row.cashier_id,
      cashierName: row.cashier_name,
      cashierEmail: row.cashier_email,
      storeId: row.store_id,
      storeName: row.store_name,
      transactions: Number(row.transaction_count),
      totalSales: Number(row.total_sales),
      avgTransaction: Number(row.avg_transaction),
      refundCount: Number(row.refund_count),
    }))

    return {
      success: true,
      data: {
        storeComparison,
        cashierPerformance,
      },
    }
  } catch (error) {
    console.error('Error in getPerformanceReport:', error)
    return { success: false, error: 'Failed to fetch performance report' }
  }
}
