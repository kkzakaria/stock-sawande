/**
 * Receipt Utilities for Offline POS
 * Converts PendingTransaction to ReceiptData for offline receipt generation
 */

import type { PendingTransaction } from './db-schema'
import type { ReceiptData, ReceiptItem } from '@/components/pos/pos-receipt'

/**
 * Build ReceiptData from a PendingTransaction stored in IndexedDB
 * This allows receipt generation without server connectivity
 */
export function buildReceiptFromTransaction(tx: PendingTransaction): ReceiptData {
  // Handle Date serialization (IndexedDB may store as string after persistence)
  const createdAt =
    tx.createdAt instanceof Date
      ? tx.createdAt.toISOString()
      : new Date(tx.createdAt).toISOString()

  // Convert transaction items to receipt items format
  const saleItems: ReceiptItem[] = tx.items.map((item) => ({
    product: {
      name: item.name,
      sku: item.sku,
    },
    quantity: item.quantity,
    unit_price: item.price,
    subtotal: item.quantity * item.price - item.discount,
    discount: item.discount > 0 ? item.discount : null,
  }))

  return {
    id: tx.id,
    sale_number: tx.localReceiptNumber,
    subtotal: tx.subtotal,
    tax: tx.tax,
    discount: tx.discount > 0 ? tx.discount : null,
    total: tx.total,
    payment_method: tx.paymentMethod,
    created_at: createdAt,
    notes: tx.notes || null,
    store: tx.receiptData?.store || {
      name: 'Store',
      address: null,
      phone: null,
    },
    cashier: tx.receiptData?.cashier || {
      full_name: null,
    },
    sale_items: saleItems,
  }
}
