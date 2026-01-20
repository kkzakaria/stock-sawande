import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { OptimizedImage } from '@/components/ui/optimized-image'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ChevronLeft, Pencil, Package } from 'lucide-react'
import { getProduct } from '@/lib/actions/products'
import { ProductStatsComponent } from '@/components/products/product-stats'
import { StockMovementsHistory } from '@/components/products/stock-movements-history'

export const dynamic = 'force-dynamic'

interface ProductDetailPageProps {
  params: Promise<{
    id: string
    locale: string
  }>
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Get user profile to check role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, store_id')
    .eq('id', user!.id)
    .single()

  // Only admin and manager can view product details
  if (!['admin', 'manager'].includes(profile?.role || '')) {
    redirect('/dashboard')
  }

  // Fetch product
  const productResult = await getProduct(id)
  if (!productResult.success || !productResult.data) {
    notFound()
  }

  const product = productResult.data

  const getStockStatus = (quantity: number, minLevel: number | null) => {
    if (quantity === 0) {
      return <Badge variant="destructive">Out of Stock</Badge>
    } else if (minLevel && quantity <= minLevel) {
      return (
        <Badge variant="outline" className="border-orange-500 text-orange-500">
          Low Stock
        </Badge>
      )
    }
    return (
      <Badge variant="outline" className="border-green-500 text-green-500">
        In Stock
      </Badge>
    )
  }

  // Get all inventories with store information
  const allInventories = product.all_inventories || []
  const totalQuantity = allInventories.reduce((sum, inv) => sum + (inv.quantity || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/products">
                <ChevronLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h2 className="text-3xl font-bold tracking-tight">{product.name}</h2>
              <p className="text-sm text-muted-foreground">SKU: {product.sku}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {product.is_active ? (
              <Badge variant="default">Active</Badge>
            ) : (
              <Badge variant="secondary">Inactive</Badge>
            )}
            <Button asChild>
              <Link href={`/products/${id}/edit`}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Link>
            </Button>
          </div>
        </div>

        <Separator />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Product Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {product.image_url && (
              <div className="relative aspect-square w-full max-w-xs overflow-hidden rounded-lg border">
                <OptimizedImage
                  src={product.image_url}
                  alt={product.name}
                  fill
                  className="object-cover"
                />
              </div>
            )}

            {!product.image_url && (
              <div className="flex aspect-square w-full max-w-xs items-center justify-center rounded-lg border bg-muted">
                <Package className="h-16 w-16 text-muted-foreground" />
              </div>
            )}

            <div className="space-y-2">
              <div>
                <span className="text-sm font-medium">Name:</span>
                <p className="text-sm text-muted-foreground">{product.name}</p>
              </div>
              {product.description && (
                <div>
                  <span className="text-sm font-medium">Description:</span>
                  <p className="text-sm text-muted-foreground">{product.description}</p>
                </div>
              )}
              <div>
                <span className="text-sm font-medium">Category:</span>
                <p className="text-sm text-muted-foreground">
                  {product.category_name || 'Uncategorized'}
                </p>
              </div>
              {product.barcode && (
                <div>
                  <span className="text-sm font-medium">Barcode:</span>
                  <p className="text-sm font-mono text-muted-foreground">{product.barcode}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Pricing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Sale Price:</span>
                <span className="text-2xl font-bold">${product.price.toFixed(2)}</span>
              </div>
              {product.cost && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Cost:</span>
                    <span className="text-sm text-muted-foreground">
                      ${product.cost.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t pt-2">
                    <span className="text-sm font-medium">Margin:</span>
                    <span className="text-sm font-semibold text-green-600">
                      ${(product.price - product.cost).toFixed(2)} (
                      {(((product.price - product.cost) / product.price) * 100).toFixed(1)}
                      %)
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Inventory Across Stores</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Total Stock:</span>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">{totalQuantity}</span>
                  {getStockStatus(totalQuantity, product.min_stock_level)}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Min Stock Level:</span>
                <span className="text-sm text-muted-foreground">{product.min_stock_level}</span>
              </div>

              <Separator />

              <div className="space-y-2">
                <p className="text-sm font-medium">Stock by Store:</p>
                {allInventories.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Not available in any store</p>
                ) : (
                  <div className="space-y-2">
                    {allInventories.map((inventory) => (
                      <div
                        key={inventory.id}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div>
                          <p className="font-medium">{inventory.store_name || 'Unknown Store'}</p>
                          <p className="text-sm text-muted-foreground">Quantity: {inventory.quantity}</p>
                        </div>
                        <div>
                          {getStockStatus(inventory.quantity || 0, product.min_stock_level)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Created:</span>
                <span>{new Date(product.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Last Updated:</span>
                <span>{new Date(product.updated_at).toLocaleDateString()}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Product Statistics */}
      <ProductStatsComponent productId={product.template_id} />

      {/* Stock Movement History */}
      <StockMovementsHistory productId={product.template_id} />
    </div>
  )
}
