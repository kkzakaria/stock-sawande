'use client'

/**
 * POS Cart Component
 * Displays shopping cart with totals and checkout button
 */

import { useState, useRef, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useCartStore, formatCurrency } from '@/lib/store/cart-store'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { ShoppingCart, Trash2, Plus, Minus } from 'lucide-react'
import { POSCheckoutModal } from './pos-checkout-modal'
import { POSReceipt, type ReceiptData } from './pos-receipt'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { getTransaction } from '@/lib/offline/indexed-db'
import { buildReceiptFromTransaction } from '@/lib/offline/receipt-utils'

interface POSCartProps {
  storeId: string
  cashierId: string
  cashierName: string
  storeInfo: {
    name: string
    address: string | null
    phone: string | null
  }
  sessionId?: string | null
  onCheckoutComplete?: () => void
}

interface QuantityEditorProps {
  quantity: number
  maxStock: number
  onUpdate: (newQuantity: number) => void
  t: ReturnType<typeof useTranslations<'POS.quantity'>>
  tCart: ReturnType<typeof useTranslations<'POS.cart'>>
}

function QuantityEditor({ quantity, maxStock, onUpdate, t, tCart }: QuantityEditorProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [inputValue, setInputValue] = useState(quantity.toString())
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleSubmit = () => {
    const newQuantity = parseInt(inputValue, 10)

    if (isNaN(newQuantity) || newQuantity < 1) {
      toast.error(t('minError'))
      setInputValue(quantity.toString())
      setIsEditing(false)
      return
    }

    if (newQuantity > maxStock) {
      toast.error(t('maxError', { max: maxStock }))
      setInputValue(maxStock.toString())
      onUpdate(maxStock)
      setIsEditing(false)
      return
    }

    onUpdate(newQuantity)
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSubmit()
    } else if (e.key === 'Escape') {
      setInputValue(quantity.toString())
      setIsEditing(false)
    }
  }

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        type="number"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onBlur={handleSubmit}
        onKeyDown={handleKeyDown}
        className="w-14 h-7 text-center p-1"
        min={1}
        max={maxStock}
      />
    )
  }

  return (
    <span
      className="w-10 text-center font-medium cursor-pointer hover:bg-gray-100 rounded px-2 py-1 transition-colors"
      onClick={() => setIsEditing(true)}
      title={tCart('editQuantity')}
    >
      {quantity}
    </span>
  )
}

