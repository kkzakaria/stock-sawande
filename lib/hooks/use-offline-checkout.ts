/**
 * Offline Checkout Hook
 * Handles offline sales by queuing transactions in IndexedDB
 */

'use client'

import { useCallback } from 'react'
import { useOfflineStore } from '@/lib/store/offline-store'
import { useProductCacheStore } from '@/lib/store/product-cache-store'
import {
  saveTransaction,
  createReservation,
  getPendingTransactionCount,
  generateLocalTransactionId,
  generateLocalReceiptNumber,
} from '@/lib/offline/indexed-db'
import type {
  PendingTransaction,
  PendingTransactionItem,
  PaymentMethod,
} from '@/lib/offline/db-schema'

// ============================================
// Types
// ============================================

export interface OfflineCheckoutItem {
  productId: string
  inventoryId: string
  name: string
  sku: string
  quantity: number
  price: number
  discount: number
}

export interface OfflineCheckoutData {
  storeId: string
  cashierId: string
  sessionId: string | null
  customerId: string | null
  items: OfflineCheckoutItem[]
  subtotal: number
  tax: number
  discount: number
  total: number
  paymentMethod: PaymentMethod
  notes: string
  // Receipt metadata for offline ticket generation
  storeInfo: {
    name: string
    address: string | null
    phone: string | null
  }
  cashierName: string
}

export interface OfflineCheckoutResult {
  success: boolean
  localId?: string
  localReceiptNumber?: string
  error?: string
  stockWarnings?: string[]
}

// ============================================
// Hook
// ============================================

export function useOfflineCheckout() {
  const isOnline = useOfflineStore((state) => state.isOnline)
  const incrementPendingCount = useOfflineStore((state) => state.incrementPendingCount)
  const setPendingCount = useOfflineStore((state) => state.setPendingCount)
  const reserveStock = useProductCacheStore((state) => state.reserveStock)
  const getAvailableStock = useProductCacheStore((state) => state.getAvailableStock)

  /**
   * Process an offline checkout
   */
  const processOfflineCheckout = useCallback(
    async (data: OfflineCheckoutData): Promise<OfflineCheckoutResult> => {
      try {
        const localId = generateLocalTransactionId()
        const localReceiptNumber = generateLocalReceiptNumber()
        const stockWarnings: string[] = []

        // Check local stock availability and collect warnings
        for (const item of data.items) {
          const availableStock = getAvailableStock(item.productId)

          if (availableStock < item.quantity) {
            stockWarnings.push(
              `${item.name}: Only ${availableStock} available locally (requested ${item.quantity})`
            )
          }
        }

        // Convert items to pending transaction format
        const transactionItems: PendingTransactionItem[] = data.items.map((item) => ({
          productId: item.productId,
          inventoryId: item.inventoryId,
          name: item.name,
          sku: item.sku,
          quantity: item.quantity,
          requestedQuantity: item.quantity, // Original requested
          price: item.price,
          discount: item.discount,
        }))

        // Create pending transaction
        const transaction: PendingTransaction = {
          id: localId,
          localReceiptNumber,
          storeId: data.storeId,
          cashierId: data.cashierId,
          sessionId: data.sessionId,
          customerId: data.customerId,
          items: transactionItems,
          subtotal: data.subtotal,
          tax: data.tax,
          discount: data.discount,
          total: data.total,
          paymentMethod: data.paymentMethod,
          notes: data.notes,
          createdAt: new Date(),
          status: 'pending',
          syncAttempts: 0,
          lastSyncAttempt: null,
          syncError: null,
          serverSaleId: null,
          serverSaleNumber: null,
          conflictResolution: null,
          // Store receipt metadata for offline ticket generation
          receiptData: {
            store: data.storeInfo,
            cashier: { full_name: data.cashierName },
          },
        }

        // Save transaction to IndexedDB
        await saveTransaction(transaction)

        // Create stock reservations for each item
        for (const item of data.items) {
          await createReservation(item.productId, localId, item.quantity)
          reserveStock(item.productId, item.quantity, localId)
        }

        // Update pending count
        incrementPendingCount()

        return {
          success: true,
          localId,
          localReceiptNumber,
          stockWarnings: stockWarnings.length > 0 ? stockWarnings : undefined,
        }
      } catch (error) {
        console.error('Offline checkout failed:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to process offline checkout',
        }
      }
    },
    [getAvailableStock, incrementPendingCount, reserveStock]
  )

  /**
   * Check if a cart can be processed offline
   */
  const validateOfflineCheckout = useCallback(
    (items: OfflineCheckoutItem[]): { valid: boolean; warnings: string[] } => {
      const warnings: string[] = []

      for (const item of items) {
        const availableStock = getAvailableStock(item.productId)

        if (availableStock <= 0) {
          warnings.push(`${item.name}: No local stock available (may be out of stock)`)
        } else if (availableStock < item.quantity) {
          warnings.push(
            `${item.name}: Only ${availableStock} available locally (you requested ${item.quantity})`
          )
        }
      }

      // We allow checkout even with warnings (soft reservation)
      return {
        valid: true,
        warnings,
      }
    },
    [getAvailableStock]
  )

  /**
   * Get the current pending transaction count
   */
  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await getPendingTransactionCount()
      setPendingCount(count)
      return count
    } catch (error) {
      console.error('Failed to get pending count:', error)
      return 0
    }
  }, [setPendingCount])

  /**
   * Check if we can checkout offline
   */
  const canCheckoutOffline = !isOnline

  return {
    processOfflineCheckout,
    validateOfflineCheckout,
    refreshPendingCount,
    canCheckoutOffline,
    isOnline,
  }
}
