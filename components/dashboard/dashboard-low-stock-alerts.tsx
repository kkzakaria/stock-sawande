'use client'

import { useTranslations } from 'next-intl'
import { AlertTriangle, Package } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TableSkeleton } from '@/components/charts'
import type { LowStockAlert } from '@/lib/actions/dashboard'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface DashboardLowStockAlertsProps {
  alerts: LowStockAlert[]
  loading: boolean
}

export function DashboardLowStockAlerts({ alerts, loading }: DashboardLowStockAlertsProps) {
  const t = useTranslations('Dashboard')

  if (loading) {
    return <TableSkeleton rows={5} columns={3} />
  }

  return (
    <Card className={alerts.length > 0 ? 'border-orange-500/30' : undefined}>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            {alerts.length > 0 && (
              <AlertTriangle className="h-5 w-5 text-orange-500" />
            )}
            {t('lowStock.title')}
          </CardTitle>
          <CardDescription>{t('lowStock.description')}</CardDescription>
        </div>
        {alerts.length > 0 && (
          <Link href="/products?stockStatus=low_stock">
            <Button variant="outline" size="sm">
              {t('lowStock.viewAll')}
            </Button>
          </Link>
        )}
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Package className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              {t('lowStock.noAlerts')}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.slice(0, 5).map((alert) => (
              <div
                key={alert.inventoryId}
                className="flex items-center justify-between gap-4 p-2 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{alert.productName}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{alert.sku}</span>
                    <Badge variant="secondary" className="text-xs">
                      {alert.storeName}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge
                    variant={alert.stockStatus === 'out_of_stock' ? 'destructive' : 'outline'}
                    className={alert.stockStatus === 'low_stock' ? 'border-orange-500 text-orange-500' : ''}
                  >
                    {alert.quantity} / {alert.minStockLevel}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
