'use client'

import { useTranslations } from 'next-intl'
import { KpiCard } from '@/components/charts'
import type { SalesReportSummary } from '@/lib/actions/reports'

interface SalesSummaryCardsProps {
  summary: SalesReportSummary
}

export function SalesSummaryCards({ summary }: SalesSummaryCardsProps) {
  const t = useTranslations('Reports.sales')

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        title={t('totalRevenue')}
        value={summary.totalRevenue}
        format="currency"
        icon="dollar"
      />
      <KpiCard
        title={t('totalTransactions')}
        value={summary.totalTransactions}
        format="number"
        icon="chart"
      />
      <KpiCard
        title={t('avgTransaction')}
        value={summary.avgTransactionValue}
        format="currency"
        icon="trending"
      />
      <KpiCard
        title={t('refundRate')}
        value={summary.refundRate}
        format="percentage"
        icon="alert"
        trend={summary.refundRate > 5 ? 'down' : 'up'}
      />
    </div>
  )
}
