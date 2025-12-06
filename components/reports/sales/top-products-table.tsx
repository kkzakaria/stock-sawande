'use client'

import { useTranslations } from 'next-intl'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { TopProductItem } from '@/lib/actions/reports'

interface TopProductsTableProps {
  data: TopProductItem[]
}

export function TopProductsTable({ data }: TopProductsTableProps) {
  const t = useTranslations('Reports.sales')

  const formatCurrency = (value: number) => {
    const formatted = new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
    return `${formatted} CFA`
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('topProducts')}</CardTitle>
        <CardDescription>{t('topProductsDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>{t('product')}</TableHead>
              <TableHead>{t('category')}</TableHead>
              <TableHead className="text-right">{t('unitsSold')}</TableHead>
              <TableHead className="text-right">{t('revenue')}</TableHead>
              <TableHead className="text-right">{t('avgPrice')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  {t('noProducts')}
                </TableCell>
              </TableRow>
            ) : (
              data.map((product, index) => (
                <TableRow key={product.productId}>
                  <TableCell>
                    <Badge variant={index < 3 ? 'default' : 'secondary'}>
                      {index + 1}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-xs text-muted-foreground">{product.sku}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {product.categoryName || (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {product.unitsSold.toLocaleString('fr-FR')}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(product.revenue)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(product.avgPrice)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
