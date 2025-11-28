/**
 * IndexedDB Schema Definitions for Offline POS
 * Defines TypeScript interfaces for all IndexedDB object stores
 */

import type { DBSchema } from 'idb'

// ============================================
// Cached Product (from server)
// ============================================
export interface CachedProduct {
  id: string // product_templates.id
  sku: string
  name: string
  price: number
  barcode: string | null
  imageUrl: string | null
  category: { id: string; name: string } | null
  inventoryId: string // product_inventory.id
  serverStock: number // Stock from server at last sync
  localStock: number // Current local stock (after reservations)
  reservedStock: number // Amount reserved by pending transactions
  cachedAt: Date
  storeId: string
}

// ============================================
// Pending Transaction (offline sale)
// ============================================
export type TransactionStatus = 'pending' | 'syncing' | 'synced' | 'conflict' | 'failed'
export type PaymentMethod = 'cash' | 'card' | 'mobile' | 'other'

export interface PendingTransactionItem {
  productId: string
  inventoryId: string
  name: string
  sku: string
  quantity: number
  requestedQuantity: number // Original requested (for conflict resolution)
  price: number
  discount: number
}

// ============================================
// Offline Receipt Data (for local ticket generation)
// ============================================
export interface OfflineReceiptData {
  store: {
    name: string
    address: string | null
    phone: string | null
  }
  cashier: {
    full_name: string | null
  }
}

export interface PendingTransaction {
  id: string // Local UUID (crypto.randomUUID())
  localReceiptNumber: string // Format: OFF-{timestamp}
  storeId: string
  cashierId: string
  sessionId: string | null
  customerId: string | null
  items: PendingTransactionItem[]
  subtotal: number
  tax: number
  discount: number
  total: number
  paymentMethod: PaymentMethod
  notes: string
  createdAt: Date
  status: TransactionStatus
  syncAttempts: number
  lastSyncAttempt: Date | null
  syncError: string | null
  serverSaleId: string | null // Populated after successful sync
  serverSaleNumber: string | null // Populated after successful sync
  conflictResolution: ConflictResolution | null
  receiptData: OfflineReceiptData | null // Store/cashier info for offline receipt generation
}

// ============================================
// Conflict Resolution
// ============================================
export type ConflictType = 'stock_shortage' | 'product_unavailable' | 'price_change'

export interface ConflictItem {
  productId: string
  productName: string
  requestedQuantity: number
  fulfilledQuantity: number
  serverStock: number
  priceAtSale: number
  refundForItem: number
}

export interface ConflictResolution {
  type: ConflictType
  items: ConflictItem[]
  originalTotal: number
  adjustedTotal: number
  refundAmount: number
  message: string
  acknowledgedAt: Date | null
  acknowledgedBy: string | null
}

// ============================================
// Sync Queue Item
// ============================================
export type SyncItemType = 'transaction' | 'inventory_adjustment' | 'customer'

export interface SyncQueueItem {
  id: string
  type: SyncItemType
  referenceId: string // ID of the item to sync
  priority: number // Higher = more urgent
  status: 'pending' | 'syncing' | 'completed' | 'failed'
  attempts: number
  maxAttempts: number
  createdAt: Date
  lastAttempt: Date | null
  error: string | null
}

// ============================================
// Local Inventory Reservation
// ============================================
export interface InventoryReservation {
  id: string // productId
  transactionId: string
  quantity: number
  createdAt: Date
}

// ============================================
// Database Metadata
// ============================================
export interface DatabaseMetadata {
  key: string
  value: {
    lastProductSync: Date | null
    lastTransactionSync: Date | null
    version: number
    storeId: string | null
    userId: string | null
  }
}

// ============================================
// IndexedDB Schema (for idb library)
// ============================================
export interface OfflineDBSchema extends DBSchema {
  products: {
    key: string
    value: CachedProduct
    indexes: {
      'by-sku': string
      'by-barcode': string
      'by-name': string
      'by-store': string
    }
  }
  transactions: {
    key: string
    value: PendingTransaction
    indexes: {
      'by-status': TransactionStatus
      'by-created': Date
      'by-store': string
    }
  }
  reservations: {
    key: string // composite: productId-transactionId
    value: InventoryReservation
    indexes: {
      'by-product': string
      'by-transaction': string
    }
  }
  syncQueue: {
    key: string
    value: SyncQueueItem
    indexes: {
      'by-priority': number
      'by-status': string
      'by-type': SyncItemType
    }
  }
  metadata: {
    key: string
    value: DatabaseMetadata['value']
  }
}

// ============================================
// Sync Report Types
// ============================================
export interface SyncTransactionResult {
  localId: string
  localReceiptNumber: string
  status: 'success' | 'conflict' | 'failed'
  serverSaleId?: string
  serverSaleNumber?: string
  conflict?: ConflictResolution
  error?: string
}

export interface SyncReport {
  startedAt: Date
  completedAt: Date
  totalTransactions: number
  successful: number
  conflicts: number
  failed: number
  details: SyncTransactionResult[]
}

// ============================================
// Constants
// ============================================
export const DB_NAME = 'next-stock-offline'
export const DB_VERSION = 1
export const MAX_SYNC_ATTEMPTS = 5
export const SYNC_BATCH_SIZE = 10
