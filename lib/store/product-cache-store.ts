/**
 * Product Cache Store (Zustand)
 * Manages cached products for offline POS functionality
 * Handles stock reservations for pending offline transactions
 */

import { create } from 'zustand'
import type { CachedProduct } from '@/lib/offline/db-schema'
import {
  getProducts,
  saveProducts,
  getProductByBarcode,
  updateProductLocalStock,
  clearProducts,
} from '@/lib/offline/indexed-db'

// ============================================
// Types
// ============================================

interface ProductCacheState {
  // State
  products: CachedProduct[]
  lastUpdated: Date | null
  isLoading: boolean
  isInitialized: boolean
  storeId: string | null
  error: string | null

  // Actions
  initialize: (storeId: string) => Promise<void>
  loadFromIndexedDB: (storeId: string) => Promise<void>
  updateFromServer: (products: ServerProduct[]) => Promise<void>
  getProduct: (id: string) => CachedProduct | undefined
  getProductByBarcode: (barcode: string) => Promise<CachedProduct | undefined>
  searchProducts: (query: string) => CachedProduct[]
  reserveStock: (productId: string, quantity: number, transactionId: string) => void
  releaseReservation: (productId: string, quantity: number) => void
  getAvailableStock: (productId: string) => number
  clearCache: () => Promise<void>
  setError: (error: string | null) => void
}

// Server product type (from API/Supabase)
interface ServerProduct {
  id: string
  sku: string
  name: string
  price: number
  barcode: string | null
  image_url?: string | null
  category?: { id: string; name: string } | null
  inventory?: {
    id: string
    quantity: number
  }
}

// ============================================
// Store
// ============================================

