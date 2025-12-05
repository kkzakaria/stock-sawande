'use client'

import { useTranslations } from 'next-intl'
import { AreaChartWrapper } from '@/components/charts'
import type { SalesTrendItem } from '@/lib/actions/reports'

interface SalesTrendChartProps {
  data: SalesTrendItem[]
  groupBy: 'daily' | 'weekly' | 'monthly'
}

export function SalesTrendChart({ data, groupBy }: SalesTrendChartProps) {
  const t = useTranslations('Reports.sales')

  const chartData = data.map(item => ({
    name: item.period,
    revenue: item.revenue,
    transactions: item.transactions,
  }))

  const groupByLabel = groupBy === 'daily' ? t('daily') :
                       groupBy === 'weekly' ? t('weekly') : t('monthly')

  return (
    <AreaChartWrapper
      title={t('salesTrend')}
      description={t('salesTrendDescription', { period: groupByLabel })}
      data={chartData}
      xAxisKey="name"
      areas={[
        { dataKey: 'revenue', label: t('revenue'), color: 'hsl(var(--chart-1))' },
      ]}
      height={300}
      showGrid
      showLegend={false}
    />
  )
}
