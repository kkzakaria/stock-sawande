'use client'

import { useRef, useMemo, useEffect, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
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
  totalQuantity?: number
  otherStoresInventory?: OtherStoreInventory[]
}

interface POSProductGridProps {
  products: Product[]
  searchQuery: string
  onSearchChange: (query: string) => void
}

// Match Tailwind's md/lg viewport breakpoints: grid-cols-2 md:grid-cols-3 lg:grid-cols-4
function useColumnCount() {
  const [columnCount, setColumnCount] = useState(2)

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth
      if (w >= 1024) setColumnCount(4)
      else if (w >= 768) setColumnCount(3)
      else setColumnCount(2)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  return columnCount
}

// Estimated card height: 128px image + ~164px content + 12px gap
const ROW_HEIGHT_ESTIMATE = 304

export function POSProductGrid({
  products,
  searchQuery,
  onSearchChange,
}: POSProductGridProps) {
  const t = useTranslations('POS.search')
  const tCommon = useTranslations('Common')
  const addItem = useCartStore((state) => state.addItem)
  const scrollRef = useRef<HTMLDivElement>(null)
  const columnCount = useColumnCount()

  // Group products into rows of columnCount
  const rows = useMemo(() => {
    const result: Product[][] = []
    for (let i = 0; i < products.length; i += columnCount) {
      result.push(products.slice(i, i + columnCount))
    }
    return result
  }, [products, columnCount])

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT_ESTIMATE,
    overscan: 2,
  })

  const handleAddToCart = (product: Product) => {
    if (product.quantity <= 0) return

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

  const hasFlexiblePrice = (product: Product) =>
    product.minPrice !== null || product.maxPrice !== null

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

      {/* Product Grid - Virtualized */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden">
        {products.length === 0 ? (
          <div className="flex h-full items-center justify-center text-gray-400">
            <div className="text-center">
              <Package className="mx-auto h-12 w-12 mb-2" />
              <p>{t('noResults')}</p>
            </div>
          </div>
        ) : (
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <div
                  className="grid gap-3 pb-3"
                  style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
                >
                  {rows[virtualRow.index].map((product) => (
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
                        <h3 className="font-medium text-sm line-clamp-2 mb-0.5">
                          {product.name}
                        </h3>

                        <p className="text-xs text-gray-500 mb-1.5">{product.sku}</p>

                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1">
                            <span
                              className={`text-lg font-bold ${hasFlexiblePrice(product) ? 'text-orange-600' : 'text-blue-600'}`}
                            >
                              {formatCurrency(product.price)}
                            </span>
                            {hasFlexiblePrice(product) && (
                              <span
                                className="text-xs text-orange-500"
                                title={t('flexiblePrice')}
                              >
                                ~
                              </span>
                            )}
                          </div>
                          <POSStockIndicator
                            quantity={product.quantity}
                            otherStoresInventory={product.otherStoresInventory ?? []}
                          />
                        </div>

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
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