export const useProductCacheStore = create<ProductCacheState>()((set, get) => ({
  // Initial state
  products: [],
  lastUpdated: null,
  isLoading: false,
  isInitialized: false,
  storeId: null,
  error: null,

  /**
   * Initialize the cache for a store
   */
  initialize: async (storeId: string) => {
    const state = get()

    // Skip if already initialized for this store
    if (state.isInitialized && state.storeId === storeId) {
      return
    }

    set({ isLoading: true, error: null, storeId })

    try {
      await get().loadFromIndexedDB(storeId)
      set({ isInitialized: true })
    } catch (error) {
      console.error('Failed to initialize product cache:', error)
      set({
        error: error instanceof Error ? error.message : 'Failed to initialize cache',
      })
    } finally {
      set({ isLoading: false })
    }
  },

  /**
   * Load products from IndexedDB
   */
  loadFromIndexedDB: async (storeId: string) => {
    set({ isLoading: true, error: null })

    try {
      const products = await getProducts(storeId)
      set({
        products,
        lastUpdated: products.length > 0 ? products[0].cachedAt : null,
        storeId,
      })
    } catch (error) {
      console.error('Failed to load products from IndexedDB:', error)
      set({
        error: error instanceof Error ? error.message : 'Failed to load cached products',
      })
    } finally {
      set({ isLoading: false })
    }
  },

  /**
   * Update cache from server products
   */
  updateFromServer: async (serverProducts: ServerProduct[]) => {
    const { storeId, products: existingProducts } = get()

    if (!storeId) {
      console.error('Cannot update cache: storeId not set')
      return
    }

    set({ isLoading: true, error: null })

    try {
      const now = new Date()

      // Create a map of existing products for quick lookup
      const existingMap = new Map(existingProducts.map((p) => [p.id, p]))

      // Convert server products to cached products
      const cachedProducts: CachedProduct[] = serverProducts.map((sp) => {
        const existing = existingMap.get(sp.id)
        const serverStock = sp.inventory?.quantity ?? 0

        return {
          id: sp.id,
          sku: sp.sku,
          name: sp.name,
          price: sp.price,
          barcode: sp.barcode,
          imageUrl: sp.image_url ?? null,
          category: sp.category ?? null,
          inventoryId: sp.inventory?.id ?? '',
          serverStock,
          // Preserve local adjustments if product existed
          localStock: existing
            ? serverStock - existing.reservedStock
            : serverStock,
          reservedStock: existing?.reservedStock ?? 0,
          cachedAt: now,
          storeId,
        }
      })

      // Save to IndexedDB
      await saveProducts(cachedProducts)

      set({
        products: cachedProducts,
        lastUpdated: now,
      })
    } catch (error) {
      console.error('Failed to update products from server:', error)
      set({
        error: error instanceof Error ? error.message : 'Failed to update cache',
      })
    } finally {
      set({ isLoading: false })
    }
  },

  /**
   * Get a product by ID (from memory)
   */
  getProduct: (id: string) => {
    return get().products.find((p) => p.id === id)
  },

  /**
   * Get a product by barcode (from IndexedDB for accuracy)
   */
  getProductByBarcode: async (barcode: string) => {
    // First check memory
    const memoryProduct = get().products.find((p) => p.barcode === barcode)
    if (memoryProduct) return memoryProduct

    // Fall back to IndexedDB
    return getProductByBarcode(barcode)
  },

  /**
   * Search products by name, SKU, or barcode (from memory)
   */
  searchProducts: (query: string) => {
    if (!query || query.length < 2) return []

    const lowerQuery = query.toLowerCase()
    return get().products.filter(
      (p) =>
        p.name.toLowerCase().includes(lowerQuery) ||
        p.sku.toLowerCase().includes(lowerQuery) ||
        (p.barcode && p.barcode.toLowerCase().includes(lowerQuery))
    )
  },

  /**
   * Reserve stock for an offline transaction
   */
  reserveStock: (productId: string, quantity: number, _transactionId: string) => {
    set((state) => ({
      products: state.products.map((p) => {
        if (p.id === productId) {
          const newReserved = p.reservedStock + quantity
          return {
            ...p,
            reservedStock: newReserved,
            localStock: p.serverStock - newReserved,
          }
        }
        return p
      }),
    }))

    // Also update IndexedDB
    const product = get().products.find((p) => p.id === productId)
    if (product) {
      updateProductLocalStock(productId, product.localStock, product.reservedStock)
    }
  },

  /**
   * Release reserved stock (after sync or cancel)
   */
  releaseReservation: (productId: string, quantity: number) => {
    set((state) => ({
      products: state.products.map((p) => {
        if (p.id === productId) {
          const newReserved = Math.max(0, p.reservedStock - quantity)
          return {
            ...p,
            reservedStock: newReserved,
            localStock: p.serverStock - newReserved,
          }
        }
        return p
      }),
    }))

    // Also update IndexedDB
    const product = get().products.find((p) => p.id === productId)
    if (product) {
      updateProductLocalStock(productId, product.localStock, product.reservedStock)
    }
  },

  /**
   * Get available stock for a product (server stock - reserved)
   */
  getAvailableStock: (productId: string) => {
    const product = get().products.find((p) => p.id === productId)
    return product ? product.localStock : 0
  },

  /**
   * Clear all cached products
   */
  clearCache: async () => {
    const { storeId } = get()
    if (storeId) {
      await clearProducts(storeId)
    }
    set({
      products: [],
      lastUpdated: null,
      isInitialized: false,
      error: null,
    })
  },

  /**
   * Set error state
   */
  setError: (error: string | null) => {
    set({ error })
  },
}))

// ============================================
// Selectors
// ============================================

export const selectProducts = (state: ProductCacheState) => state.products
export const selectIsLoading = (state: ProductCacheState) => state.isLoading
export const selectIsInitialized = (state: ProductCacheState) => state.isInitialized
export const selectLastUpdated = (state: ProductCacheState) => state.lastUpdated
export const selectError = (state: ProductCacheState) => state.error

export const selectProductCount = (state: ProductCacheState) => state.products.length
export const selectLowStockProducts = (state: ProductCacheState) =>
  state.products.filter((p) => p.localStock < 5)
