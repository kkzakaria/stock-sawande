'use client'

import { useTranslations } from 'next-intl'
import { KpiCard } from '@/components/charts'
import type { StoreComparisonItem, CashierPerformanceItem } from '@/lib/actions/reports'

interface PerformanceSummaryCardsProps {
  storeData: StoreComparisonItem[]
  cashierData: CashierPerformanceItem[]
}

export function PerformanceSummaryCards({ storeData, cashierData }: PerformanceSummaryCardsProps) {
  const t = useTranslations('Reports.performance')

  // Calculate totals
  const totalRevenue = storeData.reduce((sum, s) => sum + s.revenue, 0) ||
                       cashierData.reduce((sum, c) => sum + c.totalSales, 0)
  const totalTransactions = storeData.reduce((sum, s) => sum + s.transactions, 0) ||
                            cashierData.reduce((sum, c) => sum + c.transactions, 0)
  const avgTransaction = totalTransactions > 0 ? totalRevenue / totalTransactions : 0
  const activeCashiers = cashierData.filter(c => c.transactions > 0).length

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        title={t('totalRevenue')}
        value={totalRevenue}
        format="currency"
        icon="dollar"
      />
      <KpiCard
        title={t('totalTransactions')}
        value={totalTransactions}
        format="number"
        icon="chart"
      />
      <KpiCard
        title={t('avgTransaction')}
        value={avgTransaction}
        format="currency"
        icon="trending"
      />
      <KpiCard
        title={t('activeCashiers')}
        value={activeCashiers}
        format="number"
        icon="users"
      />
    </div>
  )
}
