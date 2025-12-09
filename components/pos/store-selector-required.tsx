'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Loader2, Store, MapPin } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { updateUserStore } from '@/lib/actions/profile-actions'
import { toast } from 'sonner'
import { Tables } from '@/types/supabase'

type StoreType = Tables<'stores'>

interface StoreSelectorRequiredProps {
  userId: string
  userRole: 'admin' | 'manager' | 'cashier'
}

export function StoreSelectorRequired({ userId: _userId, userRole }: StoreSelectorRequiredProps) {
  const isAdmin = userRole === 'admin'
  const t = useTranslations('POS.storeSelector')
  const tCommon = useTranslations('Common')
  const router = useRouter()

  const [stores, setStores] = useState<StoreType[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingStoreId, setUpdatingStoreId] = useState<string | null>(null)

  const fetchStores = useCallback(async () => {
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

        if (error) throw error

        // Extract stores from the nested structure and sort by name
        const assignedStores = (data || [])
          .map((item) => item.stores)
          .filter((store): store is StoreType => store !== null)
          .sort((a, b) => a.name.localeCompare(b.name))

        setStores(assignedStores)
      }
    } catch (error) {
      console.error('Error fetching stores:', error)
      toast.error(tCommon('errors.somethingWentWrong'))
    } finally {
      setLoading(false)
    }
  }, [userRole, tCommon])

  useEffect(() => {
    fetchStores()
  }, [fetchStores])

  const handleSelectStore = async (storeId: string) => {
    try {
      setUpdatingStoreId(storeId)

      // For admins: redirect with URL param (session-based, not persisted)
      // For managers: save to profile (persisted)
      if (isAdmin) {
        router.push(`/pos?store=${storeId}`)
        return
      }

      // For managers: save to profile
      const result = await updateUserStore({ storeId })

      if (!result.success) {
        toast.error(result.error || tCommon('errors.somethingWentWrong'))
        return
      }

      toast.success(t('storeUpdated'))

      // Refresh the page to load store's products
      router.refresh()
    } catch (error) {
      console.error('Error updating store:', error)
      toast.error(tCommon('errors.somethingWentWrong'))
    } finally {
      setUpdatingStoreId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">{tCommon('loading')}</p>
        </div>
      </div>
    )
  }

  if (stores.length === 0) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="text-center max-w-md">
          <Store className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {t('noStoresAvailable')}
          </h2>
          <p className="text-muted-foreground">
            {t('contactAdminToCreateStore')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center p-6">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-8">
          <Store className="h-16 w-16 text-primary mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {isAdmin ? t('selectStore') : t('noStoreSelected')}
          </h1>
          <p className="text-lg text-muted-foreground">
            {isAdmin ? t('adminSelectDescription') : t('selectRequired')}
          </p>
        </div>

        <div className="grid gap-4">
          {stores.map((store) => {
            const isUpdating = updatingStoreId === store.id

            return (
              <div
                key={store.id}
                className="p-6 rounded-lg border-2 border-border hover:border-primary/50 transition-all bg-card"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-semibold mb-2">{store.name}</h3>
                    {store.address && (
                      <p className="text-sm text-muted-foreground flex items-start gap-2 mb-1">
                        <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <span>{store.address}</span>
                      </p>
                    )}
                    {store.phone && (
                      <p className="text-sm text-muted-foreground">
                        📞 {store.phone}
                      </p>
                    )}
                    {store.email && (
                      <p className="text-sm text-muted-foreground">
                        ✉️ {store.email}
                      </p>
                    )}
                  </div>

                  <Button
                    size="lg"
                    onClick={() => handleSelectStore(store.id)}
                    disabled={isUpdating}
                  >
                    {isUpdating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {tCommon('loading')}
                      </>
                    ) : (
                      t('selectButton')
                    )}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
