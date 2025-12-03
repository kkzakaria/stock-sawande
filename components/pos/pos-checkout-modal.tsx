'use client'

/**
 * POS Checkout Modal Component
 * Handles payment method selection and order confirmation
 * Supports offline checkout with transaction queuing
 */

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useCartStore, formatCurrency } from '@/lib/store/cart-store'
import { useOfflineCheckout } from '@/lib/hooks/use-offline-checkout'
import { useOfflineStore } from '@/lib/store/offline-store'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CreditCard, Banknote, Smartphone, Loader2, WifiOff, AlertTriangle } from 'lucide-react'

interface POSCheckoutModalProps {
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
  onCheckoutComplete: (saleId: string, saleNumber: string, isOffline?: boolean) => void
}

type PaymentMethod = 'cash' | 'card' | 'mobile'

export function POSCheckoutModal({
  open,
  onOpenChange,
  storeId,
  cashierId,
  cashierName,
  storeInfo,
  sessionId,
  onCheckoutComplete,
}: POSCheckoutModalProps) {
  const t = useTranslations('POS.checkout')
  const tOffline = useTranslations('POS.offline')
  const tCommon = useTranslations('Common')

  const items = useCartStore((state) => state.items)
  const customerId = useCartStore((state) => state.customerId)
  const discount = useCartStore((state) => state.discount)
  const notes = useCartStore((state) => state.notes)
  const getSubtotal = useCartStore((state) => state.getSubtotal)
  const getTax = useCartStore((state) => state.getTax)
  const getTotal = useCartStore((state) => state.getTotal)
  const clearCart = useCartStore((state) => state.clearCart)

  const isOnline = useOfflineStore((state) => state.isOnline)
  const { processOfflineCheckout, validateOfflineCheckout } = useOfflineCheckout()

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [offlineWarnings, setOfflineWarnings] = useState<string[]>([])

  const subtotal = getSubtotal()
  const tax = getTax()
  const total = getTotal()

  // Validate offline checkout when offline
  useEffect(() => {
    if (!isOnline && open) {
      const offlineItems = items.map((item) => ({
        productId: item.productId,
        inventoryId: item.inventoryId,
        name: item.name,
        sku: item.sku,
        quantity: item.quantity,
        price: item.price,
        discount: item.discount,
      }))
      const validation = validateOfflineCheckout(offlineItems)
      setOfflineWarnings(validation.warnings)
    } else {
      setOfflineWarnings([])
    }
  }, [isOnline, open, items, validateOfflineCheckout])

  const handleOnlineCheckout = async () => {
    const response = await fetch('/api/pos/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId,
        cashierId,
        sessionId,
        customerId,
        items: items.map((item) => ({
          productId: item.productId,
          inventoryId: item.inventoryId,
          quantity: item.quantity,
          price: item.price,
          discount: item.discount,
        })),
        subtotal,
        tax,
        discount,
        total,
        paymentMethod,
        notes,
      }),
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Checkout failed')
    }

    const { saleId, saleNumber } = await response.json()
    return { saleId, saleNumber }
  }

  const handleOfflineCheckout = async () => {
    const offlineItems = items.map((item) => ({
      productId: item.productId,
      inventoryId: item.inventoryId,
      name: item.name,
      sku: item.sku,
      quantity: item.quantity,
      price: item.price,
      discount: item.discount,
    }))

    const result = await processOfflineCheckout({
      storeId,
      cashierId,
      sessionId: sessionId ?? null,
      customerId,
      items: offlineItems,
      subtotal,
      tax,
      discount,
      total,
      paymentMethod,
      notes,
      // Receipt metadata for offline ticket generation
      storeInfo,
      cashierName,
    })

    if (!result.success) {
      throw new Error(result.error || 'Offline checkout failed')
    }

    return {
      saleId: result.localId!,
      saleNumber: result.localReceiptNumber!,
    }
  }

  const handleCheckout = async () => {
    setIsProcessing(true)
    setError(null)

    try {
      let result: { saleId: string; saleNumber: string }

      if (isOnline) {
        // Try online checkout first
        try {
          result = await handleOnlineCheckout()
        } catch (onlineError) {
          // If online checkout fails due to network, fall back to offline
          if (
            onlineError instanceof Error &&
            (onlineError.message.includes('fetch') ||
              onlineError.message.includes('network') ||
              onlineError.message.includes('Failed to fetch'))
          ) {
            console.log('Online checkout failed, falling back to offline mode')
            result = await handleOfflineCheckout()
          } else {
            throw onlineError
          }
        }
      } else {
        // Offline checkout
        result = await handleOfflineCheckout()
      }

      // Clear cart and close modal
      clearCart()
      onOpenChange(false)
      onCheckoutComplete(result.saleId, result.saleNumber, !isOnline)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {t('title')}
            {!isOnline && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-800 rounded-full">
                <WifiOff className="h-3 w-3" />
                {t('titleOffline')}
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            {isOnline ? t('subtitle') : t('subtitleOffline')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Offline Mode Warning */}
          {!isOnline && (
            <Alert className="bg-orange-50 border-orange-200">
              <WifiOff className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800">
                <strong>{tOffline('warning')}:</strong> {tOffline('warningDescription')}
              </AlertDescription>
            </Alert>
          )}

          {/* Stock Warnings */}
          {offlineWarnings.length > 0 && (
            <Alert className="bg-yellow-50 border-yellow-200">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                <strong>{tOffline('stockWarning')}:</strong>
                <ul className="mt-1 text-sm list-disc list-inside">
                  {offlineWarnings.map((warning, i) => (
                    <li key={i}>{warning}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Order Summary */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">{t('orderSummary')}</h3>
            <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">{t('items', { count: items.length })}</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>{t('discount')}</span>
                  <span>-{formatCurrency(discount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">Tax (8.75%)</span>
                <span>{formatCurrency(tax)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg pt-2 border-t">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>
          </div>

          {/* Payment Method */}
          <div className="space-y-3">
            <Label>{t('paymentMethod')}</Label>
            <RadioGroup
              value={paymentMethod}
              onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}
            >
              <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-gray-50">
                <RadioGroupItem value="cash" id="cash" />
                <Label htmlFor="cash" className="flex items-center gap-2 cursor-pointer flex-1">
                  <Banknote className="h-5 w-5 text-green-600" />
                  <span>{t('cash')}</span>
                </Label>
              </div>
              <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-gray-50">
                <RadioGroupItem value="card" id="card" />
                <Label htmlFor="card" className="flex items-center gap-2 cursor-pointer flex-1">
                  <CreditCard className="h-5 w-5 text-blue-600" />
                  <span>{t('card')}</span>
                </Label>
              </div>
              <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-gray-50">
                <RadioGroupItem value="mobile" id="mobile" />
                <Label htmlFor="mobile" className="flex items-center gap-2 cursor-pointer flex-1">
                  <Smartphone className="h-5 w-5 text-purple-600" />
                  <span>{t('mobile')}</span>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
          >
            {t('cancel')}
          </Button>
          <Button
            onClick={handleCheckout}
            disabled={isProcessing}
            className={!isOnline ? 'bg-orange-600 hover:bg-orange-700' : ''}
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('processing')}
              </>
            ) : !isOnline ? (
              <>
                <WifiOff className="mr-2 h-4 w-4" />
                {t('saveOffline')} - {formatCurrency(total)}
              </>
            ) : (
              `${t('complete')} - ${formatCurrency(total)}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
