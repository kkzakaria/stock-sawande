/**
 * POS Cart Store (Zustand)
 * Manages shopping cart state for point-of-sale transactions
 * Features: Add/remove items, quantity management, totals calculation, localStorage persistence
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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
  taxRate: number // tax percentage (e.g., 0.0875 for 8.75%)
  notes: string

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

  // Totals calculation
  getSubtotal: () => number
  getTax: () => number
  getTotal: () => number
  getItemCount: () => number
}

// Default tax rate (8.75% - can be customized per store)
const DEFAULT_TAX_RATE = 0.0875

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
        })
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

      // Calculate subtotal (before tax and discount)
      getSubtotal: () => {
        return get().items.reduce((sum, item) => {
          const itemTotal = item.price * item.quantity - item.discount
          return sum + itemTotal
        }, 0)
      },

      // Calculate tax amount
      getTax: () => {
        const subtotal = get().getSubtotal()
        const cartDiscount = get().discount
        const taxableAmount = Math.max(0, subtotal - cartDiscount)
        return taxableAmount * get().taxRate
      },

      // Calculate final total
      getTotal: () => {
        const subtotal = get().getSubtotal()
        const discount = get().discount
        const tax = get().getTax()
        return Math.max(0, subtotal - discount + tax)
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

// Helper to format currency
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}
