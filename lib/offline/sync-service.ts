/**
 * Sync Service
 * Handles synchronization of offline transactions with the server
 */

import {
  getPendingTransactions,
  updateTransactionStatus,
  releaseReservations,
  getLastProductSync,
  setLastProductSync,
  getPendingTransactionCount,
} from './indexed-db'
import { useOfflineStore } from '@/lib/store/offline-store'
import { useProductCacheStore } from '@/lib/store/product-cache-store'
import type {
  PendingTransaction,
  SyncReport,
  SyncTransactionResult,
} from './db-schema'

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

interface SyncTransactionResponse {
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
// Sync Service Class
// ============================================

class SyncService {
  private isSyncing = false
  private syncLock: Promise<void> | null = null

  /**
   * Sync all pending transactions
   */
  async syncPendingTransactions(): Promise<SyncReport> {
    // Prevent concurrent syncs
    if (this.isSyncing) {
      console.log('Sync already in progress, skipping...')
      return this.createEmptyReport()
    }

    this.isSyncing = true
    const startedAt = new Date()
    const results: SyncTransactionResult[] = []

    try {
      // Get all pending transactions
      const pending = await getPendingTransactions()

      if (pending.length === 0) {
        return this.createEmptyReport()
      }

      // Process in batches
      const batches = this.createBatches(pending, 10)

      for (const batch of batches) {
        const batchResults = await this.syncBatch(batch)
        results.push(...batchResults)
      }

      // Update offline store
      const newPendingCount = await getPendingTransactionCount()
      useOfflineStore.getState().setPendingCount(newPendingCount)

      const report: SyncReport = {
        startedAt,
        completedAt: new Date(),
        totalTransactions: results.length,
        successful: results.filter((r) => r.status === 'success').length,
        conflicts: results.filter((r) => r.status === 'conflict').length,
        failed: results.filter((r) => r.status === 'failed').length,
        details: results,
      }

      useOfflineStore.getState().setLastSyncReport(report)
      return report
    } finally {
      this.isSyncing = false
    }
  }

  /**
   * Sync a batch of transactions
   */
  private async syncBatch(
    transactions: PendingTransaction[]
  ): Promise<SyncTransactionResult[]> {
    const results: SyncTransactionResult[] = []

    // Mark all as syncing
    for (const tx of transactions) {
      await updateTransactionStatus(tx.id, 'syncing')
    }

    try {
      // Prepare request payload
      const requests: SyncTransactionRequest[] = transactions.map((tx) => ({
        localId: tx.id,
        localReceiptNumber: tx.localReceiptNumber,
        storeId: tx.storeId,
        cashierId: tx.cashierId,
        sessionId: tx.sessionId,
        customerId: tx.customerId,
        items: tx.items.map((item) => ({
          productId: item.productId,
          inventoryId: item.inventoryId,
          quantity: item.quantity,
          price: item.price,
          discount: item.discount,
        })),
        subtotal: tx.subtotal,
        tax: tx.tax,
        discount: tx.discount,
        total: tx.total,
        paymentMethod: tx.paymentMethod,
        notes: tx.notes,
        createdAt: tx.createdAt.toISOString(),
      }))

      // Send to server
      const response = await fetch('/api/pos/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions: requests }),
      })

      if (!response.ok) {
        throw new Error(`Sync failed: ${response.statusText}`)
      }

      const data: { results: SyncTransactionResponse[] } = await response.json()

      // Process results
      for (const result of data.results) {
        const tx = transactions.find((t) => t.id === result.localId)
        if (!tx) continue

        if (result.status === 'success') {
          await updateTransactionStatus(tx.id, 'synced', {
            serverSaleId: result.serverSaleId,
            serverSaleNumber: result.serverSaleNumber,
          })
          await releaseReservations(tx.id)

          results.push({
            localId: tx.id,
            localReceiptNumber: tx.localReceiptNumber,
            status: 'success',
            serverSaleId: result.serverSaleId,
            serverSaleNumber: result.serverSaleNumber,
          })
        } else if (result.status === 'conflict') {
          await updateTransactionStatus(tx.id, 'conflict', {
            serverSaleId: result.serverSaleId,
            serverSaleNumber: result.serverSaleNumber,
            conflictResolution: result.conflict
              ? {
                  type: result.conflict.type as 'stock_shortage' | 'product_unavailable',
                  items: result.conflict.items,
                  originalTotal: result.conflict.originalTotal,
                  adjustedTotal: result.conflict.adjustedTotal,
                  refundAmount: result.conflict.refundAmount,
                  message: result.conflict.message,
                  acknowledgedAt: null,
                  acknowledgedBy: null,
                }
              : null,
          })
          await releaseReservations(tx.id)

          results.push({
            localId: tx.id,
            localReceiptNumber: tx.localReceiptNumber,
            status: 'conflict',
            serverSaleId: result.serverSaleId,
            serverSaleNumber: result.serverSaleNumber,
            conflict: tx.conflictResolution ?? undefined,
          })
        } else {
          await updateTransactionStatus(tx.id, 'failed', {
            syncAttempts: tx.syncAttempts + 1,
            lastSyncAttempt: new Date(),
            syncError: result.error,
          })

          results.push({
            localId: tx.id,
            localReceiptNumber: tx.localReceiptNumber,
            status: 'failed',
            error: result.error,
          })
        }
      }
    } catch (error) {
      // Network error - mark all as pending for retry
      for (const tx of transactions) {
        await updateTransactionStatus(tx.id, 'pending', {
          syncAttempts: tx.syncAttempts + 1,
          lastSyncAttempt: new Date(),
          syncError: error instanceof Error ? error.message : 'Network error',
        })

        results.push({
          localId: tx.id,
          localReceiptNumber: tx.localReceiptNumber,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Network error',
        })
      }
    }

