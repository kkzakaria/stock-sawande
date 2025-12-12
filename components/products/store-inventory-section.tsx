'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Lock, Store as StoreIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { AddToStoreDialog } from './add-to-store-dialog'
import { addProductToStore, updateMultiStoreInventory } from '@/lib/actions/products'
import { toast } from 'sonner'

interface StoreInventory {
  inventory_id: string | null
  store_id: string
  store_name: string
  quantity: number
}

interface StoreInventorySectionProps {
  productId: string
  allStores: Array<{ id: string; name: string }>
  inventories: StoreInventory[]
  userRole: string
  userStoreId: string | null
  minStockLevel: number | null
  onInventoryChange?: () => void
}

export function StoreInventorySection({
  productId,
  allStores,
  inventories,
  userRole,
  userStoreId,
  minStockLevel,
  onInventoryChange,
}: StoreInventorySectionProps) {
  const t = useTranslations('Products.form.multiStore')
  const tDialog = useTranslations('Products.form.addToStoreDialog')
  const [isPending, startTransition] = useTransition()
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [localInventories, setLocalInventories] = useState<StoreInventory[]>(inventories)
  const [pendingChanges, setPendingChanges] = useState<Map<string, number>>(new Map())

  const isAdmin = userRole === 'admin'

  // Get stores where product is NOT yet available
  const storesWithProduct = new Set(localInventories.map((inv) => inv.store_id))
  const availableStores = allStores.filter((store) => !storesWithProduct.has(store.id))

  // For managers, filter available stores to only their store
  const filteredAvailableStores = isAdmin
    ? availableStores
    : availableStores.filter((store) => store.id === userStoreId)

  const canEditStore = (storeId: string) => {
    if (isAdmin) return true
    return storeId === userStoreId
  }

  const canAddToStore = (storeId: string) => {
    if (isAdmin) return true
    return storeId === userStoreId
  }

  const getStockStatus = (quantity: number) => {
    if (quantity === 0) {
      return <Badge variant="destructive">{t('outOfStock')}</Badge>
    } else if (minStockLevel && quantity <= minStockLevel) {
      return (
        <Badge variant="outline" className="border-orange-500 text-orange-500">
          {t('lowStock')}
        </Badge>
      )
    }
    return (
      <Badge variant="outline" className="border-green-500 text-green-500">
        {t('inStock')}
      </Badge>
    )
  }

  const handleQuantityChange = (storeId: string, newQuantity: string) => {
    const qty = parseInt(newQuantity, 10)
    if (isNaN(qty) || qty < 0) return

    // Update local state
    setLocalInventories((prev) =>
      prev.map((inv) =>
        inv.store_id === storeId ? { ...inv, quantity: qty } : inv
      )
    )

    // Track pending changes
    setPendingChanges((prev) => {
      const updated = new Map(prev)
      updated.set(storeId, qty)
      return updated
    })
  }

  const handleSaveChanges = () => {
    if (pendingChanges.size === 0) return

    startTransition(async () => {
      const updates = Array.from(pendingChanges.entries()).map(([storeId, quantity]) => ({
        storeId,
        quantity,
      }))

      const result = await updateMultiStoreInventory(productId, updates)

      if (result.success) {
        toast.success(t('updateSuccess'))
        setPendingChanges(new Map())
        onInventoryChange?.()
      } else {
        toast.error(result.error || t('updateError'))
      }
    })
  }

  const handleAddToStore = (storeId: string, quantity: number) => {
    startTransition(async () => {
      const result = await addProductToStore(productId, storeId, quantity)

      if (result.success) {
        toast.success(tDialog('success'))
        setShowAddDialog(false)

        // Add to local state
        const store = allStores.find((s) => s.id === storeId)
        if (store) {
          setLocalInventories((prev) => [
            ...prev,
            {
              inventory_id: result.data?.inventory_id || null,
              store_id: storeId,
              store_name: store.name,
              quantity,
            },
          ])
        }

        onInventoryChange?.()
      } else {
        toast.error(result.error || tDialog('error'))
      }
    })
  }

  const totalQuantity = localInventories.reduce((sum, inv) => sum + inv.quantity, 0)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>{t('inventoryByStore')}</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {t('totalStock')}: {totalQuantity}
          </p>
        </div>
        {filteredAvailableStores.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowAddDialog(true)}
            disabled={isPending}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t('addToStore')}
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        {localInventories.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {t('notInAnyStore')}
          </p>
        ) : (
          <>
            {localInventories.map((inventory) => {
              const isEditable = canEditStore(inventory.store_id)
              const isUserStore = inventory.store_id === userStoreId

              return (
                <div
                  key={inventory.store_id}
                  className={`flex items-center justify-between rounded-lg border p-3 ${
                    isUserStore && !isAdmin ? 'border-primary/50 bg-primary/5' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <StoreIcon className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">
                        {inventory.store_name}
                        {isUserStore && !isAdmin && (
                          <span className="ml-2 text-xs text-primary">
                            ({t('yourStore')})
                          </span>
                        )}
                      </p>
                      {!isEditable && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Lock className="h-3 w-3" />
                          {t('viewOnly')}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {getStockStatus(inventory.quantity)}
                    {isEditable ? (
                      <Input
                        type="number"
                        min="0"
                        value={inventory.quantity}
                        onChange={(e) =>
                          handleQuantityChange(inventory.store_id, e.target.value)
                        }
                        className="w-24"
                        disabled={isPending}
                      />
                    ) : (
                      <span className="w-24 text-right font-medium">
                        {inventory.quantity}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}

            {pendingChanges.size > 0 && (
              <div className="flex justify-end pt-2">
                <Button type="button" onClick={handleSaveChanges} disabled={isPending}>
                  {isPending ? t('saving') : t('saveChanges')}
                </Button>
              </div>
            )}
          </>
        )}

        {!isAdmin && (
          <p className="text-xs text-muted-foreground mt-2">
            {t('managerNote')}
          </p>
        )}
      </CardContent>

      <AddToStoreDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        availableStores={filteredAvailableStores}
        onConfirm={handleAddToStore}
        isPending={isPending}
      />
    </Card>
  )
}
