'use client'

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Store } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface OtherStoreInventory {
  storeId: string
  storeName: string
  quantity: number
}

interface POSStockIndicatorProps {
  quantity: number
  otherStoresInventory: OtherStoreInventory[]
}

export function POSStockIndicator({
  quantity,
  otherStoresInventory,
}: POSStockIndicatorProps) {
  const t = useTranslations('POS')

  // Color based on local stock
  const stockColor =
    quantity > 10
      ? 'text-green-600'
      : quantity > 0
      ? 'text-orange-600'
      : 'text-red-600'

  // Check if there's stock available in other stores
  const hasOtherStock = otherStoresInventory.length > 0
  const otherStoresTotal = otherStoresInventory.reduce((sum, inv) => sum + inv.quantity, 0)

  // If no other stores have stock, just show local quantity
  if (!hasOtherStock) {
    return (
      <span className={`text-sm font-semibold ${stockColor}`}>
        {quantity}
      </span>
    )
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={`flex items-center gap-1 text-sm font-semibold ${stockColor} hover:underline underline-offset-2`}
          onClick={(e) => e.stopPropagation()}
        >
          {quantity}
          <Store className="h-3 w-3 text-blue-500" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-56 p-3"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-2">
          <div className="flex items-center gap-2 font-medium text-sm border-b pb-2">
            <Store className="h-4 w-4" />
            {t('stock.availableElsewhere')}
          </div>

          <div className="space-y-1">
            {otherStoresInventory.map((inv) => (
              <div
                key={inv.storeId}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-muted-foreground truncate max-w-[140px]">
                  {inv.storeName}
                </span>
                <span className="font-medium text-green-600">{inv.quantity}</span>
              </div>
            ))}
            <div className="flex items-center justify-between text-sm font-medium border-t pt-2 mt-2">
              <span>{t('stock.totalOther')}</span>
              <span>{otherStoresTotal}</span>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
