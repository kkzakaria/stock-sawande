/**
 * IndexedDB Service Layer
 * Wrapper for IndexedDB using idb library
 * Provides CRUD operations for offline data storage
 */

import { openDB, type IDBPDatabase } from 'idb'
import {
  type OfflineDBSchema,
  type CachedProduct,
  type PendingTransaction,
  type InventoryReservation,
  type SyncQueueItem,
  type TransactionStatus,
  DB_NAME,
  DB_VERSION,
} from './db-schema'

// Singleton database instance
let dbInstance: IDBPDatabase<OfflineDBSchema> | null = null

/**
 * Initialize and get the IndexedDB database instance
 */
export async function getDB(): Promise<IDBPDatabase<OfflineDBSchema>> {
  if (dbInstance) return dbInstance

  dbInstance = await openDB<OfflineDBSchema>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      // Version 1: Initial schema
      if (oldVersion < 1) {
        // Products store
        const productStore = db.createObjectStore('products', { keyPath: 'id' })
        productStore.createIndex('by-sku', 'sku')
        productStore.createIndex('by-barcode', 'barcode')
        productStore.createIndex('by-name', 'name')
        productStore.createIndex('by-store', 'storeId')

        // Transactions store
        const txStore = db.createObjectStore('transactions', { keyPath: 'id' })
        txStore.createIndex('by-status', 'status')
        txStore.createIndex('by-created', 'createdAt')
        txStore.createIndex('by-store', 'storeId')

        // Reservations store
        const resStore = db.createObjectStore('reservations', { keyPath: 'id' })
        resStore.createIndex('by-product', 'id')
        resStore.createIndex('by-transaction', 'transactionId')

        // Sync queue store
        const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' })
        syncStore.createIndex('by-priority', 'priority')
        syncStore.createIndex('by-status', 'status')
        syncStore.createIndex('by-type', 'type')

        // Metadata store
        db.createObjectStore('metadata')
      }

      // Future migrations would go here:
      // if (oldVersion < 2) { ... }
    },
    blocked() {
      console.warn('IndexedDB upgrade blocked. Please close other tabs.')
    },
    blocking() {
      console.warn('IndexedDB blocking older version.')
      dbInstance?.close()
      dbInstance = null
    },
  })

  return dbInstance
}

// ============================================
// Products CRUD
// ============================================

/**
 * Save multiple products to cache (upsert)
 */
export async function saveProducts(products: CachedProduct[]): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('products', 'readwrite')

  await Promise.all([
    ...products.map((product) => tx.store.put(product)),
    tx.done,
  ])
}

/**
 * Get all cached products for a store
 */
export async function getProducts(storeId: string): Promise<CachedProduct[]> {
  const db = await getDB()
  const products = await db.getAllFromIndex('products', 'by-store', storeId)
  return products
}

/**
 * Get a single product by ID
 */
export async function getProduct(productId: string): Promise<CachedProduct | undefined> {
  const db = await getDB()
  return db.get('products', productId)
}

/**
 * Search products by name (case-insensitive partial match)
 */
export async function searchProducts(
  storeId: string,
  query: string
): Promise<CachedProduct[]> {
  const db = await getDB()
  const allProducts = await db.getAllFromIndex('products', 'by-store', storeId)

  const lowerQuery = query.toLowerCase()
  return allProducts.filter(
    (p) =>
      p.name.toLowerCase().includes(lowerQuery) ||
      p.sku.toLowerCase().includes(lowerQuery) ||
      (p.barcode && p.barcode.toLowerCase().includes(lowerQuery))
  )
}

/**
 * Get product by barcode
 */
export async function getProductByBarcode(barcode: string): Promise<CachedProduct | undefined> {
  const db = await getDB()
  return db.getFromIndex('products', 'by-barcode', barcode)
}

/**
 * Update local stock for a product
 */
export async function updateProductLocalStock(
  productId: string,
  localStock: number,
  reservedStock: number
): Promise<void> {
  const db = await getDB()
  const product = await db.get('products', productId)

  if (product) {
    product.localStock = localStock
    product.reservedStock = reservedStock
    await db.put('products', product)
  }
}

/**
 * Clear all products for a store
 */
export async function clearProducts(storeId: string): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('products', 'readwrite')
  const products = await tx.store.index('by-store').getAllKeys(storeId)

  await Promise.all([...products.map((key) => tx.store.delete(key)), tx.done])
}

