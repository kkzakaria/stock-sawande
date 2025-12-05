'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface ChartSkeletonProps {
  className?: string
  height?: number
  showHeader?: boolean
  showDescription?: boolean
}

export function ChartSkeleton({
  className,
  height = 300,
  showHeader = true,
  showDescription = true,
}: ChartSkeletonProps) {
  return (
    <Card className={cn('animate-pulse', className)}>
      {showHeader && (
        <CardHeader className="space-y-2">
          <Skeleton className="h-5 w-32" />
          {showDescription && <Skeleton className="h-4 w-48" />}
        </CardHeader>
      )}
      <CardContent>
        <div className="relative" style={{ height }}>
          {/* Chart area skeleton */}
          <Skeleton className="absolute inset-0 rounded-lg" />

          {/* Fake chart bars */}
          <div className="absolute bottom-4 left-4 right-4 flex items-end justify-around gap-2">
            {[40, 65, 45, 80, 55, 70, 50].map((h, i) => (
              <Skeleton
                key={i}
                className="w-full"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface KpiSkeletonProps {
  className?: string
}

export function KpiSkeleton({ className }: KpiSkeletonProps) {
  return (
    <Card className={cn('animate-pulse', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-32 mb-2" />
        <Skeleton className="h-3 w-20" />
      </CardContent>
    </Card>
  )
}

interface TableSkeletonProps {
  rows?: number
  columns?: number
  className?: string
}

export function TableSkeleton({
  rows = 5,
  columns = 4,
  className,
}: TableSkeletonProps) {
  return (
    <Card className={cn('animate-pulse', className)}>
      <CardHeader>
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-48" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Header row */}
          <div className="flex gap-4 pb-2 border-b">
            {Array.from({ length: columns }).map((_, i) => (
              <Skeleton key={i} className="h-4 flex-1" />
            ))}
          </div>
          {/* Data rows */}
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <div key={rowIndex} className="flex gap-4">
              {Array.from({ length: columns }).map((_, colIndex) => (
                <Skeleton key={colIndex} className="h-4 flex-1" />
              ))}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
