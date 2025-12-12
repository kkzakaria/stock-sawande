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
import { useNetworkStatus } from '@/lib/hooks/use-network-status'
import { useHeartbeat } from '@/lib/hooks/use-heartbeat'
import { useProductCacheStore } from '@/lib/store/product-cache-store'
import { useOfflineStore } from '@/lib/store/offline-store'
import { POSProductGrid } from './pos-product-grid'
import { POSCart } from './pos-cart'
import { CashSessionStatus } from './cash-session-status'
import { OpenSessionDialog } from './open-session-dialog'
import { CloseSessionDialog } from './close-session-dialog'
import { SessionRequiredOverlay } from './session-required-overlay'
import { NetworkStatusIndicator } from './network-status-indicator'
import { NetworkBanner } from './network-banner'
import { SyncConflictDialog } from './sync-conflict-dialog'
import { StoreSelectorDialog } from './store-selector-dialog'
import { Button } from '@/components/ui/button'
import { ShoppingCart, Loader2, Store } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { Tables } from '@/types/supabase'

type CashSession = Tables<'cash_sessions'>

interface OtherStoreInventory {
  storeId: string
  storeName: string
  quantity: number
}

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
  // Multi-store info
  totalQuantity?: number
  otherStoresInventory?: OtherStoreInventory[]
}

interface Customer {
  id: string
  name: string
  email: string | null
  phone: string | null
}

interface POSClientProps {
  products: Product[]
  customers: Customer[]
  storeId: string
  cashierId: string
  cashierName: string
  storeInfo: {
    name: string
    address: string | null
    phone: string | null
  }
  canSelectStore: boolean
  userRole: 'admin' | 'manager' | 'cashier'
}