// ============================================
// Transactions CRUD
// ============================================

/**
 * Save a pending transaction
 */
export async function saveTransaction(transaction: PendingTransaction): Promise<void> {
  const db = await getDB()
  await db.put('transactions', transaction)
}

/**
 * Get a transaction by ID
 */
export async function getTransaction(id: string): Promise<PendingTransaction | undefined> {
  const db = await getDB()
  return db.get('transactions', id)
}

/**
 * Get transactions by status
 */
export async function getTransactionsByStatus(
  status: TransactionStatus
): Promise<PendingTransaction[]> {
  const db = await getDB()
  return db.getAllFromIndex('transactions', 'by-status', status)
}

/**
 * Get all pending transactions (pending or failed with retries left)
 */
export async function getPendingTransactions(): Promise<PendingTransaction[]> {
  const db = await getDB()
  const pending = await db.getAllFromIndex('transactions', 'by-status', 'pending')
  const failed = await db.getAllFromIndex('transactions', 'by-status', 'failed')

  // Include failed transactions that can still be retried
  const retriable = failed.filter((tx) => tx.syncAttempts < 5)

  return [...pending, ...retriable].sort(
    (a, b) => safeGetTime(a.createdAt) - safeGetTime(b.createdAt)
  )
}

/**
 * Update transaction status
 */
export async function updateTransactionStatus(
  id: string,
  status: TransactionStatus,
  updates?: Partial<PendingTransaction>
): Promise<void> {
  const db = await getDB()
  const tx = await db.get('transactions', id)

  if (tx) {
    tx.status = status
    if (updates) {
      Object.assign(tx, updates)
    }
    await db.put('transactions', tx)
  }
}

/**
 * Get count of pending transactions
 */
export async function getPendingTransactionCount(): Promise<number> {
  const pending = await getPendingTransactions()
  return pending.length
}

/**
 * Get all synced transactions (for history)
 */
export async function getSyncedTransactions(
  storeId: string,
  limit = 50
): Promise<PendingTransaction[]> {
  const db = await getDB()
  const all = await db.getAllFromIndex('transactions', 'by-store', storeId)

  return all
    .filter((tx) => tx.status === 'synced')
    .sort((a, b) => safeGetTime(b.createdAt) - safeGetTime(a.createdAt))
    .slice(0, limit)
}

/**
 * Delete old synced transactions (cleanup)
 */
export async function cleanupOldTransactions(daysOld = 30): Promise<number> {
  const db = await getDB()
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - daysOld)

  const tx = db.transaction('transactions', 'readwrite')
  let deleted = 0

  let cursor = await tx.store.openCursor()
  while (cursor) {
    if (
      cursor.value.status === 'synced' &&
      safeGetTime(cursor.value.createdAt) < cutoff.getTime()
    ) {
      await cursor.delete()
      deleted++
    }
    cursor = await cursor.continue()
  }

  await tx.done
  return deleted
}

// ============================================
// Inventory Reservations
// ============================================

/**
 * Create a stock reservation
 */
export async function createReservation(
  productId: string,
  transactionId: string,
  quantity: number
): Promise<void> {
  const db = await getDB()
  const reservation: InventoryReservation = {
    id: `${productId}-${transactionId}`,
    transactionId,
    quantity,
    createdAt: new Date(),
  }
  await db.put('reservations', reservation)

  // Update product local stock
  const product = await db.get('products', productId)
  if (product) {
    product.reservedStock += quantity
    product.localStock = product.serverStock - product.reservedStock
    await db.put('products', product)
  }
}

/**
 * Release reservations for a transaction
 */
export async function releaseReservations(transactionId: string): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(['reservations', 'products'], 'readwrite')

  // Get all reservations for this transaction
  const reservations = await tx
    .objectStore('reservations')
    .index('by-transaction')
    .getAll(transactionId)

  for (const reservation of reservations) {
    // Update product stock
    const productId = reservation.id.split('-')[0]
    const product = await tx.objectStore('products').get(productId)

    if (product) {
      product.reservedStock = Math.max(0, product.reservedStock - reservation.quantity)
      product.localStock = product.serverStock - product.reservedStock
      await tx.objectStore('products').put(product)
    }

    // Delete reservation
    await tx.objectStore('reservations').delete(reservation.id)
  }

  await tx.done
}

/**
 * Get all reservations for a product
 */
