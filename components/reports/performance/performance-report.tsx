'use client'

import { useEffect, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { PerformanceSummaryCards } from './performance-summary-cards'
import { StoreComparisonChart } from './store-comparison-chart'
import { CashierPerformanceTable } from './cashier-performance-table'
import { ChartSkeleton, KpiSkeleton, TableSkeleton } from '@/components/charts'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'
import { getPerformanceReport, type PerformanceReportData } from '@/lib/actions/reports'
import type { ReportFilters } from '@/lib/types/filters'

interface PerformanceReportProps {
  filters: ReportFilters
}

export function PerformanceReport({ filters }: PerformanceReportProps) {
  const t = useTranslations('Reports')
  const [isPending, startTransition] = useTransition()
  const [data, setData] = useState<PerformanceReportData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    startTransition(async () => {
      const result = await getPerformanceReport(filters)
      if (result.success && result.data) {
        setData(result.data)
        setError(null)
      } else {
        setError(result.error || t('errors.fetchFailed'))
        setData(null)
      }
    })
  }, [filters, t])

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>{t('errors.title')}</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (isPending || !data) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KpiSkeleton />
          <KpiSkeleton />
          <KpiSkeleton />
          <KpiSkeleton />
        </div>
        <ChartSkeleton />
        <TableSkeleton rows={5} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PerformanceSummaryCards
        storeData={data.storeComparison}
        cashierData={data.cashierPerformance}
      />

      {data.storeComparison.length > 0 && (
        <StoreComparisonChart data={data.storeComparison} />
      )}

      <CashierPerformanceTable data={data.cashierPerformance} />
    </div>
  )
}
