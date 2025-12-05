'use client'

import { useEffect, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { SalesSummaryCards } from './sales-summary-cards'
import { SalesTrendChart } from './sales-trend-chart'
import { PaymentBreakdownChart } from './payment-breakdown-chart'
import { TopProductsTable } from './top-products-table'
import { ChartSkeleton, KpiSkeleton, TableSkeleton } from '@/components/charts'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'
import { getSalesReport, type SalesReportData } from '@/lib/actions/reports'
import type { ReportFilters } from '@/lib/types/filters'

interface SalesReportProps {
  filters: ReportFilters
}

export function SalesReport({ filters }: SalesReportProps) {
  const t = useTranslations('Reports')
  const [isPending, startTransition] = useTransition()
  const [data, setData] = useState<SalesReportData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    startTransition(async () => {
      const result = await getSalesReport(filters)
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
        <TableSkeleton rows={5} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SalesSummaryCards summary={data.summary} />

      <div className="grid gap-6 lg:grid-cols-2">
        <SalesTrendChart
          data={data.trend}
          groupBy={filters.groupBy || 'daily'}
        />
        <PaymentBreakdownChart data={data.paymentBreakdown} />
      </div>

      <TopProductsTable data={data.topProducts} />
    </div>
  )
}
