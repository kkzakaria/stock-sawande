'use client'

import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChartWrapper } from '@/components/charts'
import type { StoreComparisonItem } from '@/lib/actions/reports'

interface StoreComparisonChartProps {
  data: StoreComparisonItem[]
}

export function StoreComparisonChart({ data }: StoreComparisonChartProps) {
  const t = useTranslations('Reports.performance')

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('storeComparison')}</CardTitle>
          <CardDescription>{t('storeComparisonDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            {t('noStoreData')}
          </div>
        </CardContent>
      </Card>
    )
  }

  const chartData = data.map(item => ({
    name: item.storeName,
    revenue: item.revenue,
    transactions: item.transactions,
    avgTransaction: item.avgTransaction,
  }))

  return (
    <BarChartWrapper
      title={t('storeComparison')}
      description={t('storeComparisonDescription')}
      data={chartData}
      xAxisKey="name"
      bars={[
        { dataKey: 'revenue', label: t('revenue'), color: 'hsl(var(--chart-1))' },
      ]}
      height={300}
      showLegend={false}
    />
  )
}
