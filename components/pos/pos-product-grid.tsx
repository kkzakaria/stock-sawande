'use client'

/**
 * POS Product Grid Component
 * Displays products in a grid with search functionality
 */

import { useTranslations } from 'next-intl'
import { OptimizedImage } from '@/components/ui/optimized-image'
import { useCartStore } from '@/lib/store/cart-store'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Search, Plus, Package } from 'lucide-react'
import { formatCurrency } from '@/lib/store/cart-store'
import { POSStockIndicator } from './pos-stock-indicator'

interface OtherStoreInventory {
  storeId: string
  storeName: string
  quantity: number
}

interface Product {
  id: string
  sku: string
  name: string
  price: number
  minPrice: number | null
  maxPrice: number | null
  barcode: string | null
  imageUrl: string | null
  category: { id: string; name: string } | null
  inventoryId: string
  quantity: number
  // Multi-store info
  totalQuantity?: number
  otherStoresInventory?: OtherStoreInventory[]
}

interface POSProductGridProps {
  products: Product[]
  searchQuery: string
  onSearchChange: (query: string) => void
}

export function POSProductGrid({
  products,
  searchQuery,
  onSearchChange,
}: POSProductGridProps) {
  const t = useTranslations('POS.search')
  const tCommon = useTranslations('Common')
  const addItem = useCartStore((state) => state.addItem)

  const handleAddToCart = (product: Product) => {
    if (product.quantity <= 0) {
      // Show toast or alert that product is out of stock
      return
    }

    addItem({
      productId: product.id,
      inventoryId: product.inventoryId,
      name: product.name,
      sku: product.sku,
      barcode: product.barcode,
      originalPrice: product.price,
      minPrice: product.minPrice,
      maxPrice: product.maxPrice,
      maxStock: product.quantity,
    })
  }

  // Helper to check if product has flexible pricing
  const hasFlexiblePrice = (product: Product) => {
    return product.minPrice !== null || product.maxPrice !== null
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Search Bar - Fixed */}
      <div className="flex-shrink-0 pb-4 bg-white">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            type="text"
            placeholder={t('placeholder')}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
            autoFocus
          />
        </div>
      </div>

      {/* Product Grid - Scrollable */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {products.length === 0 ? (
          <div className="flex h-full items-center justify-center text-gray-400">
            <div className="text-center">
              <Package className="mx-auto h-12 w-12 mb-2" />
              <p>{t('noResults')}</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pb-4">
            {products.map((product) => (
              <Card
                key={product.id}
                className="cursor-pointer transition-all hover:shadow-md overflow-hidden !p-0"
                onClick={() => handleAddToCart(product)}
              >
                {/* Product Image */}
                <div className="relative h-32 w-full bg-gray-100 flex items-center justify-center">
                  {product.imageUrl ? (
                    <OptimizedImage
                      src={product.imageUrl}
                      alt={product.name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    />
                  ) : (
                    <Package className="h-12 w-12 text-gray-300" />
                  )}
                </div>

                <div className="p-2 pt-1">
                  {/* Product Name */}
                  <h3 className="font-medium text-sm line-clamp-2 mb-0.5">
                    {product.name}
                  </h3>

                  {/* SKU */}
                  <p className="text-xs text-gray-500 mb-1.5">
                    {product.sku}
                  </p>

                  {/* Price and Stock */}
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1">
                      <span className={`text-lg font-bold ${hasFlexiblePrice(product) ? 'text-orange-600' : 'text-blue-600'}`}>
                        {formatCurrency(product.price)}
                      </span>
                      {hasFlexiblePrice(product) && (
                        <span className="text-xs text-orange-500" title={t('flexiblePrice')}>~</span>
                      )}
                    </div>
                    <POSStockIndicator
                      quantity={product.quantity}
                      otherStoresInventory={product.otherStoresInventory ?? []}
                    />
                  </div>

                  {/* Add Button */}
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={product.quantity <= 0}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleAddToCart(product)
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    {tCommon('add')}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
