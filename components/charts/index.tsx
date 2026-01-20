'use client'

import dynamic from 'next/dynamic'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/utils'

// Loading skeleton for lazy-loaded charts
function LazyChartSkeleton({ className, height = 300 }: { className?: string; height?: number }) {
  return (
    <Card className={cn('animate-pulse', className)}>
      <CardHeader>
        <div className="h-5 w-32 bg-muted rounded" />
        <div className="h-4 w-48 bg-muted rounded mt-1" />
      </CardHeader>
      <CardContent>
        <div className="bg-muted rounded" style={{ height }} />
      </CardContent>
    </Card>
  )
}

// Lazy load recharts components - they will only be loaded when used
// This significantly reduces initial bundle size as recharts is ~400KB
export const AreaChartWrapper = dynamic(
  () => import('./area-chart-wrapper').then((mod) => mod.AreaChartWrapper),
  {
    loading: () => <LazyChartSkeleton />,
    ssr: false,
  }
)

export const BarChartWrapper = dynamic(
  () => import('./bar-chart-wrapper').then((mod) => mod.BarChartWrapper),
  {
    loading: () => <LazyChartSkeleton />,
    ssr: false,
  }
)

export const PieChartWrapper = dynamic(
  () => import('./pie-chart-wrapper').then((mod) => mod.PieChartWrapper),
  {
    loading: () => <LazyChartSkeleton height={300} />,
    ssr: false,
  }
)

// Re-export other chart components (not lazy-loaded as they're lightweight)
export { KpiCard } from './kpi-card'
export { ChartSkeleton, KpiSkeleton, TableSkeleton } from './chart-skeleton'
export {
  PeriodSelector,
  getPeriodDays,
  getPeriodDateRange,
  getGroupByFromPeriod,
  type Period,
} from './period-selector'

// Re-export types for convenience
export type { AreaChartWrapperProps } from './area-chart-wrapper'
export type { BarChartWrapperProps } from './bar-chart-wrapper'
export type { PieChartWrapperProps } from './pie-chart-wrapper'
