'use client'

/**
 * POS Client Component
 * Main POS interface with product grid and shopping cart
 */

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useCartStore } from '@/lib/store/cart-store'
import { useHydrated } from '@/lib/hooks/use-hydrated'
import { POSProductGrid } from './pos-product-grid'
import { POSCart } from './pos-cart'
import { Button } from '@/components/ui/button'
import { ShoppingCart } from 'lucide-react'
import { toast } from 'sonner'

interface Product {
  id: string
  sku: string
  name: string
  price: number
  barcode: string | null
  imageUrl: string | null
  category: { id: string; name: string } | null
  inventoryId: string
  quantity: number
}

interface POSClientProps {
  products: Product[]
  storeId: string
  cashierId: string
  cashierName: string
}

export function POSClient({
  products,
  storeId,
  cashierId,
  cashierName,
}: POSClientProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const hydrated = useHydrated()
  const storeItemCount = useCartStore((state) => state.getItemCount())
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Prevent hydration mismatch: use 0 during SSR, real value after hydration
  const itemCount = hydrated ? storeItemCount : 0

  // Refresh product data after checkout to update stock quantities
  const handleCheckoutComplete = () => {
    router.refresh()
  }

  // Realtime subscription for multi-cashier synchronization
  useEffect(() => {
    const supabase = createClient()

    // Debounced refresh to avoid excessive updates
    const debouncedRefresh = () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }

      debounceTimerRef.current = setTimeout(() => {
        router.refresh()
      }, 500) // 500ms delay to batch multiple changes
    }

    // Subscribe to inventory changes for this store
    const channel = supabase
      .channel(`inventory-${storeId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'product_inventory',
          filter: `store_id=eq.${storeId}`,
        },
        (payload) => {
          // Notify user of stock changes from other cashiers
          toast.info('Stock updated by another cashier', {
            duration: 2000,
            position: 'bottom-right',
          })

          // Refresh data with debouncing
          debouncedRefresh()
        }
      )
      .subscribe()

    // Cleanup subscription on unmount
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      supabase.removeChannel(channel)
    }
  }, [storeId, router])

  // Filter products based on search query
  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.barcode && product.barcode.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  return (
    <div className="flex h-full gap-4">
      {/* Left side: Product Grid */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Product Grid */}
        <POSProductGrid
          products={filteredProducts}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      </div>

      {/* Right side: Cart */}
      <div className="w-[400px] flex flex-col border-l bg-gray-50">
        <POSCart
          storeId={storeId}
          cashierId={cashierId}
          cashierName={cashierName}
          onCheckoutComplete={handleCheckoutComplete}
        />
      </div>

      {/* Mobile cart toggle (hidden on desktop) */}
      <Button
        className="fixed bottom-4 right-4 h-14 w-14 rounded-full shadow-lg lg:hidden"
        size="icon"
      >
        <ShoppingCart className="h-6 w-6" />
        {itemCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
            {itemCount}
          </span>
        )}
      </Button>
    </div>
  )
}
