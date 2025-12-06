/**
 * Conflict Resolution Service
 * Handles stock conflicts when syncing offline transactions
 */

import type {
  ConflictResolution,
  ConflictItem,
  ConflictType,
  PendingTransactionItem,
} from './db-schema'

// ============================================
// Types
// ============================================

export interface ServerInventoryStatus {
  productId: string
  inventoryId: string
  currentStock: number
  productName: string
}

export interface ResolvedItem {
  item: PendingTransactionItem
  fulfilledQuantity: number
  refundAmount: number
  hasConflict: boolean
}

export interface ResolutionResult {
  hasConflicts: boolean
  resolvedItems: ResolvedItem[]
  conflict: ConflictResolution | null
  adjustedTotal: number
  refundAmount: number
}

// ============================================
// Conflict Resolution Functions
// ============================================

/**
 * Resolve inventory conflicts for a transaction
 */
export function resolveTransactionConflicts(
  items: PendingTransactionItem[],
  inventoryStatus: ServerInventoryStatus[],
  originalTotal: number
): ResolutionResult {
  const resolvedItems: ResolvedItem[] = []
  const conflictItems: ConflictItem[] = []
  let totalRefund = 0
  let adjustedSubtotal = 0

  // Create inventory lookup map
  const inventoryMap = new Map(
    inventoryStatus.map((inv) => [inv.productId, inv])
  )

  for (const item of items) {
    const inventory = inventoryMap.get(item.productId)
    const serverStock = inventory?.currentStock ?? 0

    if (serverStock >= item.requestedQuantity) {
      // Full fulfillment
      resolvedItems.push({
        item: { ...item, quantity: item.requestedQuantity },
        fulfilledQuantity: item.requestedQuantity,
        refundAmount: 0,
        hasConflict: false,
      })
      adjustedSubtotal += item.price * item.requestedQuantity - item.discount
    } else if (serverStock > 0) {
      // Partial fulfillment
      const unfulfilled = item.requestedQuantity - serverStock
      const refundForItem = unfulfilled * item.price

      resolvedItems.push({
        item: { ...item, quantity: serverStock },
        fulfilledQuantity: serverStock,
        refundAmount: refundForItem,
        hasConflict: true,
      })

      conflictItems.push({
        productId: item.productId,
        productName: item.name,
        requestedQuantity: item.requestedQuantity,
        fulfilledQuantity: serverStock,
        serverStock,
        priceAtSale: item.price,
        refundForItem,
      })

      totalRefund += refundForItem
      adjustedSubtotal += item.price * serverStock - item.discount
    } else {
      // No stock available
      const refundForItem = item.requestedQuantity * item.price - item.discount

      resolvedItems.push({
        item: { ...item, quantity: 0 },
        fulfilledQuantity: 0,
        refundAmount: refundForItem,
        hasConflict: true,
      })

      conflictItems.push({
        productId: item.productId,
        productName: item.name,
        requestedQuantity: item.requestedQuantity,
        fulfilledQuantity: 0,
        serverStock: 0,
        priceAtSale: item.price,
        refundForItem,
      })

      totalRefund += refundForItem
    }
  }

  const hasConflicts = conflictItems.length > 0
  let conflict: ConflictResolution | null = null

  if (hasConflicts) {
    const conflictType = determineConflictType(conflictItems)
    conflict = {
      type: conflictType,
      items: conflictItems,
      originalTotal,
      adjustedTotal: adjustedSubtotal,
      refundAmount: totalRefund,
      message: generateConflictMessage(conflictType, conflictItems),
      acknowledgedAt: null,
      acknowledgedBy: null,
    }
  }

  return {
    hasConflicts,
    resolvedItems,
    conflict,
    adjustedTotal: adjustedSubtotal,
    refundAmount: totalRefund,
  }
}

/**
 * Determine the type of conflict based on items
 */
function determineConflictType(items: ConflictItem[]): ConflictType {
  const hasUnavailable = items.some((item) => item.fulfilledQuantity === 0)
  const hasPartial = items.some(
    (item) => item.fulfilledQuantity > 0 && item.fulfilledQuantity < item.requestedQuantity
  )

  if (hasUnavailable && !hasPartial) {
    return 'product_unavailable'
  }
  return 'stock_shortage'
}

/**
 * Generate a user-friendly conflict message
 */
function generateConflictMessage(type: ConflictType, items: ConflictItem[]): string {
  if (type === 'product_unavailable') {
    const productNames = items
      .filter((i) => i.fulfilledQuantity === 0)
      .map((i) => i.productName)
      .join(', ')
    return `The following products are no longer available: ${productNames}. A refund has been calculated.`
  }

  if (type === 'stock_shortage') {
    const shortages = items
      .map((i) => `${i.productName} (${i.fulfilledQuantity}/${i.requestedQuantity})`)
      .join(', ')
    return `Stock was insufficient for: ${shortages}. Quantities have been adjusted and a partial refund calculated.`
  }

  return 'Some items had stock issues. Please review the adjusted order.'
}

/**
 * Format currency for display
 */
export function formatRefundAmount(amount: number): string {
  const formatted = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
  return `${formatted} CFA`
}

/**
 * Check if a conflict can be auto-resolved (no user action needed)
 */
export function canAutoResolve(conflict: ConflictResolution): boolean {
  // Auto-resolve if refund is small (< $5) and all items are partially fulfilled
  return (
    conflict.refundAmount < 5 &&
    conflict.items.every((item) => item.fulfilledQuantity > 0)
  )
}

/**
 * Mark a conflict as acknowledged
 */
export function acknowledgeConflict(
  conflict: ConflictResolution,
  userId: string
): ConflictResolution {
  return {
    ...conflict,
    acknowledgedAt: new Date(),
    acknowledgedBy: userId,
  }
}