    return results
  }

  /**
   * Sync products from server
   */
  async syncProducts(storeId: string): Promise<boolean> {
    try {
      const lastSync = await getLastProductSync()
      const since = lastSync ? lastSync.toISOString() : null

      const url = new URL('/api/pos/products/sync', window.location.origin)
      url.searchParams.set('storeId', storeId)
      if (since) {
        url.searchParams.set('since', since)
      }

      const response = await fetch(url.toString())

      if (!response.ok) {
        throw new Error(`Product sync failed: ${response.statusText}`)
      }

      const { products } = await response.json()

      // Update product cache store
      await useProductCacheStore.getState().updateFromServer(products)
      await setLastProductSync(new Date())

      return true
    } catch (error) {
      console.error('Failed to sync products:', error)
      return false
    }
  }

  /**
   * Register for background sync (if supported)
   */
  async registerBackgroundSync(): Promise<boolean> {
    if (!('serviceWorker' in navigator) || !('sync' in ServiceWorkerRegistration.prototype)) {
      console.log('Background sync not supported')
      return false
    }

    try {
      const registration = await navigator.serviceWorker.ready
      await (registration as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } }).sync.register('sync-transactions')
      return true
    } catch (error) {
      console.error('Failed to register background sync:', error)
      return false
    }
  }

  /**
   * Create batches from an array
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = []
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize))
    }
    return batches
  }

  /**
   * Create an empty sync report
   */
  private createEmptyReport(): SyncReport {
    const now = new Date()
    return {
      startedAt: now,
      completedAt: now,
      totalTransactions: 0,
      successful: 0,
      conflicts: 0,
      failed: 0,
      details: [],
    }
  }
}

// ============================================
// Singleton Instance
// ============================================

export const syncService = new SyncService()

// ============================================
// Hook for using sync service
// ============================================

export function useSyncService() {
  const isOnline = useOfflineStore((state) => state.isOnline)
  const isSyncing = useOfflineStore((state) => state.isSyncing)
  const setSyncing = useOfflineStore((state) => state.setSyncing)
  const pendingCount = useOfflineStore((state) => state.pendingTransactionsCount)

  const triggerSync = async (): Promise<SyncReport | null> => {
    if (!isOnline || isSyncing) {
      return null
    }

    setSyncing(true)
    try {
      const report = await syncService.syncPendingTransactions()
      return report
    } finally {
      setSyncing(false)
    }
  }

  const syncProducts = async (storeId: string): Promise<boolean> => {
    if (!isOnline) {
      return false
    }

    return syncService.syncProducts(storeId)
  }

  return {
    triggerSync,
    syncProducts,
    isOnline,
    isSyncing,
    pendingCount,
    canSync: isOnline && !isSyncing && pendingCount > 0,
  }
}
