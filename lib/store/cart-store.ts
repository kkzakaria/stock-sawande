/**
 * POS Cart Store (Zustand)
 * Manages shopping cart state for point-of-sale transactions
 * Features: Add/remove items, quantity management, totals calculation, localStorage persistence
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { formatCurrency } from '@/lib/config/currency'

// Cart item interface
export interface CartItem {
  productId: string // product_templates.id
  inventoryId: string // product_inventory.id
  name: string
  sku: string
  barcode?: string | null
  price: number // unit price
  quantity: number
  maxStock: number // available inventory
  discount: number // item-level discount
}

// Cart state and actions
interface CartState {
  items: CartItem[]
  customerId: string | null
  discount: number // cart-level discount
  tax: number // tax amount (calculated)
  taxRate: number // tax percentage (e.g., 0.18 for 18%)
  notes: string
  storeId: string | null // Store ID to track which store the cart belongs to

  // Item management
  addItem: (item: Omit<CartItem, 'quantity' | 'discount'>) => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  updateItemDiscount: (productId: string, discount: number) => void
  clearCart: () => void

  // Cart-level operations
  setCustomer: (customerId: string | null) => void
  setDiscount: (discount: number) => void
  setTaxRate: (taxRate: number) => void
  setNotes: (notes: string) => void

  // Store management - clears cart if store changes
  ensureStoreMatch: (storeId: string) => boolean

  // Totals calculation (tax-inclusive pricing)
  getSubtotalTTC: () => number // Total with tax included (sum of item prices)
  getSubtotalHT: () => number // Subtotal without tax (for display)
  getTax: () => number // Tax amount extracted from total
  getTotal: () => number // Final total (same as subtotalTTC - discount)
  getItemCount: () => number
}

// Default tax rate (18% - can be customized per store)
const DEFAULT_TAX_RATE = 0.18

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      // Initial state
      items: [],
      customerId: null,
      discount: 0,
      tax: 0,
      taxRate: DEFAULT_TAX_RATE,
      notes: '',
      storeId: null,

      // Add item to cart
      addItem: (item) => {
        const existingItem = get().items.find((i) => i.productId === item.productId)

        if (existingItem) {
          // Item already in cart, increment quantity (if stock allows)
          if (existingItem.quantity < item.maxStock) {
            set({
              items: get().items.map((i) =>
                i.productId === item.productId
                  ? { ...i, quantity: i.quantity + 1 }
                  : i
              ),
            })
          }
        } else {
          // New item, add to cart
          set({
            items: [
              ...get().items,
              {
                ...item,
                quantity: 1,
                discount: 0,
              },
            ],
          })
        }
      },

      // Remove item from cart
      removeItem: (productId) => {
        set({
          items: get().items.filter((i) => i.productId !== productId),
        })
      },

      // Update item quantity
      updateQuantity: (productId, quantity) => {
        const item = get().items.find((i) => i.productId === productId)

        if (!item) return

        // Validate quantity against available stock
        const validatedQuantity = Math.max(0, Math.min(quantity, item.maxStock))

        if (validatedQuantity === 0) {
          // Remove item if quantity is 0
          get().removeItem(productId)
        } else {
          set({
            items: get().items.map((i) =>
              i.productId === productId ? { ...i, quantity: validatedQuantity } : i
            ),
          })
        }
      },

      // Update item-level discount
      updateItemDiscount: (productId, discount) => {
        set({
          items: get().items.map((i) =>
            i.productId === productId ? { ...i, discount: Math.max(0, discount) } : i
          ),
        })
      },

      // Clear entire cart
      clearCart: () => {
        set({
          items: [],
          customerId: null,
          discount: 0,
          notes: '',
          storeId: null,
        })
      },

      // Ensure cart belongs to current store, clear if different
      ensureStoreMatch: (storeId: string) => {
        const currentStoreId = get().storeId

        // If no store set yet, set it
        if (!currentStoreId) {
          set({ storeId })
          return true
        }

        // If store matches, all good
        if (currentStoreId === storeId) {
          return true
        }

        // Store changed - clear cart and set new store
        console.log(`[Cart] Store changed from ${currentStoreId} to ${storeId}, clearing cart`)
        set({
          items: [],
          customerId: null,
          discount: 0,
          notes: '',
          storeId,
        })
        return false // Returns false to indicate cart was cleared
      },

      // Set customer ID
      setCustomer: (customerId) => {
        set({ customerId })
      },

      // Set cart-level discount
      setDiscount: (discount) => {
        set({ discount: Math.max(0, discount) })
      },

      // Set tax rate
      setTaxRate: (taxRate) => {
        set({ taxRate: Math.max(0, taxRate) })
      },

      // Set notes
      setNotes: (notes) => {
        set({ notes })
      },

      // Calculate subtotal TTC (prices include tax)
      getSubtotalTTC: () => {
        return get().items.reduce((sum, item) => {
          const itemTotal = item.price * item.quantity - item.discount
          return sum + itemTotal
        }, 0)
      },

      // Calculate tax amount (extracted from total, tax-inclusive)
      // Formula: Tax = Total * taxRate / (1 + taxRate)
      getTax: () => {
        const total = get().getTotal()
        const taxRate = get().taxRate
        return total * taxRate / (1 + taxRate)
      },

      // Calculate subtotal HT (before tax, for display)
      // Formula: SubtotalHT = Total - Tax
      getSubtotalHT: () => {
        return get().getTotal() - get().getTax()
      },

      // Calculate final total (tax already included in prices)
      getTotal: () => {
        const subtotalTTC = get().getSubtotalTTC()
        const discount = get().discount
        return Math.max(0, subtotalTTC - discount)
      },

      // Get total item count
      getItemCount: () => {
        return get().items.reduce((sum, item) => sum + item.quantity, 0)
      },
    }),
    {
      name: 'next-stock-cart', // localStorage key
      partialize: (state) => ({
        // Only persist these fields
        items: state.items,
        customerId: state.customerId,
        discount: state.discount,
        taxRate: state.taxRate,
        notes: state.notes,
        storeId: state.storeId,
      }),
    }
  )
)

// Helper function to validate cart against current inventory
export async function validateCart(
  items: CartItem[],
  getCurrentInventory: (inventoryId: string) => Promise<number>
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = []

  for (const item of items) {
    const currentStock = await getCurrentInventory(item.inventoryId)

    if (currentStock < item.quantity) {
      errors.push(
        `Insufficient stock for ${item.name}. Available: ${currentStock}, Requested: ${item.quantity}`
      )
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

// Re-export formatCurrency from centralized config for backward compatibility
export { formatCurrency }
