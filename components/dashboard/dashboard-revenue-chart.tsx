'use client'

import { useTranslations } from 'next-intl'
import type { RevenueTrend } from '@/lib/actions/dashboard'
import { AreaChartWrapper } from '@/components/charts'
import type { Period } from '@/components/charts/period-selector'

interface DashboardRevenueChartProps {
  data: RevenueTrend[]
  loading: boolean
  period: Period
}

export function DashboardRevenueChart({ data, loading, period }: DashboardRevenueChartProps) {
  const t = useTranslations('Dashboard')

  const chartData = data.map((item) => ({
    period: formatPeriodLabel(item.period, period),
    revenue: item.totalRevenue,
    transactions: item.transactionCount,
  }))

  return (
    <AreaChartWrapper
      title={t('charts.revenueTitle')}
      description={t('charts.revenueDescription')}
      data={chartData}
      xAxisKey="period"
      areas={[
        {
          dataKey: 'revenue',
          label: t('charts.revenue'),
          color: 'hsl(var(--chart-1))',
        },
      ]}
      height={350}
      loading={loading}
      valueFormatter={(value) =>
        new Intl.NumberFormat('fr-MA', {
          style: 'currency',
          currency: 'MAD',
          notation: 'compact',
        }).format(value)
      }
      showLegend={false}
    />
  )
}

function formatPeriodLabel(period: string, selectedPeriod: Period): string {
  const date = new Date(period)

  switch (selectedPeriod) {
    case '7d':
    case '30d':
      return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    case '90d':
      return `S${getWeekNumber(date)}`
    case '12m':
      return date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
    default:
      return period
  }
}

function getWeekNumber(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1)
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7)
}
