'use client'

import { useState } from 'react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Loader2, Store } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'

interface StoreInventory {
  store_id: string
  store_name: string
  quantity: number
}

interface StockQuantityPopoverProps {
  productId: string
  quantity: number
  storeCount?: number | null
  className?: string
}

export function StockQuantityPopover({
  productId,
  quantity,
  storeCount,
  className,
}: StockQuantityPopoverProps) {
  const t = useTranslations('Products')
  const [inventories, setInventories] = useState<StoreInventory[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)

  const loadInventories = async () => {
    if (hasLoaded) return

    setIsLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('product_inventory')
        .select(`
          store_id,
          quantity,
          stores:store_id (name)
        `)
        .eq('product_id', productId)

      if (error) {
        console.error('Error loading inventories:', error)
        return
      }

      const formattedData: StoreInventory[] = (data || []).map((inv) => ({
        store_id: inv.store_id,
        store_name: (inv.stores as { name: string } | null)?.name || 'Unknown',
        quantity: inv.quantity,
      }))

      setInventories(formattedData)
      setHasLoaded(true)
    } finally {
      setIsLoading(false)
    }
  }

  // If no store count info (0 or null/undefined), just show the quantity without popover
  if (!storeCount || storeCount === 0) {
    return <span className={className}>{quantity}</span>
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={`${className} cursor-pointer hover:underline underline-offset-2`}
          onMouseEnter={loadInventories}
        >
          {quantity}
          {storeCount > 1 && (
            <span className="ml-1 text-xs text-muted-foreground">
              ({storeCount})
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="space-y-2">
          <div className="flex items-center gap-2 font-medium text-sm border-b pb-2">
            <Store className="h-4 w-4" />
            {t('stockByStore')}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : inventories.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              {t('noInventory')}
            </p>
          ) : (
            <div className="space-y-1">
              {inventories.map((inv) => (
                <div
                  key={inv.store_id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-muted-foreground">{inv.store_name}</span>
                  <span className="font-medium">{inv.quantity}</span>
                </div>
              ))}
              <div className="flex items-center justify-between text-sm font-medium border-t pt-2 mt-2">
                <span>{t('total')}</span>
                <span>{quantity}</span>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
