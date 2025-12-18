'use client'

/**
 * Mobile Cart Sheet Component
 * Full-screen mobile cart modal that wraps POSCart
 */

import { useTranslations } from 'next-intl'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import { POSCart } from './pos-cart'
import { useCartStore } from '@/lib/store/cart-store'

interface Customer {
  id: string
  name: string
  email: string | null
  phone: string | null
}

interface MobileCartSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  storeId: string
  cashierId: string
  cashierName: string
  storeInfo: {
    name: string
    address: string | null
    phone: string | null
  }
  sessionId?: string | null
  customers: Customer[]
  onCustomerAdded?: (customer: Customer) => void
  onCheckoutComplete?: () => void
}

export function MobileCartSheet({
  open,
  onOpenChange,
  storeId,
  cashierId,
  cashierName,
  storeInfo,
  sessionId,
  customers,
  onCustomerAdded,
  onCheckoutComplete,
}: MobileCartSheetProps) {
  const t = useTranslations('POS')
  const itemCount = useCartStore((state) => state.getItemCount())

  const handleCheckoutComplete = () => {
    onCheckoutComplete?.()
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[100dvh] p-0 flex flex-col rounded-t-2xl"
      >
        {/* Header */}
        <SheetHeader className="flex-shrink-0 border-b bg-background px-4 py-3">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg">
              {t('cart.title')} ({itemCount})
            </SheetTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8"
            >
              <X className="h-5 w-5" />
              <span className="sr-only">{t('cart.close')}</span>
            </Button>
          </div>
        </SheetHeader>

        {/* Cart content */}
        <div className="flex-1 overflow-hidden bg-gray-50">
          <POSCart
            storeId={storeId}
            cashierId={cashierId}
            cashierName={cashierName}
            storeInfo={storeInfo}
            sessionId={sessionId}
            customers={customers}
            onCustomerAdded={onCustomerAdded}
            onCheckoutComplete={handleCheckoutComplete}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