export function POSClient({
  products,
  customers: initialCustomers,
  storeId,
  cashierId,
  cashierName,
  storeInfo,
  canSelectStore,
  userRole,
}: POSClientProps) {
  const router = useRouter()
  const t = useTranslations('POS')
  const [searchQuery, setSearchQuery] = useState('')
  const hydrated = useHydrated()
  const storeItemCount = useCartStore((state) => state.getItemCount())
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Local customers state (allows adding new customers without page refresh)
  const [customers, setCustomers] = useState(initialCustomers)

  // Cash session state
  const [activeSession, setActiveSession] = useState<CashSession | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [openSessionDialogOpen, setOpenSessionDialogOpen] = useState(false)
  const [closeSessionDialogOpen, setCloseSessionDialogOpen] = useState(false)
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false)
  const [storeSelectorOpen, setStoreSelectorOpen] = useState(false)

  // Handle new customer added from cart
  const handleCustomerAdded = (newCustomer: Customer) => {
    setCustomers((prev) => [...prev, newCustomer].sort((a, b) => a.name.localeCompare(b.name)))
  }

  // Offline mode hooks - use both polling and SSE for fast detection
  const { isOnline } = useNetworkStatus()
  useHeartbeat() // SSE heartbeat for ultra-fast offline detection
  const initializeProductCache = useProductCacheStore((state) => state.initialize)
  const updateFromServer = useProductCacheStore((state) => state.updateFromServer)
  const cachedProducts = useProductCacheStore((state) => state.products)
  const cacheIsInitialized = useProductCacheStore((state) => state.isInitialized)
  const unacknowledgedConflicts = useOfflineStore((state) => state.unacknowledgedConflicts)

  // Initialize product cache for offline mode
  useEffect(() => {
    initializeProductCache(storeId)
  }, [storeId, initializeProductCache])

  // Update product cache when products change (from server)
  useEffect(() => {
    if (isOnline && products.length > 0) {
      const serverProducts = products.map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        price: p.price,
        barcode: p.barcode,
        image_url: p.imageUrl,
        category: p.category,
        inventory: {
          id: p.inventoryId,
          quantity: p.quantity,
        },
      }))
      updateFromServer(serverProducts)
    }
  }, [products, isOnline, updateFromServer])

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

  // Handle store change request
  const handleChangeStore = () => {
    if (activeSession) {
      toast.error(t('storeSelector.sessionOpenError'))
      return
    }
    setStoreSelectorOpen(true)
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

    // Channel 1: Subscribe to inventory changes for THIS store (same store updates)
    // Using both broadcast (for local dev) and postgres_changes (for production)
    const localChannel = supabase
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
          console.log('[Realtime] Postgres change detected (local store):', payload)

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
        console.log('[Realtime] Local store subscription status:', status)
      })

    // Channel 2: Subscribe to inventory changes in ALL OTHER stores
    // This updates the "Available elsewhere" indicator in real-time
    const globalChannel = supabase
      .channel('inventory-global')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE', // Only listen to updates (stock changes)
          schema: 'public',
          table: 'product_inventory',
        },
        (payload) => {
          // Only process changes from OTHER stores
          const changedStoreId = payload.new?.store_id || payload.old?.store_id
          if (changedStoreId && changedStoreId !== storeId) {
            console.log('[Realtime] Postgres change detected (other store):', payload)

            // Silent refresh - no toast for other stores, just update the indicator
            debouncedRefresh()
          }
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Global inventory subscription status:', status)
      })

    // Cleanup subscriptions on unmount
    return () => {
      console.log('[Realtime] Cleaning up subscriptions')
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      supabase.removeChannel(localChannel)
      supabase.removeChannel(globalChannel)
    }
  }, [storeId, router])

  // Determine which products to display:
  // Always use cached products when cache is initialized and has products.
  // This ensures consistent stock display (localStock = serverStock - reservedStock)
  // The cache is updated:
  // - From server props via useEffect when online
  // - Via reserveStock() during offline sales
  // - Via syncProducts() after transaction sync (with clearReservations=true)
  const displayProducts: Product[] = (cacheIsInitialized && cachedProducts.length > 0)
    ? cachedProducts.map((cp) => {
        // Find the original product to get multi-store info
        const originalProduct = products.find(p => p.id === cp.id)
        return {
          id: cp.id,
          sku: cp.sku,
          name: cp.name,
          price: cp.price,
          barcode: cp.barcode,
          imageUrl: cp.imageUrl,
          category: cp.category,
          inventoryId: cp.inventoryId,
          quantity: cp.localStock, // Use local stock (server stock - reserved)
          // Preserve multi-store info from server props
          totalQuantity: originalProduct?.totalQuantity,
          otherStoresInventory: originalProduct?.otherStoresInventory,
        }
      })
    : products

  // Filter products based on search query
  const filteredProducts = displayProducts.filter(
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
      {/* Network Status Banner */}
      <NetworkBanner />

      {/* Session Required Overlay */}
      {!activeSession && (
        <SessionRequiredOverlay
          onOpenSession={() => setOpenSessionDialogOpen(true)}
          canSelectStore={canSelectStore}
          onChangeStore={() => setStoreSelectorOpen(true)}
        />
      )}

      {/* Left side: Product Grid */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Session Status Bar with Network Indicator */}
        <div className="flex-shrink-0 mb-4 flex items-center gap-2">
          <div className="flex-1">
            <CashSessionStatus
              session={activeSession}
              onOpenSession={() => setOpenSessionDialogOpen(true)}
              onCloseSession={() => setCloseSessionDialogOpen(true)}
            />
          </div>
          {canSelectStore && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleChangeStore}
              className="flex items-center gap-2"
            >
              <Store className="h-4 w-4" />
              {t('storeSelector.changeStore')}
            </Button>
          )}
          <NetworkStatusIndicator storeId={storeId} onSyncComplete={handleCheckoutComplete} />
          {unacknowledgedConflicts > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setConflictDialogOpen(true)}
            >
              {unacknowledgedConflicts} Conflict(s)
            </Button>
          )}
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
          storeInfo={storeInfo}
          sessionId={activeSession?.id}
          customers={customers}
          onCustomerAdded={handleCustomerAdded}
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

      {/* Sync Conflict Dialog */}
      <SyncConflictDialog
        open={conflictDialogOpen}
        onOpenChange={setConflictDialogOpen}
        userId={cashierId}
      />

      {/* Store Selector Dialog */}
      <StoreSelectorDialog
        open={storeSelectorOpen}
        onOpenChange={setStoreSelectorOpen}
        currentStoreId={storeId}
        userRole={userRole}
        onStoreSelected={() => {
          // Cart will be cleared automatically when page refreshes with new store
          toast.info(t('storeSelector.cartCleared'))
        }}
      />
    </div>
  )
}
