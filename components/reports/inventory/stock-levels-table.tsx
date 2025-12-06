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
import type { StockLevelItem } from '@/lib/actions/reports'

interface StockLevelsTableProps {
  data: StockLevelItem[]
}

export function StockLevelsTable({ data }: StockLevelsTableProps) {
  const t = useTranslations('Reports.inventory')

  const formatCurrency = (value: number) => {
    const formatted = new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
    return `${formatted} CFA`
  }

  const getStatusBadge = (status: 'in_stock' | 'low_stock' | 'out_of_stock') => {
    switch (status) {
      case 'in_stock':
        return <Badge variant="default" className="bg-green-500">{t('status.inStock')}</Badge>
      case 'low_stock':
        return <Badge variant="default" className="bg-yellow-500">{t('status.lowStock')}</Badge>
      case 'out_of_stock':
        return <Badge variant="destructive">{t('status.outOfStock')}</Badge>
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('stockLevels')}</CardTitle>
        <CardDescription>{t('stockLevelsDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('product')}</TableHead>
                <TableHead>{t('category')}</TableHead>
                <TableHead>{t('store')}</TableHead>
                <TableHead className="text-right">{t('quantity')}</TableHead>
                <TableHead className="text-right">{t('minLevel')}</TableHead>
                <TableHead className="text-right">{t('stockValue')}</TableHead>
                <TableHead>{t('status.label')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    {t('noData')}
                  </TableCell>
                </TableRow>
              ) : (
                data.map((item) => (
                  <TableRow key={item.inventoryId}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.sku}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.categoryName || (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{item.storeName}</TableCell>
                    <TableCell className="text-right font-medium">
                      {item.quantity.toLocaleString('fr-FR')}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.minStockLevel.toLocaleString('fr-FR')}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(item.stockValue)}
                    </TableCell>
                    <TableCell>{getStatusBadge(item.status)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