export async function getProductReservations(
  productId: string
): Promise<InventoryReservation[]> {
  const db = await getDB()
  const all = await db.getAll('reservations')
  return all.filter((r) => r.id.startsWith(productId))
}

// ============================================
// Sync Queue
// ============================================

/**
 * Add item to sync queue
 */
export async function addToSyncQueue(item: SyncQueueItem): Promise<void> {
  const db = await getDB()
  await db.put('syncQueue', item)
}

/**
 * Get next items to sync (ordered by priority)
 */
export async function getNextSyncItems(limit = 10): Promise<SyncQueueItem[]> {
  const db = await getDB()
  const pending = await db.getAllFromIndex('syncQueue', 'by-status', 'pending')

  return pending
    .sort((a, b) => b.priority - a.priority || safeGetTime(a.createdAt) - safeGetTime(b.createdAt))
    .slice(0, limit)
}

/**
 * Update sync queue item status
 */
export async function updateSyncItemStatus(
  id: string,
  status: SyncQueueItem['status'],
  error?: string
): Promise<void> {
  const db = await getDB()
  const item = await db.get('syncQueue', id)

  if (item) {
    item.status = status
    item.lastAttempt = new Date()
    item.attempts++
    if (error) item.error = error
    await db.put('syncQueue', item)
  }
}

/**
 * Remove completed sync items
 */
export async function cleanupSyncQueue(): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('syncQueue', 'readwrite')

  let cursor = await tx.store.openCursor()
  while (cursor) {
    if (cursor.value.status === 'completed') {
      await cursor.delete()
    }
    cursor = await cursor.continue()
  }

  await tx.done
}

// ============================================
// Metadata
// ============================================

/**
 * Get metadata value
 */
export async function getMetadata(key: string): Promise<unknown> {
  const db = await getDB()
  return db.get('metadata', key)
}

/**
 * Set metadata value
 */
export async function setMetadata(key: string, value: unknown): Promise<void> {
  const db = await getDB()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.put('metadata', value as any, key)
}

/**
 * Get last sync time for products
 */
export async function getLastProductSync(): Promise<Date | null> {
  const value = await getMetadata('lastProductSync')
  return value as Date | null
}

/**
 * Set last sync time for products
 */
export async function setLastProductSync(date: Date): Promise<void> {
  await setMetadata('lastProductSync', date)
}

/**
 * Get store ID from metadata
 */
export async function getStoredStoreId(): Promise<string | null> {
  const value = (await getMetadata('storeId')) as string | null
  return value
}

/**
 * Set store ID in metadata
 */
export async function setStoredStoreId(storeId: string): Promise<void> {
  await setMetadata('storeId', storeId)
}

// ============================================
// Database Utilities
// ============================================

/**
 * Clear all data from the database
 */
export async function clearAllData(): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(
    ['products', 'transactions', 'reservations', 'syncQueue', 'metadata'],
    'readwrite'
  )

  await Promise.all([
    tx.objectStore('products').clear(),
    tx.objectStore('transactions').clear(),
    tx.objectStore('reservations').clear(),
    tx.objectStore('syncQueue').clear(),
    tx.objectStore('metadata').clear(),
    tx.done,
  ])
}

/**
 * Check if IndexedDB is available
 */
export function isIndexedDBAvailable(): boolean {
  if (typeof window === 'undefined') return false

  try {
    return 'indexedDB' in window && window.indexedDB !== null
  } catch {
    return false
  }
}

/**
 * Close database connection
 */
export async function closeDB(): Promise<void> {
  if (dbInstance) {
    dbInstance.close()
    dbInstance = null
  }
}

/**
 * Generate a local transaction ID
 */
export function generateLocalTransactionId(): string {
  return crypto.randomUUID()
}

/**
 * Generate a local receipt number
 */
export function generateLocalReceiptNumber(): string {
  const timestamp = Date.now()
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0')
  return `OFF-${timestamp}-${random}`
}

/**
 * Safely get timestamp from a Date that may be serialized as string
 * IndexedDB may store Date objects as strings after persistence
 */
export function safeGetTime(date: Date | string): number {
  if (date instanceof Date) {
    return date.getTime()
  }
  return new Date(date).getTime()
}

/**
 * Safely convert a potential string date to Date object
 */
export function safeToDate(date: Date | string): Date {
  if (date instanceof Date) {
    return date
  }
  return new Date(date)
}
