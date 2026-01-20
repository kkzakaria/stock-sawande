'use client'

/**
 * POS Cart Component
 * Displays shopping cart with totals and checkout button
 */

import { useState, useRef, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useCartStore, formatCurrency } from '@/lib/store/cart-store'
import { useOfflineStore } from '@/lib/store/offline-store'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { ShoppingCart, Trash2, Plus, Minus, FileText, Loader2, User, X, Check, UserPlus } from 'lucide-react'
import { POSCheckoutModal } from './pos-checkout-modal'
import { POSReceipt, type ReceiptData } from './pos-receipt'
import { POSProformaInvoice } from './pos-proforma-invoice'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { getTransaction } from '@/lib/offline/indexed-db'
import { buildReceiptFromTransaction } from '@/lib/offline/receipt-utils'
import { createPOSProforma, type POSProformaResult } from '@/lib/actions/proformas'
import { AddCustomerDialog } from '@/components/customers/add-customer-dialog'
import { cn } from '@/lib/utils'

interface Customer {
  id: string
  name: string
  email: string | null
  phone: string | null
}

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
  customers: Customer[]
  onCustomerAdded?: (customer: Customer) => void
  onCheckoutComplete?: () => void
}

interface PriceEditorProps {
  price: number
  originalPrice: number
  minPrice: number | null
  maxPrice: number | null
  onUpdate: (newPrice: number) => void
  t: ReturnType<typeof useTranslations<'POS.cart'>>
}

function PriceEditor({ price, originalPrice, minPrice, maxPrice, onUpdate, t }: PriceEditorProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [inputValue, setInputValue] = useState(price.toString())
  const inputRef = useRef<HTMLInputElement>(null)

  // Check if price is flexible (has min or max)
  const isFlexible = minPrice !== null || maxPrice !== null

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  useEffect(() => {
    setInputValue(price.toString())
  }, [price])

  const handleSubmit = () => {
    let newPrice = parseFloat(inputValue)

    if (isNaN(newPrice) || newPrice < 0) {
      setInputValue(price.toString())
      setIsEditing(false)
      return
    }

    // Clamp to allowed range
    if (minPrice !== null && newPrice < minPrice) {
      newPrice = minPrice
    }
    if (maxPrice !== null && newPrice > maxPrice) {
      newPrice = maxPrice
    }

    onUpdate(newPrice)
    setInputValue(newPrice.toString())
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSubmit()
    } else if (e.key === 'Escape') {
      setInputValue(price.toString())
      setIsEditing(false)
    }
  }

  if (!isFlexible) {
    // Fixed price - just display it
    return (
      <span className="font-medium text-sm">
        {formatCurrency(price)}
      </span>
    )
  }

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        type="number"
        step="0.01"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onBlur={handleSubmit}
        onKeyDown={handleKeyDown}
        className="w-24 h-7 text-right p-1 text-sm"
        min={minPrice || 0}
        max={maxPrice || undefined}
      />
    )
  }

  const isPriceModified = price !== originalPrice

  return (
    <div className="flex flex-col items-end">
      <span
        className={cn(
          'font-medium text-sm cursor-pointer hover:bg-orange-50 rounded px-2 py-0.5 transition-colors',
          'text-orange-600 border border-dashed border-orange-300'
        )}
        onClick={() => setIsEditing(true)}
        title={t('clickToEditPrice')}
      >
        {formatCurrency(price)}
      </span>
      {isPriceModified && (
        <span className="text-xs text-gray-400 line-through">
          {formatCurrency(originalPrice)}
        </span>
      )}
    </div>
  )
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

