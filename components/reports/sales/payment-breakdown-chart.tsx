'use client'

import { useTranslations } from 'next-intl'
import { PieChartWrapper } from '@/components/charts'
import type { PaymentBreakdownItem } from '@/lib/actions/reports'

interface PaymentBreakdownChartProps {
  data: PaymentBreakdownItem[]
}

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
]

export function PaymentBreakdownChart({ data }: PaymentBreakdownChartProps) {
  const t = useTranslations('Reports.sales')

  const chartData = data.map((item, index) => ({
    name: t(`paymentMethods.${item.method}`, { defaultValue: item.method }),
    value: item.total,
    count: item.count,
    percentage: item.percentage,
    fill: COLORS[index % COLORS.length],
  }))

  const totalAmount = data.reduce((sum, item) => sum + item.total, 0)

  return (
    <PieChartWrapper
      title={t('paymentBreakdown')}
      description={t('paymentBreakdownDescription')}
      data={chartData}
      height={300}
      innerRadius={60}
      centerLabel={t('total')}
      centerValue={(() => {
        const formatted = new Intl.NumberFormat('fr-FR', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(totalAmount)
        return `${formatted} CFA`
      })()}
    />
  )
}
