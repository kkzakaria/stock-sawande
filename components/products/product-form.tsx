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

interface ProductData {
  id?: string
  sku: string
  name: string
  description?: string | null
  category_id?: string | null
  price: number
  cost?: number | null
  quantity: number
  min_stock_level?: number | null
  store_id: string | null
  image_url?: string | null
  barcode?: string | null
  is_active?: boolean | null
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

  const isEditing = !!initialData

  const form = useForm({
    defaultValues: initialData
      ? {
          sku: initialData.sku,
          name: initialData.name,
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
          ? await updateProduct(initialData.id!, productData)
          : await createProduct(productData)

        if (result.success) {
          router.push('/products')
          router.refresh()
        } else {
          setError(result.error || 'An error occurred')
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
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <form.Field
              name="sku"
              validators={{
                onChange: ({ value }) => {
                  if (!value || value.length === 0) {
                    return 'SKU is required'
                  }
                  return undefined
                },
              }}
            >
              {(field) => (
                <div className="space-y-2">
                  <label htmlFor={field.name} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    SKU *
                  </label>
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="PROD-001"
                  />
                  <p className="text-sm text-muted-foreground">Unique product identifier</p>
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
                    return 'Name is required'
                  }
                  return undefined
                },
              }}
            >
              {(field) => (
                <div className="space-y-2">
                  <label htmlFor={field.name} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Product Name *
                  </label>
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Product name"
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
                  Description
                </label>
                <Textarea
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Product description"
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
                    Category
                  </label>
                  <Select
                    value={field.state.value || ''}
                    onValueChange={(value) => field.handleChange(value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="uncategorized">Uncategorized</SelectItem>
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
                    Barcode
                  </label>
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="123456789"
                  />
                </div>
              )}
            </form.Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pricing & Inventory</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <form.Field
              name="price"
              validators={{
                onChange: ({ value }) => {
                  const num = parseFloat(value)
                  if (isNaN(num) || num < 0) {
                    return 'Price must be a positive number'
                  }
                  return undefined
                },
              }}
            >
              {(field) => (
                <div className="space-y-2">
                  <label htmlFor={field.name} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Sale Price *
                  </label>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="number"
                    step="0.01"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="0.00"
                  />
                  <p className="text-sm text-muted-foreground">Customer-facing price</p>
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
                    Cost
                  </label>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="number"
                    step="0.01"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="0.00"
                  />
                  <p className="text-sm text-muted-foreground">Internal cost</p>
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
                    return 'Quantity must be a non-negative number'
                  }
                  return undefined
                },
              }}
            >
              {(field) => (
                <div className="space-y-2">
                  <label htmlFor={field.name} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Quantity *
                  </label>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="number"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="0"
                  />
                  <p className="text-sm text-muted-foreground">Current stock level</p>
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
                    return 'Min stock level must be a non-negative number'
                  }
                  return undefined
                },
              }}
            >
              {(field) => (
                <div className="space-y-2">
                  <label htmlFor={field.name} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Min Stock Level *
                  </label>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="number"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="10"
                  />
                  <p className="text-sm text-muted-foreground">Low stock alert threshold</p>
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
          <CardTitle>Store & Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form.Field
            name="store_id"
            validators={{
              onChange: ({ value }) => {
                if (!value || value.length === 0) {
                  return 'Store is required'
                }
                return undefined
              },
            }}
          >
            {(field) => (
              <div className="space-y-2">
                <label htmlFor={field.name} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Store *
                </label>
                <Select
                  value={field.state.value}
                  onValueChange={(value) => field.handleChange(value)}
                  disabled={userRole !== 'admin'}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select store" />
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
                    Managers can only create products for their assigned store
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
                    return 'Invalid URL format'
                  }
                }
                return undefined
              },
            }}
          >
            {(field) => (
              <div className="space-y-2">
                <label htmlFor={field.name} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Image URL
                </label>
                <Input
                  id={field.name}
                  name={field.name}
                  type="url"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="https://example.com/image.jpg"
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
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving...' : isEditing ? 'Update Product' : 'Create Product'}
        </Button>
      </div>
    </form>
  )
}
