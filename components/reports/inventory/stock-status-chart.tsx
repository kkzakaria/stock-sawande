'use client'

import { useTranslations } from 'next-intl'
import { PieChartWrapper } from '@/components/charts'
import type { InventoryReportSummary } from '@/lib/actions/reports'

interface StockStatusChartProps {
  summary: InventoryReportSummary
}

export function StockStatusChart({ summary }: StockStatusChartProps) {
  const t = useTranslations('Reports.inventory')

  const chartData = [
    {
      name: t('status.inStock'),
      value: summary.inStockCount,
      fill: 'hsl(var(--chart-2))',
    },
    {
      name: t('status.lowStock'),
      value: summary.lowStockCount,
      fill: 'hsl(var(--chart-4))',
    },
    {
      name: t('status.outOfStock'),
      value: summary.outOfStockCount,
      fill: 'hsl(var(--chart-1))',
    },
  ].filter(item => item.value > 0)

  return (
    <PieChartWrapper
      title={t('stockStatus')}
      description={t('stockStatusDescription')}
      data={chartData}
      height={300}
      innerRadius={60}
      centerLabel={t('products')}
      centerValue={summary.totalProducts.toString()}
    />
  )
}
