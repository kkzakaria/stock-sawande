'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2, Store, MapPin, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { updateUserStore } from '@/lib/actions/profile-actions'
import { toast } from 'sonner'
import { Tables } from '@/types/supabase'

type StoreType = Tables<'stores'>

interface StoreSelectorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentStoreId?: string | null
  userRole: 'admin' | 'manager' | 'cashier'
  onStoreSelected?: () => void
}

export function StoreSelectorDialog({
  open,
  onOpenChange,
  currentStoreId,
  userRole,
  onStoreSelected,
}: StoreSelectorDialogProps) {
  const t = useTranslations('POS.storeSelector')
  const tCommon = useTranslations('Common')
  const router = useRouter()

  const [stores, setStores] = useState<StoreType[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingStoreId, setUpdatingStoreId] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      fetchStores()
    }
  }, [open])

  const fetchStores = async () => {
    try {
      setLoading(true)
      const supabase = createClient()

      // Admin: fetch all stores
      // Manager/Cashier: fetch only assigned stores via user_stores
      if (userRole === 'admin') {
        const { data, error } = await supabase
          .from('stores')
          .select('*')
          .order('name')

        if (error) throw error
        setStores(data || [])
      } else {
        // Fetch user's assigned stores via user_stores junction table
        const { data, error } = await supabase
          .from('user_stores')
          .select(`
            store_id,
            is_default,
            stores (
              id,
              name,
              address,
              phone,
              email,
              created_at,
              updated_at
            )
          `)
          .order('is_default', { ascending: false })
          .order('stores(name)')

        if (error) throw error

        // Extract stores from the nested structure
        const assignedStores = (data || [])
          .map((item) => item.stores)
          .filter((store): store is StoreType => store !== null)

        setStores(assignedStores)
      }
    } catch (error) {
      console.error('Error fetching stores:', error)
      toast.error(tCommon('errors.somethingWentWrong'))
    } finally {
      setLoading(false)
    }
  }

  const handleSelectStore = async (storeId: string) => {
    if (storeId === currentStoreId) {
      onOpenChange(false)
      return
    }

    try {
      setUpdatingStoreId(storeId)

      const result = await updateUserStore({ storeId })

      if (!result.success) {
        toast.error(result.error || tCommon('errors.somethingWentWrong'))
        return
      }

      toast.success(t('storeUpdated'))
      onOpenChange(false)

      if (onStoreSelected) {
        onStoreSelected()
      }

      // Refresh the page to load new store's products
      router.refresh()
    } catch (error) {
      console.error('Error updating store:', error)
      toast.error(tCommon('errors.somethingWentWrong'))
    } finally {
      setUpdatingStoreId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            {t('title')}
          </DialogTitle>
          <DialogDescription>
            {currentStoreId ? t('selectDifferentStore') : t('selectRequired')}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : stores.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('noStoresAvailable')}
            </div>
          ) : (
            <div className="grid gap-3 max-h-[400px] overflow-y-auto pr-2">
              {stores.map((store) => {
                const isCurrentStore = store.id === currentStoreId
                const isUpdating = updatingStoreId === store.id

                return (
                  <button
                    key={store.id}
                    onClick={() => handleSelectStore(store.id)}
                    disabled={isUpdating || (isCurrentStore && !!currentStoreId)}
                    className={`
                      relative w-full text-left p-4 rounded-lg border-2 transition-all
                      ${
                        isCurrentStore
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50 hover:bg-accent'
                      }
                      ${isUpdating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                      disabled:cursor-not-allowed
                    `}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-base truncate">
                            {store.name}
                          </h3>
                          {isCurrentStore && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary text-primary-foreground">
                              <CheckCircle2 className="h-3 w-3" />
                              {t('currentStore')}
                            </span>
                          )}
                        </div>
                        {store.address && (
                          <p className="text-sm text-muted-foreground flex items-start gap-1">
                            <MapPin className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                            <span className="line-clamp-2">{store.address}</span>
                          </p>
                        )}
                        {store.phone && (
                          <p className="text-sm text-muted-foreground mt-1">
                            📞 {store.phone}
                          </p>
                        )}
                      </div>

                      <div className="flex-shrink-0">
                        {isUpdating ? (
                          <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        ) : !isCurrentStore ? (
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleSelectStore(store.id)
                            }}
                            disabled={isUpdating}
                          >
                            {t('selectButton')}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