export function POSCart({ storeId, cashierId, cashierName, storeInfo, sessionId, onCheckoutComplete }: POSCartProps) {
  const t = useTranslations('POS.cart')
  const tQuantity = useTranslations('POS.quantity')
  const tCheckout = useTranslations('POS.checkout')

  const items = useCartStore((state) => state.items)
  const removeItem = useCartStore((state) => state.removeItem)
  const updateQuantity = useCartStore((state) => state.updateQuantity)
  const clearCart = useCartStore((state) => state.clearCart)
  const getSubtotal = useCartStore((state) => state.getSubtotal)
  const getTax = useCartStore((state) => state.getTax)
  const getTotal = useCartStore((state) => state.getTotal)

  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [currentSaleId, setCurrentSaleId] = useState<string>('')
  const [currentSaleNumber, setCurrentSaleNumber] = useState<string>('')
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null)
  const cartItemsRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new item is added
  useEffect(() => {
    if (cartItemsRef.current && items.length > 0) {
      cartItemsRef.current.scrollTop = cartItemsRef.current.scrollHeight
    }
  }, [items.length])

  const subtotal = getSubtotal()
  const tax = getTax()
  const total = getTotal()

  const handleCheckoutComplete = async (saleId: string, saleNumber: string, isOffline?: boolean) => {
    // Close checkout modal
    setCheckoutOpen(false)

    // Clear cart
    clearCart()

    // Show success toast
    toast.success(tCheckout('saleCompleted', { number: saleNumber }))

    // Set sale info and open receipt
    setCurrentSaleId(saleId)
    setCurrentSaleNumber(saleNumber)

    if (isOffline) {
      // Offline: Build receipt from IndexedDB transaction
      try {
        const transaction = await getTransaction(saleId)
        if (transaction) {
          const offlineReceipt = buildReceiptFromTransaction(transaction)
          setReceiptData(offlineReceipt)
        }
      } catch (error) {
        console.error('Failed to load offline receipt:', error)
      }
    } else {
      // Online: Fetch receipt data from Supabase
      const supabase = createClient()
      const { data, error } = await supabase
        .from('sales')
        .select(`
          id,
          sale_number,
          subtotal,
          tax,
          discount,
          total,
          payment_method,
          created_at,
          notes,
          store:stores(name, address, phone),
          cashier:profiles!sales_cashier_id_fkey(full_name),
          sale_items(
            quantity,
            unit_price,
            subtotal,
            discount,
            product:product_templates(name, sku)
          )
        `)
        .eq('id', saleId)
        .single()

      if (!error && data) {
        setReceiptData(data)
      }
    }

    // Refresh product data to update stock quantities
    onCheckoutComplete?.()

    setReceiptOpen(true)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header - Fixed */}
      <div className="flex-shrink-0 flex items-center justify-between p-4 pb-2 bg-gray-50">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" />
          {t('title')}
        </h2>
        {items.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearCart}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            {t('clear')}
          </Button>
        )}
      </div>

      {/* Cart Items - Scrollable */}
      <div ref={cartItemsRef} className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-2 space-y-2">
        {items.length === 0 ? (
          <div className="flex h-full items-center justify-center text-gray-400">
            <div className="text-center">
              <ShoppingCart className="mx-auto h-12 w-12 mb-2" />
              <p>{t('empty')}</p>
              <p className="text-sm">{t('emptyHint')}</p>
            </div>
          </div>
        ) : (
          items.map((item) => (
            <Card key={item.productId} className="p-3">
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1 pr-2">
                  <h3 className="font-medium text-sm line-clamp-2">{item.name}</h3>
                  <p className="text-xs text-gray-500">{item.sku}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => removeItem(item.productId)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center justify-between">
                {/* Quantity Controls */}
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                    disabled={item.quantity <= 1}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <QuantityEditor
                    quantity={item.quantity}
                    maxStock={item.maxStock}
                    onUpdate={(newQuantity) => updateQuantity(item.productId, newQuantity)}
                    t={tQuantity}
                    tCart={t}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                    disabled={item.quantity >= item.maxStock}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>

                {/* Item Total */}
                <div className="text-right">
                  <p className="text-xs text-gray-500">
                    {formatCurrency(item.price)} each
                  </p>
                  <p className="font-bold">
                    {formatCurrency(item.price * item.quantity)}
                  </p>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Totals - Fixed */}
      {items.length > 0 && (
        <div className="flex-shrink-0 border-t pt-4 px-4 pb-4 bg-gray-50 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">{t('subtotal')}</span>
            <span className="font-medium">{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">{t('tax', { rate: '8.75%' })}</span>
            <span className="font-medium">{formatCurrency(tax)}</span>
          </div>
          <Separator />
          <div className="flex justify-between text-lg font-bold">
            <span>{t('total')}</span>
            <span>{formatCurrency(total)}</span>
          </div>

          {/* Checkout Button */}
          <Button
            className="w-full h-12 text-lg"
            size="lg"
            disabled={items.length === 0}
            onClick={() => setCheckoutOpen(true)}
          >
            {t('checkout')}
          </Button>
        </div>
      )}

      {/* Checkout Modal */}
      <POSCheckoutModal
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        storeId={storeId}
        cashierId={cashierId}
        cashierName={cashierName}
        storeInfo={storeInfo}
        sessionId={sessionId}
        onCheckoutComplete={handleCheckoutComplete}
      />

      {/* Receipt Modal */}
      <POSReceipt
        open={receiptOpen}
        onOpenChange={setReceiptOpen}
        saleId={currentSaleId}
        saleNumber={currentSaleNumber}
        receiptData={receiptData}
      />
    </div>
  )
}
