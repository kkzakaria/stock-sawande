'use client'

import { useEffect, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { InventorySummaryCards } from './inventory-summary-cards'
import { StockLevelsTable } from './stock-levels-table'
import { CategoryBreakdownChart } from './category-breakdown-chart'
import { StockStatusChart } from './stock-status-chart'
import { ChartSkeleton, KpiSkeleton, TableSkeleton } from '@/components/charts'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'
import { getInventoryReport, type InventoryReportData } from '@/lib/actions/reports'
import type { ReportFilters } from '@/lib/types/filters'

interface InventoryReportProps {
  filters: ReportFilters
}

export function InventoryReport({ filters }: InventoryReportProps) {
  const t = useTranslations('Reports')
  const [isPending, startTransition] = useTransition()
  const [data, setData] = useState<InventoryReportData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    startTransition(async () => {
      const result = await getInventoryReport(filters)
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
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
        <TableSkeleton rows={10} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <InventorySummaryCards summary={data.summary} />

      <div className="grid gap-6 lg:grid-cols-2">
        <StockStatusChart summary={data.summary} />
        <CategoryBreakdownChart data={data.categoryBreakdown} />
      </div>

      <StockLevelsTable data={data.stockLevels} />
    </div>
  )
}
