'use client'

import { ReportsFilters } from './reports-filters'
import { useReportFilters } from '@/lib/hooks/use-report-filters'
import { SalesReport } from './sales'
import { InventoryReport } from './inventory'
import { PerformanceReport } from './performance'
import type { ReportFilters } from '@/lib/types/filters'

interface Store {
  id: string
  name: string
}

interface ReportsClientProps {
  stores: Store[]
}

export function ReportsClient({ stores }: ReportsClientProps) {
  const { filters } = useReportFilters()

  // Cast filters to ReportFilters type
  const reportFilters: ReportFilters = {
    reportType: filters.reportType as ReportFilters['reportType'],
    store: filters.store,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    groupBy: filters.groupBy as ReportFilters['groupBy'],
  }

  const renderReport = () => {
    switch (reportFilters.reportType) {
      case 'sales':
        return <SalesReport filters={reportFilters} />
      case 'inventory':
        return <InventoryReport filters={reportFilters} />
      case 'performance':
        return <PerformanceReport filters={reportFilters} />
      default:
        return <SalesReport filters={reportFilters} />
    }
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <ReportsFilters stores={stores} />

      {/* Report Content */}
      {renderReport()}
    </div>
  )
}
