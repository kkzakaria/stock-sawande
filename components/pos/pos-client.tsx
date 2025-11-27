'use client'

/**
 * POS Client Component
 * Main POS interface with product grid and shopping cart
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useCartStore } from '@/lib/store/cart-store'
import { useHydrated } from '@/lib/hooks/use-hydrated'
import { POSProductGrid } from './pos-product-grid'
import { POSCart } from './pos-cart'
import { CashSessionStatus } from './cash-session-status'
import { OpenSessionDialog } from './open-session-dialog'
import { CloseSessionDialog } from './close-session-dialog'
import { SessionRequiredOverlay } from './session-required-overlay'
import { Button } from '@/components/ui/button'
import { ShoppingCart, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Tables } from '@/types/supabase'

type CashSession = Tables<'cash_sessions'>

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

  // Cash session state
  const [activeSession, setActiveSession] = useState<CashSession | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [openSessionDialogOpen, setOpenSessionDialogOpen] = useState(false)
  const [closeSessionDialogOpen, setCloseSessionDialogOpen] = useState(false)

  // Prevent hydration mismatch: use 0 during SSR, real value after hydration
  const itemCount = hydrated ? storeItemCount : 0

  // Fetch active session
  const fetchActiveSession = useCallback(async () => {
    try {
      const response = await fetch(`/api/pos/session?storeId=${storeId}`)
      if (response.ok) {
        const data = await response.json()
        setActiveSession(data.session)
      } else {
        setActiveSession(null)
      }
    } catch (error) {
      console.error('Error fetching session:', error)
      setActiveSession(null)
    } finally {
      setSessionLoading(false)
    }
  }, [storeId])

  // Load session on mount
  useEffect(() => {
    fetchActiveSession()
  }, [fetchActiveSession])

  // Handle session opened
  const handleSessionOpened = () => {
    fetchActiveSession()
    toast.success('Caisse ouverte avec succès')
  }

  // Handle session closed
  const handleSessionClosed = () => {
    setActiveSession(null)
    toast.success('Caisse fermée avec succès')
  }

  // Refresh product data after checkout to update stock quantities
  const handleCheckoutComplete = () => {
    fetchActiveSession() // Refresh session to update transaction count
    router.refresh()
  }

  // Realtime subscription for multi-cashier synchronization
  useEffect(() => {
    const supabase = createClient()

    console.log('[Realtime] Setting up subscription for store:', storeId)

    // Debounced refresh to avoid excessive updates
    const debouncedRefresh = () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }

      debounceTimerRef.current = setTimeout(() => {
        console.log('[Realtime] Refreshing product data')
        router.refresh()
      }, 500) // 500ms delay to batch multiple changes
    }

    // Subscribe to inventory changes for this store
    // Using both broadcast (for local dev) and postgres_changes (for production)
    const channel = supabase
      .channel(`inventory-${storeId}`)
      // Broadcast messages: client-to-client communication (works in local dev)
      .on(
        'broadcast',
        { event: 'inventory_updated' },
        (payload) => {
          console.log('[Realtime] Broadcast inventory update received:', payload)

          // Notify user of stock changes from other cashiers
          toast.info('Stock updated by another cashier', {
            duration: 2000,
            position: 'bottom-right',
          })

          // Refresh data with debouncing
          debouncedRefresh()
        }
      )
      // Postgres changes: database-level events (works in production)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'product_inventory',
          filter: `store_id=eq.${storeId}`,
        },
        (payload) => {
          console.log('[Realtime] Postgres change detected:', payload)

          // Notify user of stock changes from other cashiers
          toast.info('Stock updated by another cashier', {
            duration: 2000,
            position: 'bottom-right',
          })

          // Refresh data with debouncing
          debouncedRefresh()
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Subscription status:', status)
      })

    // Cleanup subscription on unmount
    return () => {
      console.log('[Realtime] Cleaning up subscription')
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

  // Show loading state while checking session
  if (sessionLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="relative flex h-full gap-4">
      {/* Session Required Overlay */}
      {!activeSession && (
        <SessionRequiredOverlay
          onOpenSession={() => setOpenSessionDialogOpen(true)}
        />
      )}

      {/* Left side: Product Grid */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Session Status Bar */}
        <div className="flex-shrink-0 mb-4">
          <CashSessionStatus
            session={activeSession}
            onOpenSession={() => setOpenSessionDialogOpen(true)}
            onCloseSession={() => setCloseSessionDialogOpen(true)}
          />
        </div>

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
          sessionId={activeSession?.id}
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

      {/* Open Session Dialog */}
      <OpenSessionDialog
        open={openSessionDialogOpen}
        onOpenChange={setOpenSessionDialogOpen}
        storeId={storeId}
        onSessionOpened={handleSessionOpened}
      />

      {/* Close Session Dialog */}
      <CloseSessionDialog
        open={closeSessionDialogOpen}
        onOpenChange={setCloseSessionDialogOpen}
        session={activeSession}
        storeId={storeId}
        onSessionClosed={handleSessionClosed}
      />
    </div>
  )
}
