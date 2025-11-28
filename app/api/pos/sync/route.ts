/**
 * Batch Sync API Endpoint
 * Processes offline transactions and returns results with conflict resolution
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveTransactionConflicts } from '@/lib/offline/conflict-resolver'
import type { PendingTransactionItem } from '@/lib/offline/db-schema'

// ============================================
// Types
// ============================================

interface SyncTransactionRequest {
  localId: string
  localReceiptNumber: string
  storeId: string
  cashierId: string
  sessionId: string | null
  customerId: string | null
  items: Array<{
    productId: string
    inventoryId: string
    quantity: number
    price: number
    discount: number
  }>
  subtotal: number
  tax: number
  discount: number
  total: number
  paymentMethod: string
  notes: string
  createdAt: string
}

interface SyncResult {
  localId: string
  status: 'success' | 'conflict' | 'failed'
  serverSaleId?: string
  serverSaleNumber?: string
  conflict?: {
    type: string
    items: Array<{
      productId: string
      productName: string
      requestedQuantity: number
      fulfilledQuantity: number
      serverStock: number
      priceAtSale: number
      refundForItem: number
    }>
    originalTotal: number
    adjustedTotal: number
    refundAmount: number
    message: string
  }
  error?: string
}

// ============================================
// POST Handler
// ============================================

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { transactions } = body as { transactions: SyncTransactionRequest[] }

    if (!transactions || !Array.isArray(transactions)) {
      return NextResponse.json(
        { error: 'Invalid request: transactions array required' },
        { status: 400 }
      )
    }

    const results: SyncResult[] = []

    // Process each transaction
    for (const tx of transactions) {
      try {
        const result = await processTransaction(supabase, tx, user.id)
        results.push(result)
      } catch (error) {
        results.push({
          localId: tx.localId,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return NextResponse.json({ results })
  } catch (error) {
    console.error('Sync error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// ============================================
// Process Single Transaction
// ============================================

async function processTransaction(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tx: SyncTransactionRequest,
  userId: string
): Promise<SyncResult> {
  // Verify user has access to this store
  const { data: profile } = await supabase
    .from('profiles')
    .select('store_id, role')
    .eq('id', userId)
    .single()

  if (!profile || profile.store_id !== tx.storeId) {
    return {
      localId: tx.localId,
      status: 'failed',
      error: 'Unauthorized: user not assigned to this store',
    }
  }

  // Get current inventory levels for all items
  const productIds = tx.items.map((item) => item.productId)
  const { data: inventoryData, error: inventoryError } = await supabase
    .from('product_inventory')
    .select('id, product_id, quantity, product_templates(name)')
    .in('product_id', productIds)
    .eq('store_id', tx.storeId)

  if (inventoryError) {
    return {
      localId: tx.localId,
      status: 'failed',
      error: `Failed to check inventory: ${inventoryError.message}`,
    }
  }

  // Build inventory map
  const inventoryMap = new Map(
    inventoryData?.map((inv) => [
      inv.product_id,
      {
        inventoryId: inv.id,
        quantity: inv.quantity,
        productName: (inv.product_templates as { name: string })?.name || 'Unknown',
      },
    ]) ?? []
  )

  // Convert transaction items for conflict resolution
  const txItems: PendingTransactionItem[] = tx.items.map((item) => {
    const inv = inventoryMap.get(item.productId)
    return {
      productId: item.productId,
      inventoryId: item.inventoryId,
      name: inv?.productName || 'Unknown',
      sku: '',
      quantity: item.quantity,
      requestedQuantity: item.quantity,
      price: item.price,
      discount: item.discount,
    }
  })

  // Build inventory status for conflict resolution
  const inventoryStatus = tx.items.map((item) => {
    const inv = inventoryMap.get(item.productId)
    return {
      productId: item.productId,
      inventoryId: item.inventoryId,
      currentStock: inv?.quantity ?? 0,
      productName: inv?.productName || 'Unknown',
    }
  })

  // Resolve conflicts
  const resolution = resolveTransactionConflicts(txItems, inventoryStatus, tx.total)

  // Calculate adjusted totals based on resolution
  let adjustedItems = tx.items
  let adjustedSubtotal = tx.subtotal
  let adjustedTotal = tx.total

  if (resolution.hasConflicts && resolution.conflict) {
    adjustedItems = resolution.resolvedItems
      .filter((r) => r.fulfilledQuantity > 0)
      .map((r) => ({
        productId: r.item.productId,
        inventoryId: r.item.inventoryId,
        quantity: r.fulfilledQuantity,
        price: r.item.price,
        discount: r.item.discount,
      }))

    adjustedSubtotal = resolution.adjustedTotal
    adjustedTotal = resolution.adjustedTotal + tx.tax - tx.discount
  }

  // Skip if no items can be fulfilled
  if (adjustedItems.length === 0) {
    return {
      localId: tx.localId,
      status: 'conflict',
      conflict: resolution.conflict
        ? {
            type: resolution.conflict.type,
            items: resolution.conflict.items,
            originalTotal: resolution.conflict.originalTotal,
            adjustedTotal: 0,
            refundAmount: tx.total,
            message: 'No items could be fulfilled. Full refund required.',
          }
        : undefined,
    }
  }

  // Generate sale number
  const saleNumber = `SYNC-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`

  // Create sale record
  const { data: sale, error: saleError } = await supabase
    .from('sales')
    .insert({
      store_id: tx.storeId,
      cashier_id: tx.cashierId,
      customer_id: tx.customerId,
      session_id: tx.sessionId,
      sale_number: saleNumber,
      subtotal: adjustedSubtotal,
      tax: tx.tax,
      discount: tx.discount,
      total: adjustedTotal,
      payment_method: tx.paymentMethod,
      status: 'completed',
      notes: tx.notes ? `${tx.notes} [Synced from offline: ${tx.localReceiptNumber}]` : `[Synced from offline: ${tx.localReceiptNumber}]`,
    })
    .select('id, sale_number')
    .single()

  if (saleError || !sale) {
    return {
      localId: tx.localId,
      status: 'failed',
      error: `Failed to create sale: ${saleError?.message}`,
    }
  }

  // Create sale items
  const saleItems = adjustedItems.map((item) => ({
    sale_id: sale.id,
    product_id: item.productId,
    inventory_id: item.inventoryId,
    quantity: item.quantity,
    unit_price: item.price,
    discount: item.discount,
    subtotal: item.price * item.quantity - item.discount,
  }))

  const { error: itemsError } = await supabase.from('sale_items').insert(saleItems)

  if (itemsError) {
    // Rollback: delete the sale
    await supabase.from('sales').delete().eq('id', sale.id)
    return {
      localId: tx.localId,
      status: 'failed',
      error: `Failed to create sale items: ${itemsError.message}`,
    }
  }

  // Update inventory (deduct stock)
  for (const item of adjustedItems) {
    const { data: currentInv } = await supabase
      .from('product_inventory')
      .select('quantity')
      .eq('id', item.inventoryId)
      .single()

    if (currentInv) {
      const { error: updateError } = await supabase
        .from('product_inventory')
        .update({ quantity: Math.max(0, currentInv.quantity - item.quantity) })
        .eq('id', item.inventoryId)

      if (updateError) {
        console.error(`Failed to update inventory for ${item.productId}:`, updateError)
      }
    }
  }

  // Update cash session if provided
  if (tx.sessionId) {
    const { data: currentSession } = await supabase
      .from('cash_sessions')
      .select('total_cash_sales, total_card_sales, total_mobile_sales, transaction_count')
      .eq('id', tx.sessionId)
      .single()

    if (currentSession) {
      const updates: Record<string, number> = {
        transaction_count: (currentSession.transaction_count || 0) + 1,
      }

      if (tx.paymentMethod === 'cash') {
        updates.total_cash_sales = (currentSession.total_cash_sales || 0) + adjustedTotal
      } else if (tx.paymentMethod === 'card') {
        updates.total_card_sales = (currentSession.total_card_sales || 0) + adjustedTotal
      } else if (tx.paymentMethod === 'mobile') {
        updates.total_mobile_sales = (currentSession.total_mobile_sales || 0) + adjustedTotal
      }

      await supabase
        .from('cash_sessions')
        .update(updates)
        .eq('id', tx.sessionId)
    }
  }

  // Return result
  if (resolution.hasConflicts && resolution.conflict) {
    return {
      localId: tx.localId,
      status: 'conflict',
      serverSaleId: sale.id,
      serverSaleNumber: sale.sale_number,
      conflict: {
        type: resolution.conflict.type,
        items: resolution.conflict.items,
        originalTotal: resolution.conflict.originalTotal,
        adjustedTotal: resolution.conflict.adjustedTotal,
        refundAmount: resolution.conflict.refundAmount,
        message: resolution.conflict.message,
      },
    }
  }

  return {
    localId: tx.localId,
    status: 'success',
    serverSaleId: sale.id,
    serverSaleNumber: sale.sale_number,
  }
}
