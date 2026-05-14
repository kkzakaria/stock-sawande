'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getProductStats, type ProductStats } from '@/lib/actions/stock-movements'
import { TrendingUp, TrendingDown, DollarSign, Package, Calendar } from 'lucide-react'

// Lazy-load the chart so recharts (~400KB) is not pulled into the
// initial bundle of the product detail page.
const ProductStatsTrendChart = dynamic(
  () => import('./product-stats-trend-chart'),
  {
    ssr: false,
    loading: () => (
      <div className="h-[200px] w-full animate-pulse rounded-md bg-muted" />
    ),
  }
)

interface ProductStatsProps {
  productId: string
}

export function ProductStatsComponent({ productId }: ProductStatsProps) {
  const [stats, setStats] = useState<ProductStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)

  useEffect(() => {
    async function loadStats() {
      setLoading(true)
      const result = await getProductStats(productId, days)

      if (result.success && result.data) {
        setStats(result.data)
      }
      setLoading(false)
    }

    loadStats()
  }, [productId, days])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Product Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            Loading statistics...
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!stats) {
    return null
  }

  const getPerformanceBadge = () => {
    if (stats.averageDailyVelocity > 5) {
      return (
        <Badge variant="default" className="bg-green-500">
          <TrendingUp className="mr-1 h-3 w-3" />
          Fast-moving
        </Badge>
      )
    } else if (stats.averageDailyVelocity < 1) {
      return (
        <Badge variant="secondary">
          <TrendingDown className="mr-1 h-3 w-3" />
          Slow-moving
        </Badge>
      )
    }
    return (
      <Badge variant="outline">
        Normal velocity
      </Badge>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Product Statistics (Last {days} days)</CardTitle>
          <div className="flex gap-2">
            <button
              onClick={() => setDays(7)}
              className={`text-sm px-2 py-1 rounded ${
                days === 7 ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
              }`}
            >
              7d
            </button>
            <button
              onClick={() => setDays(30)}
              className={`text-sm px-2 py-1 rounded ${
                days === 30 ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
              }`}
            >
              30d
            </button>
            <button
              onClick={() => setDays(90)}
              className={`text-sm px-2 py-1 rounded ${
                days === 90 ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
              }`}
            >
              90d
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2 rounded-lg border p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Package className="h-4 w-4" />
              Total Sales
            </div>
            <div className="text-2xl font-bold">{stats.totalSales}</div>
            <p className="text-xs text-muted-foreground">units sold</p>
          </div>

          <div className="space-y-2 rounded-lg border p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              Revenue
            </div>
            <div className="text-2xl font-bold">${stats.totalRevenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">from sales</p>
          </div>

          <div className="space-y-2 rounded-lg border p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              Velocity
            </div>
            <div className="text-2xl font-bold">{stats.averageDailyVelocity.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">units/day avg</p>
          </div>

          <div className="space-y-2 rounded-lg border p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              Days of Stock
            </div>
            <div className="text-2xl font-bold">
              {stats.daysOfStockRemaining !== null ? stats.daysOfStockRemaining : '∞'}
            </div>
            <p className="text-xs text-muted-foreground">at current rate</p>
          </div>
        </div>

        {/* Performance Badge */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Performance:</span>
          {getPerformanceBadge()}
        </div>

        {/* Stock Trend Chart */}
        <div>
          <h4 className="mb-4 text-sm font-medium">Stock Level Trend</h4>
          <ProductStatsTrendChart data={stats.stockTrend} />
        </div>

        {/* Additional Insights */}
        {stats.daysOfStockRemaining !== null && stats.daysOfStockRemaining < 7 && (
          <div className="rounded-lg border border-orange-500 bg-orange-50 p-4 text-sm dark:bg-orange-950">
            <p className="font-medium text-orange-900 dark:text-orange-100">
              ⚠️ Low stock warning
            </p>
            <p className="mt-1 text-orange-700 dark:text-orange-200">
              At the current sales rate, stock will run out in {stats.daysOfStockRemaining} days.
              Consider reordering soon.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
