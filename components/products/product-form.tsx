'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from '@tanstack/react-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { createProduct, updateProduct } from '@/lib/actions/products'
import { AlertCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface ProductData {
  id?: string
  template_id?: string | null
  inventory_id?: string | null
  sku: string | null
  name: string | null
  description?: string | null
  category_id?: string | null
  category_name?: string | null
  price: number | null
  cost?: number | null
  quantity: number | null
  min_stock_level?: number | null
  store_id: string | null
  store_name?: string | null
  image_url?: string | null
  barcode?: string | null
  is_active?: boolean | null
  categories?: { id: string; name: string } | null
  stores?: { id: string; name: string } | null
  all_inventories?: Array<{ created_at: string; id: string; product_id: string; quantity: number; store_id: string; updated_at: string }> | null
}

interface ProductFormProps {
  initialData?: ProductData
  categories: Array<{ id: string; name: string }>
  stores: Array<{ id: string; name: string }>
  userRole: string
  userStoreId: string | null
}

export function ProductForm({
  initialData,
  categories,
  stores,
  userRole,
  userStoreId,
}: ProductFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const t = useTranslations('Products.form')
  const tCategories = useTranslations('Products.categories')

  const isEditing = !!initialData

  const form = useForm({
    defaultValues: initialData
      ? {
          sku: initialData.sku || '',
          name: initialData.name || '',
          description: initialData.description || '',
          category_id: initialData.category_id || 'uncategorized',
          price: initialData.price?.toString() || '0',
          cost: initialData.cost?.toString() || '',
          quantity: initialData.quantity?.toString() || '0',
          min_stock_level: initialData.min_stock_level?.toString() || '10',
          store_id: initialData.store_id || '',
          image_url: initialData.image_url || '',
          barcode: initialData.barcode || '',
          is_active: initialData.is_active ?? true,
        }
      : {
          sku: '',
          name: '',
          description: '',
          category_id: 'uncategorized',
          price: '0',
          cost: '',
          quantity: '0',
          min_stock_level: '10',
          store_id: userStoreId || '',
          image_url: '',
          barcode: '',
          is_active: true,
        },
    onSubmit: async ({ value }) => {
      setError(null)
      startTransition(async () => {
        // Convert string values to numbers
        const productData = {
          ...value,
          price: parseFloat(value.price),
          cost: value.cost ? parseFloat(value.cost) : undefined,
          quantity: parseInt(value.quantity, 10),
          min_stock_level: parseInt(value.min_stock_level, 10),
          category_id: value.category_id === 'uncategorized' ? null : value.category_id || null,
        }

        const result = isEditing
          ? await updateProduct(initialData.template_id || initialData.id!, productData)
          : await createProduct(productData)

        if (result.success) {
          router.push('/products')
          router.refresh()
        } else {
          setError(result.error || t('errors.generic'))
        }
      })
    },
  })

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

      <Card>
        <CardHeader>
          <CardTitle>{t('sections.basicInfo')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <form.Field
              name="sku"
              validators={{
                onChange: ({ value }) => {
                  if (!value || value.length === 0) {
                    return t('errors.skuRequired')
                  }
                  return undefined
                },
              }}
            >
              {(field) => (
                <div className="space-y-2">
                  <label htmlFor={field.name} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    {t('fields.sku')} *
                  </label>
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder={t('fields.skuPlaceholder')}
                  />
                  <p className="text-sm text-muted-foreground">{t('descriptions.sku')}</p>
                  {field.state.meta.errors.length > 0 && (
                    <p className="text-sm font-medium text-destructive">{field.state.meta.errors[0]}</p>
                  )}
                </div>
              )}
            </form.Field>

            <form.Field
              name="name"
              validators={{
                onChange: ({ value }) => {
                  if (!value || value.length === 0) {
                    return t('errors.nameRequired')
                  }
                  return undefined
                },
              }}
            >
              {(field) => (
                <div className="space-y-2">
                  <label htmlFor={field.name} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    {t('fields.name')} *
                  </label>
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder={t('fields.namePlaceholder')}
                  />
                  {field.state.meta.errors.length > 0 && (
                    <p className="text-sm font-medium text-destructive">{field.state.meta.errors[0]}</p>
                  )}
                </div>
              )}
            </form.Field>
          </div>

          <form.Field name="description">
            {(field) => (
              <div className="space-y-2">
                <label htmlFor={field.name} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  {t('fields.description')}
                </label>
                <Textarea
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder={t('fields.descriptionPlaceholder')}
                  className="resize-none"
                />
              </div>
            )}
          </form.Field>

          <div className="grid gap-4 md:grid-cols-2">
            <form.Field name="category_id">
              {(field) => (
                <div className="space-y-2">
                  <label htmlFor={field.name} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    {t('fields.category')}
                  </label>
                  <Select
                    value={field.state.value || ''}
                    onValueChange={(value) => field.handleChange(value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('fields.categoryPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="uncategorized">{tCategories('uncategorized')}</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </form.Field>

            <form.Field name="barcode">
              {(field) => (
                <div className="space-y-2">
                  <label htmlFor={field.name} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    {t('fields.barcode')}
                  </label>
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder={t('fields.barcodePlaceholder')}
                  />
                </div>
              )}
            </form.Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('sections.pricingInventory')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <form.Field
              name="price"
              validators={{
                onChange: ({ value }) => {
                  const num = parseFloat(value)
                  if (isNaN(num) || num < 0) {
                    return t('errors.pricePositive')
                  }
                  return undefined
                },
              }}
            >
              {(field) => (
                <div className="space-y-2">
                  <label htmlFor={field.name} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    {t('fields.price')} *
                  </label>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="number"
                    step="0.01"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder={t('fields.pricePlaceholder')}
                  />
                  <p className="text-sm text-muted-foreground">{t('descriptions.price')}</p>
                  {field.state.meta.errors.length > 0 && (
                    <p className="text-sm font-medium text-destructive">{field.state.meta.errors[0]}</p>
                  )}
                </div>
              )}
            </form.Field>

            <form.Field name="cost">
              {(field) => (
                <div className="space-y-2">
                  <label htmlFor={field.name} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    {t('fields.cost')}
                  </label>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="number"
                    step="0.01"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder={t('fields.costPlaceholder')}
                  />
                  <p className="text-sm text-muted-foreground">{t('descriptions.cost')}</p>
                </div>
              )}
            </form.Field>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <form.Field
              name="quantity"
              validators={{
                onChange: ({ value }) => {
                  const num = parseInt(value, 10)
                  if (isNaN(num) || num < 0) {
                    return t('errors.quantityNonNegative')
                  }
                  return undefined
                },
              }}
            >
              {(field) => (
                <div className="space-y-2">
                  <label htmlFor={field.name} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    {t('fields.quantity')} *
                  </label>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="number"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder={t('fields.quantityPlaceholder')}
                  />
                  <p className="text-sm text-muted-foreground">{t('descriptions.quantity')}</p>
                  {field.state.meta.errors.length > 0 && (
                    <p className="text-sm font-medium text-destructive">{field.state.meta.errors[0]}</p>
                  )}
                </div>
              )}
            </form.Field>

            <form.Field
              name="min_stock_level"
              validators={{
                onChange: ({ value }) => {
                  const num = parseInt(value, 10)
                  if (isNaN(num) || num < 0) {
                    return t('errors.minStockNonNegative')
                  }
                  return undefined
                },
              }}
            >
              {(field) => (
                <div className="space-y-2">
                  <label htmlFor={field.name} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    {t('fields.minStockLevel')} *
                  </label>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="number"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder={t('fields.minStockPlaceholder')}
                  />
                  <p className="text-sm text-muted-foreground">{t('descriptions.minStock')}</p>
                  {field.state.meta.errors.length > 0 && (
                    <p className="text-sm font-medium text-destructive">{field.state.meta.errors[0]}</p>
                  )}
                </div>
              )}
            </form.Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('sections.storeStatus')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form.Field
            name="store_id"
            validators={{
              onChange: ({ value }) => {
                if (!value || value.length === 0) {
                  return t('errors.storeRequired')
                }
                return undefined
              },
            }}
          >
            {(field) => (
              <div className="space-y-2">
                <label htmlFor={field.name} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  {t('fields.store')} *
                </label>
                <Select
                  value={field.state.value}
                  onValueChange={(value) => field.handleChange(value)}
                  disabled={userRole !== 'admin'}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('fields.storePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {stores.map((store) => (
                      <SelectItem key={store.id} value={store.id}>
                        {store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {userRole !== 'admin' && (
                  <p className="text-sm text-muted-foreground">
                    {t('descriptions.managerStore')}
                  </p>
                )}
                {field.state.meta.errors.length > 0 && (
                  <p className="text-sm font-medium text-destructive">{field.state.meta.errors[0]}</p>
                )}
              </div>
            )}
          </form.Field>

          <form.Field
            name="image_url"
            validators={{
              onChange: ({ value }) => {
                if (value && value.length > 0 && value !== '') {
                  try {
                    new URL(value)
                  } catch {
                    return t('errors.invalidUrl')
                  }
                }
                return undefined
              },
            }}
          >
            {(field) => (
              <div className="space-y-2">
                <label htmlFor={field.name} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  {t('fields.imageUrl')}
                </label>
                <Input
                  id={field.name}
                  name={field.name}
                  type="url"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder={t('fields.imageUrlPlaceholder')}
                />
                {field.state.meta.errors.length > 0 && (
                  <p className="text-sm font-medium text-destructive">{field.state.meta.errors[0]}</p>
                )}
              </div>
            )}
          </form.Field>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isPending}
        >
          {t('buttons.cancel')}
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? t('buttons.saving') : isEditing ? t('buttons.update') : t('buttons.create')}
        </Button>
      </div>
    </form>
  )
}
