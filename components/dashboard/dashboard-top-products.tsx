'use client'

import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TableSkeleton } from '@/components/charts'
import type { TopProduct } from '@/lib/actions/dashboard'

interface DashboardTopProductsProps {
  products: TopProduct[]
  loading: boolean
}

export function DashboardTopProducts({ products, loading }: DashboardTopProductsProps) {
  const t = useTranslations('Dashboard')

  const formatCurrency = (value: number) => {
    const formatted = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)
    return `${formatted} CFA`
  }

  if (loading) {
    return <TableSkeleton rows={5} columns={3} />
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('topProducts.title')}</CardTitle>
        <CardDescription>{t('topProducts.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        {products.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {t('topProducts.noData')}
          </p>
        ) : (
          <div className="space-y-4">
            {products.map((product, index) => (
              <div
                key={product.productId}
                className="flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{product.productName}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{product.sku}</span>
                      {product.categoryName && (
                        <Badge variant="secondary" className="text-xs">
                          {product.categoryName}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-medium">{formatCurrency(product.totalRevenue)}</p>
                  <p className="text-xs text-muted-foreground">
                    {product.unitsSold} {t('topProducts.units')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
