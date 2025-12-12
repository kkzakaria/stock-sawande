'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from '@tanstack/react-form'
import { format } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import { useLocale, useTranslations } from 'next-intl'
import { CalendarIcon, Plus, Trash2, AlertCircle, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Separator } from '@/components/ui/separator'
import { createProforma, updateProforma } from '@/lib/actions/proformas'
import { cn } from '@/lib/utils'

interface Product {
  id: string
  name: string
  sku: string
  price: number
}

interface Customer {
  id: string
  name: string
  email: string | null
  phone: string | null
}

interface Store {
  id: string
  name: string
}

interface ProformaItem {
  product_id: string
  product_name: string
  product_sku: string
  quantity: number
  unit_price: number
  discount: number
  notes: string
}

interface ProformaFormProps {
  initialData?: {
    id: string
    store_id: string
    customer_id: string | null
    tax: number
    discount: number
    notes: string | null
    terms: string | null
    valid_until: string | null
    items: ProformaItem[]
  }
  products: Product[]
  customers: Customer[]
  stores: Store[]
  userRole: string
  userStoreId: string | null
}

export function ProformaForm({
  initialData,
  products,
  customers,
  stores,
  userRole,
  userStoreId,
}: ProformaFormProps) {
  const router = useRouter()
  const locale = useLocale()
  const dateLocale = locale === 'fr' ? fr : enUS
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const t = useTranslations('Proformas.form')

  const isEditing = !!initialData

  const [selectedProducts, setSelectedProducts] = useState<ProformaItem[]>(
    initialData?.items || []
  )
  const [productSearchOpen, setProductSearchOpen] = useState(false)
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false)

  const form = useForm({
    defaultValues: initialData
      ? {
          store_id: initialData.store_id,
          customer_id: initialData.customer_id || '',
          tax: initialData.tax.toString(),
          discount: initialData.discount.toString(),
          notes: initialData.notes || '',
          terms: initialData.terms || '',
          valid_until: initialData.valid_until || '',
        }
      : {
          store_id: userStoreId || '',
          customer_id: '',
          tax: '0',
          discount: '0',
          notes: '',
          terms: '',
          valid_until: '',
        },
    onSubmit: async ({ value }) => {
      setError(null)

      if (selectedProducts.length === 0) {
        setError(t('errors.noItems'))
        return
      }

      startTransition(async () => {
        const items = selectedProducts.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount: item.discount,
          notes: item.notes,
        }))

        const proformaData = {
          store_id: value.store_id,
          customer_id: value.customer_id || null,
          tax: parseFloat(value.tax) || 0,
          discount: parseFloat(value.discount) || 0,
          notes: value.notes || undefined,
          terms: value.terms || undefined,
          valid_until: value.valid_until || null,
          items,
        }

        const result = isEditing
          ? await updateProforma({
              proforma_id: initialData.id,
              ...proformaData,
            })
          : await createProforma(proformaData)

        if (result.success) {
          router.push('/proformas')
          router.refresh()
        } else {
          setError(result.error || t('errors.generic'))
        }
      })
    },
  })

  const addProduct = (product: Product) => {
    const existingIndex = selectedProducts.findIndex(
      (p) => p.product_id === product.id
    )
    if (existingIndex >= 0) {
      const updated = [...selectedProducts]
      updated[existingIndex].quantity += 1
      setSelectedProducts(updated)
    } else {
      setSelectedProducts([
        ...selectedProducts,
        {
          product_id: product.id,
          product_name: product.name,
          product_sku: product.sku,
          quantity: 1,
          unit_price: product.price,
          discount: 0,
          notes: '',
        },
      ])
    }
    setProductSearchOpen(false)
  }

  const removeProduct = (index: number) => {
    setSelectedProducts(selectedProducts.filter((_, i) => i !== index))
  }

  const updateProductItem = (
    index: number,
    field: keyof ProformaItem,
    value: string | number
  ) => {
    const updated = [...selectedProducts]
    updated[index] = { ...updated[index], [field]: value }
    setSelectedProducts(updated)
  }

  const calculateSubtotal = () => {
    return selectedProducts.reduce((sum, item) => {
      return sum + item.unit_price * item.quantity - item.discount
    }, 0)
  }

  const calculateTotal = () => {
    const subtotal = calculateSubtotal()
    const tax = parseFloat(form.state.values.tax) || 0
    const discount = parseFloat(form.state.values.discount) || 0
    return subtotal + tax - discount
  }

  const formatCurrency = (amount: number) => {
    const formatted = new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
    return `${formatted} CFA`
  }

  const selectedCustomer = customers.find(
    (c) => c.id === form.state.values.customer_id
  )

  // Determine available stores based on user role
  const availableStores =
    userRole === 'admin' ? stores : stores.filter((s) => s.id === userStoreId)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        form.handleSubmit()
      }}
      className="space-y-6"
    >
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Main Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Store & Customer */}
          <Card>
            <CardHeader>
              <CardTitle>{t('sections.general')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {/* Store Selection */}
                <form.Field name="store_id">
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor="store_id">{t('store')} *</Label>
                      <Select
                        value={field.state.value}
                        onValueChange={field.handleChange}
                        disabled={userRole !== 'admin'}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('selectStore')} />
                        </SelectTrigger>
                        <SelectContent>
                          {availableStores.map((store) => (
                            <SelectItem key={store.id} value={store.id}>
                              {store.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </form.Field>

                {/* Customer Selection */}
                <form.Field name="customer_id">
                  {(field) => (
                    <div className="space-y-2">
                      <Label>{t('customer')}</Label>
                      <Popover
                        open={customerSearchOpen}
                        onOpenChange={setCustomerSearchOpen}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            className="w-full justify-between"
                          >
                            {selectedCustomer
                              ? selectedCustomer.name
                              : t('selectCustomer')}
                            <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-0">
                          <Command>
                            <CommandInput placeholder={t('searchCustomer')} />
                            <CommandList>
                              <CommandEmpty>{t('noCustomerFound')}</CommandEmpty>
                              <CommandGroup>
                                <CommandItem
                                  onSelect={() => {
                                    field.handleChange('')
                                    setCustomerSearchOpen(false)
                                  }}
                                >
                                  <span className="text-muted-foreground">
                                    {t('noCustomer')}
                                  </span>
                                </CommandItem>
                                {customers.map((customer) => (
                                  <CommandItem
                                    key={customer.id}
                                    onSelect={() => {
                                      field.handleChange(customer.id)
                                      setCustomerSearchOpen(false)
                                    }}
                                  >
                                    <div>
                                      <p className="font-medium">{customer.name}</p>
                                      {customer.phone && (
                                        <p className="text-xs text-muted-foreground">
                                          {customer.phone}
                                        </p>
                                      )}
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}
                </form.Field>
              </div>

              {/* Valid Until */}
              <form.Field name="valid_until">
                {(field) => (
                  <div className="space-y-2">
                    <Label>{t('validUntil')}</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full justify-start text-left font-normal',
                            !field.state.value && 'text-muted-foreground'
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.state.value
                            ? format(new Date(field.state.value), 'PPP', {
                                locale: dateLocale,
                              })
                            : t('selectDate')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={
                            field.state.value
                              ? new Date(field.state.value)
                              : undefined
                          }
                          onSelect={(date: Date | undefined) =>
                            field.handleChange(
                              date ? date.toISOString().split('T')[0] : ''
                            )
                          }
                          disabled={(date: Date) => date < new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                )}
              </form.Field>
            </CardContent>
          </Card>

          {/* Products */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t('sections.items')}</CardTitle>
              <Popover
                open={productSearchOpen}
                onOpenChange={setProductSearchOpen}
              >
                <PopoverTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    {t('addProduct')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0">
                  <Command>
                    <CommandInput placeholder={t('searchProduct')} />
                    <CommandList>
                      <CommandEmpty>{t('noProductFound')}</CommandEmpty>
                      <CommandGroup>
                        {products.map((product) => (
                          <CommandItem
                            key={product.id}
                            onSelect={() => addProduct(product)}
                          >
                            <div className="flex-1">
                              <p className="font-medium">{product.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {product.sku} - {formatCurrency(product.price)}
                              </p>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </CardHeader>
            <CardContent>
              {selectedProducts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {t('noItemsAdded')}
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedProducts.map((item, index) => (
                    <div
                      key={`${item.product_id}-${index}`}
                      className="rounded-lg border p-4 space-y-4"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{item.product_name}</p>
                          <p className="text-sm text-muted-foreground font-mono">
                            {item.product_sku}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeProduct(index)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                      <div className="grid gap-4 md:grid-cols-4">
                        <div className="space-y-2">
                          <Label>{t('quantity')}</Label>
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) =>
                              updateProductItem(
                                index,
                                'quantity',
                                parseInt(e.target.value) || 1
                              )
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>{t('unitPrice')}</Label>
                          <Input
                            type="number"
                            min="0"
                            value={item.unit_price}
                            onChange={(e) =>
                              updateProductItem(
                                index,
                                'unit_price',
                                parseFloat(e.target.value) || 0
                              )
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>{t('itemDiscount')}</Label>
                          <Input
                            type="number"
                            min="0"
                            value={item.discount}
                            onChange={(e) =>
                              updateProductItem(
                                index,
                                'discount',
                                parseFloat(e.target.value) || 0
                              )
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>{t('lineTotal')}</Label>
                          <Input
                            readOnly
                            value={formatCurrency(
                              item.unit_price * item.quantity - item.discount
                            )}
                            className="bg-muted"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes & Terms */}
          <Card>
            <CardHeader>
              <CardTitle>{t('sections.additional')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form.Field name="notes">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor="notes">{t('notes')}</Label>
                    <Textarea
                      id="notes"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder={t('notesPlaceholder')}
                      rows={3}
                    />
                  </div>
                )}
              </form.Field>

              <form.Field name="terms">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor="terms">{t('terms')}</Label>
                    <Textarea
                      id="terms"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder={t('termsPlaceholder')}
                      rows={3}
                    />
                  </div>
                )}
              </form.Field>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Summary */}
        <div className="space-y-6">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>{t('sections.summary')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('subtotal')}</span>
                  <span>{formatCurrency(calculateSubtotal())}</span>
                </div>

                <form.Field name="tax">
                  {(field) => (
                    <div className="flex items-center gap-2">
                      <Label className="text-sm text-muted-foreground flex-1">
                        {t('tax')}
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        className="w-32 text-right"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                    </div>
                  )}
                </form.Field>

                <form.Field name="discount">
                  {(field) => (
                    <div className="flex items-center gap-2">
                      <Label className="text-sm text-muted-foreground flex-1">
                        {t('globalDiscount')}
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        className="w-32 text-right"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                    </div>
                  )}
                </form.Field>
              </div>

              <Separator />

              <div className="flex justify-between font-medium text-lg">
                <span>{t('total')}</span>
                <span>{formatCurrency(calculateTotal())}</span>
              </div>

              <Separator />

              <div className="space-y-2">
                <Button type="submit" className="w-full" disabled={isPending}>
                  {isPending
                    ? t('saving')
                    : isEditing
                    ? t('update')
                    : t('create')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => router.back()}
                >
                  {t('cancel')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  )
}
