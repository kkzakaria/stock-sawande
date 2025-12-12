'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { useTranslations } from 'next-intl'

export interface StoreQuantity {
  store_id: string
  store_name: string
  selected: boolean
  quantity: number
}

interface MultiStoreInventoryCreationProps {
  stores: Array<{ id: string; name: string }>
  selectedStores: StoreQuantity[]
  onChange: (stores: StoreQuantity[]) => void
  userRole: string
  userStoreId: string | null
  error?: string | null
}

export function MultiStoreInventoryCreation({
  stores,
  selectedStores,
  onChange,
  userRole,
  userStoreId,
  error,
}: MultiStoreInventoryCreationProps) {
  const t = useTranslations('Products.form.multiStore')
  const isAdmin = userRole === 'admin'

  // Initialize store quantities if empty
  const storeQuantities: StoreQuantity[] =
    selectedStores.length > 0
      ? selectedStores
      : stores.map((store) => ({
          store_id: store.id,
          store_name: store.name,
          selected: !isAdmin && store.id === userStoreId, // Pre-select manager's store
          quantity: 0,
        }))

  const handleToggleStore = (storeId: string) => {
    // Managers cannot toggle - their store is always selected
    if (!isAdmin) return

    const updated = storeQuantities.map((sq) =>
      sq.store_id === storeId
        ? { ...sq, selected: !sq.selected, quantity: sq.selected ? 0 : sq.quantity }
        : sq
    )
    onChange(updated)
  }

  const handleQuantityChange = (storeId: string, quantity: string) => {
    const qty = parseInt(quantity, 10)
    if (isNaN(qty) || qty < 0) return

    const updated = storeQuantities.map((sq) =>
      sq.store_id === storeId ? { ...sq, quantity: qty } : sq
    )
    onChange(updated)
  }

  const selectedCount = storeQuantities.filter((sq) => sq.selected).length

  // For managers, only show their store
  const visibleStores = isAdmin
    ? storeQuantities
    : storeQuantities.filter((sq) => sq.store_id === userStoreId)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('inventoryByStore')}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {isAdmin ? t('adminDescription') : t('managerDescription')}
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {isAdmin && (
          <p className="text-sm text-muted-foreground">
            {t('selectedCount', { count: selectedCount })}
          </p>
        )}

        <div className="space-y-3">
          {visibleStores.map((storeQty) => (
            <div
              key={storeQty.store_id}
              className={`flex items-center justify-between rounded-lg border p-3 ${
                storeQty.selected ? 'border-primary bg-primary/5' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                {isAdmin ? (
                  <Checkbox
                    id={`store-${storeQty.store_id}`}
                    checked={storeQty.selected}
                    onCheckedChange={() => handleToggleStore(storeQty.store_id)}
                  />
                ) : null}
                <Label
                  htmlFor={`store-${storeQty.store_id}`}
                  className={`font-medium ${isAdmin ? 'cursor-pointer' : ''}`}
                >
                  {storeQty.store_name}
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <Label htmlFor={`qty-${storeQty.store_id}`} className="text-sm text-muted-foreground">
                  {t('quantityLabel')}:
                </Label>
                <Input
                  id={`qty-${storeQty.store_id}`}
                  type="number"
                  min="0"
                  value={storeQty.quantity}
                  onChange={(e) => handleQuantityChange(storeQty.store_id, e.target.value)}
                  className="w-24"
                  disabled={isAdmin && !storeQty.selected}
                />
              </div>
            </div>
          ))}
        </div>

        {error && (
          <p className="text-sm font-medium text-destructive">{error}</p>
        )}

        {isAdmin && selectedCount === 0 && (
          <p className="text-sm text-orange-600">
            {t('noStoresSelected')}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
