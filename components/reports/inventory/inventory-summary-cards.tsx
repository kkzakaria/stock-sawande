'use client'

import { useTranslations } from 'next-intl'
import { KpiCard } from '@/components/charts'
import type { InventoryReportSummary } from '@/lib/actions/reports'

interface InventorySummaryCardsProps {
  summary: InventoryReportSummary
}

export function InventorySummaryCards({ summary }: InventorySummaryCardsProps) {
  const t = useTranslations('Reports.inventory')

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        title={t('totalProducts')}
        value={summary.totalProducts}
        format="number"
        icon="package"
      />
      <KpiCard
        title={t('totalStockValue')}
        value={summary.totalStockValue}
        format="currency"
        icon="dollar"
      />
      <KpiCard
        title={t('lowStockCount')}
        value={summary.lowStockCount}
        format="number"
        icon="alert"
        trend={summary.lowStockCount > 0 ? 'down' : 'up'}
      />
      <KpiCard
        title={t('outOfStockCount')}
        value={summary.outOfStockCount}
        format="number"
        icon="alert"
        trend={summary.outOfStockCount > 0 ? 'down' : 'up'}
      />
    </div>
  )
}