export function POSCart({ storeId, cashierId, cashierName, storeInfo, sessionId, customers, onCustomerAdded, onCheckoutComplete }: POSCartProps) {
  const t = useTranslations('POS.cart')
  const tQuantity = useTranslations('POS.quantity')
  const tCheckout = useTranslations('POS.checkout')

  const items = useCartStore((state) => state.items)
  const removeItem = useCartStore((state) => state.removeItem)
  const updateQuantity = useCartStore((state) => state.updateQuantity)
  const updateItemPrice = useCartStore((state) => state.updateItemPrice)
  const clearCart = useCartStore((state) => state.clearCart)
  const getSubtotalTTC = useCartStore((state) => state.getSubtotalTTC)
  const getSubtotalHT = useCartStore((state) => state.getSubtotalHT)
  const getTax = useCartStore((state) => state.getTax)
  const getTotal = useCartStore((state) => state.getTotal)
  const notes = useCartStore((state) => state.notes)
  const discount = useCartStore((state) => state.discount)
  const customerId = useCartStore((state) => state.customerId)
  const setCustomer = useCartStore((state) => state.setCustomer)

  const isOnline = useOfflineStore((state) => state.isOnline)

  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [currentSaleId, setCurrentSaleId] = useState<string>('')
  const [currentSaleNumber, setCurrentSaleNumber] = useState<string>('')
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null)
  const cartItemsRef = useRef<HTMLDivElement>(null)

  // Customer selection state
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false)

  // Add customer dialog state
  const [addCustomerOpen, setAddCustomerOpen] = useState(false)

  // Proforma state
  const [isCreatingProforma, setIsCreatingProforma] = useState(false)
  const [proformaReceiptOpen, setProformaReceiptOpen] = useState(false)
  const [proformaReceiptData, setProformaReceiptData] = useState<POSProformaResult | null>(null)

  // Find selected customer
  const selectedCustomer = customers.find((c) => c.id === customerId)

  // Handle new customer created from dialog
  const handleCustomerCreated = (customer: Customer) => {
    // Notify parent to add customer to list
    onCustomerAdded?.(customer)

    // Select the new customer
    setCustomer(customer.id)

    // Close popover
    setAddCustomerOpen(false)
    setCustomerSearchOpen(false)
  }

  // Auto-scroll to bottom when new item is added
  useEffect(() => {
    if (cartItemsRef.current && items.length > 0) {
      cartItemsRef.current.scrollTop = cartItemsRef.current.scrollHeight
    }
  }, [items.length])

  const subtotalHT = getSubtotalHT()
  const subtotalTTC = getSubtotalTTC()
  const tax = getTax()
  const total = getTotal()

  // Create proforma handler
  const handleCreateProforma = async () => {
    // Proforma requires a customer
    if (!customerId) {
      toast.error(t('proformaRequiresCustomer'))
      return
    }

    setIsCreatingProforma(true)

    try {
      const result = await createPOSProforma({
        store_id: storeId,
        customer_id: customerId,
        items: items.map(item => ({
          product_id: item.productId,
          name: item.name,
          sku: item.sku,
          quantity: item.quantity,
          unit_price: item.price,
          discount: item.discount || 0,
        })),
        subtotal: subtotalTTC,
        tax,
        discount: discount || 0,
        total,
        notes: notes || undefined,
      })

      if (result.success && result.data) {
        // Clear cart
        clearCart()

        // Show success toast
        toast.success(t('proformaCreated', { number: result.data.proforma_number }))

        // Set receipt data and open receipt modal
        setProformaReceiptData(result.data)
        setProformaReceiptOpen(true)
      } else {
        toast.error(result.error || t('proformaError'))
      }
    } catch (error) {
      console.error('Error creating proforma:', error)
      toast.error(t('proformaError'))
    } finally {
      setIsCreatingProforma(false)
    }
  }

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
          {items.length > 0 && (
            <span className="text-sm font-normal text-muted-foreground">
              ({items.length})
            </span>
          )}
        </h2>
        {items.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="gap-1">
                <Trash2 className="h-4 w-4" />
                {t('clear')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('clearTitle')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('clearConfirm')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('clearCancel')}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={clearCart}
                  className="bg-destructive text-white hover:bg-destructive/90"
                >
                  {t('clear')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* Customer Selection */}
      <div className="flex-shrink-0 px-4 py-2 border-b bg-gray-50">
        <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={customerSearchOpen}
              className="w-full justify-between h-9 text-sm"
            >
              <span className="flex items-center gap-2 truncate">
                <User className="h-4 w-4 shrink-0" />
                {selectedCustomer ? (
                  <span className="truncate">{selectedCustomer.name}</span>
                ) : (
                  <span className="text-muted-foreground">{t('selectCustomer')}</span>
                )}
              </span>
              {selectedCustomer && (
                <span
                  role="button"
                  className="ml-2 rounded-full p-0.5 hover:bg-gray-200 cursor-pointer"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setCustomer(null)
                  }}
                >
                  <X className="h-4 w-4 shrink-0 opacity-50 hover:opacity-100" />
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[350px] p-0" align="start">
            <Command>
              <CommandInput placeholder={t('searchCustomer')} />
              <CommandList>
                <CommandEmpty>{t('noCustomerFound')}</CommandEmpty>
                <CommandGroup>
                  {customers.map((customer) => (
                    <CommandItem
                      key={customer.id}
                      value={customer.name}
                      onSelect={() => {
                        setCustomer(customer.id)
                        setCustomerSearchOpen(false)
                      }}
                    >
                      <div className="flex items-center gap-2 flex-1">
                        <Check
                          className={cn(
                            'h-4 w-4 shrink-0',
                            customerId === customer.id ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{customer.name}</p>
                          {customer.phone && (
                            <p className="text-xs text-muted-foreground">{customer.phone}</p>
                          )}
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
            {/* Add Customer Button */}
            <div className="border-t p-2">
              <Button
                variant="ghost"
                className="w-full justify-start text-sm"
                onClick={() => setAddCustomerOpen(true)}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                {t('addCustomer')}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
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

                {/* Item Price & Total */}
                <div className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <span className="text-xs text-gray-500">@</span>
                    <PriceEditor
                      price={item.price}
                      originalPrice={item.originalPrice}
                      minPrice={item.minPrice}
                      maxPrice={item.maxPrice}
                      onUpdate={(newPrice) => updateItemPrice(item.productId, newPrice)}
                      t={t}
                    />
                  </div>
                  <p className="font-bold mt-1">
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
            <span className="text-gray-600">{t('subtotalHT')}</span>
            <span className="font-medium">{formatCurrency(subtotalHT)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">{t('tax', { rate: '18%' })}</span>
            <span className="font-medium">{formatCurrency(tax)}</span>
          </div>
          <Separator />
          <div className="flex justify-between text-lg font-bold">
            <span>{t('totalTTC')}</span>
            <span>{formatCurrency(total)}</span>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            {/* Create Proforma Button */}
            <Button
              variant="outline"
              className="flex-1 h-12"
              size="lg"
              disabled={items.length === 0 || isCreatingProforma || !isOnline || !customerId}
              onClick={handleCreateProforma}
              title={!customerId ? t('proformaRequiresCustomer') : !isOnline ? t('proformaRequiresConnection') : undefined}
            >
              {isCreatingProforma ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('creatingProforma')}
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  {t('createProforma')}
                </>
              )}
            </Button>

            {/* Checkout Button */}
            <Button
              className="flex-1 h-12 text-lg"
              size="lg"
              disabled={items.length === 0}
              onClick={() => setCheckoutOpen(true)}
            >
              {t('checkout')}
            </Button>
          </div>
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

      {/* Proforma Invoice Modal (A4 format) */}
      <POSProformaInvoice
        open={proformaReceiptOpen}
        onOpenChange={setProformaReceiptOpen}
        proformaData={proformaReceiptData}
      />

      {/* Add Customer Dialog */}
      <AddCustomerDialog
        open={addCustomerOpen}
        onOpenChange={setAddCustomerOpen}
        onCustomerCreated={handleCustomerCreated}
        hideTrigger
      />
    </div>
  )
}
