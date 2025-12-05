'use client'

import { useTranslations } from 'next-intl'
import { BarChartWrapper } from '@/components/charts'
import type { CategoryBreakdownItem } from '@/lib/actions/reports'

interface CategoryBreakdownChartProps {
  data: CategoryBreakdownItem[]
}

export function CategoryBreakdownChart({ data }: CategoryBreakdownChartProps) {
  const t = useTranslations('Reports.inventory')

  const chartData = data.map(item => ({
    name: item.category,
    productCount: item.productCount,
    totalQuantity: item.totalQuantity,
    totalValue: item.totalValue,
  }))

  return (
    <BarChartWrapper
      title={t('categoryBreakdown')}
      description={t('categoryBreakdownDescription')}
      data={chartData}
      xAxisKey="name"
      bars={[
        { dataKey: 'totalQuantity', label: t('totalQuantity'), color: 'hsl(var(--chart-2))' },
      ]}
      height={300}
      layout="vertical"
      showLegend={false}
    />
  )
}
