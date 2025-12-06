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
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import type { CashierPerformanceItem } from '@/lib/actions/reports'

interface CashierPerformanceTableProps {
  data: CashierPerformanceItem[]
}

export function CashierPerformanceTable({ data }: CashierPerformanceTableProps) {
  const t = useTranslations('Reports.performance')

  const formatCurrency = (value: number) => {
    const formatted = new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
    return `${formatted} CFA`
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  // Sort by total sales descending
  const sortedData = [...data].sort((a, b) => b.totalSales - a.totalSales)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('cashierPerformance')}</CardTitle>
        <CardDescription>{t('cashierPerformanceDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>{t('cashier')}</TableHead>
                <TableHead>{t('store')}</TableHead>
                <TableHead className="text-right">{t('transactions')}</TableHead>
                <TableHead className="text-right">{t('totalSales')}</TableHead>
                <TableHead className="text-right">{t('avgTransaction')}</TableHead>
                <TableHead className="text-right">{t('refunds')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    {t('noData')}
                  </TableCell>
                </TableRow>
              ) : (
                sortedData.map((cashier, index) => (
                  <TableRow key={cashier.cashierId}>
                    <TableCell>
                      <Badge variant={index < 3 ? 'default' : 'secondary'}>
                        {index + 1}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {getInitials(cashier.cashierName)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{cashier.cashierName}</p>
                          <p className="text-xs text-muted-foreground">{cashier.cashierEmail}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{cashier.storeName}</TableCell>
                    <TableCell className="text-right font-medium">
                      {cashier.transactions.toLocaleString('fr-FR')}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(cashier.totalSales)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(cashier.avgTransaction)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={cashier.refundCount > 0 ? 'destructive' : 'secondary'}>
                        {cashier.refundCount}
                      </Badge>
                    </TableCell>
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
