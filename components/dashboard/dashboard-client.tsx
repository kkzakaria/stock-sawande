'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { DollarSign, ShoppingCart, TrendingUp, AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { KpiCard, KpiSkeleton } from '@/components/charts'
import { getDashboardMetrics, getRevenueTrend, getTopProducts, getLowStockAlerts } from '@/lib/actions/dashboard'
import type { DashboardMetrics, RevenueTrend, TopProduct, LowStockAlert } from '@/lib/actions/dashboard'
import { DashboardRevenueChart } from './dashboard-revenue-chart'
import { DashboardTopProducts } from './dashboard-top-products'
import { DashboardLowStockAlerts } from './dashboard-low-stock-alerts'
import { PeriodSelector, type Period, getGroupByFromPeriod, getPeriodDays } from '@/components/charts/period-selector'

interface DashboardClientProps {
  storeId?: string
  storeName?: string
}

export function DashboardClient({ storeId, storeName }: DashboardClientProps) {
  const t = useTranslations('Dashboard')
  const [period, setPeriod] = useState<Period>('30d')
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [revenueTrend, setRevenueTrend] = useState<RevenueTrend[]>([])
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [lowStockAlerts, setLowStockAlerts] = useState<LowStockAlert[]>([])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const days = getPeriodDays(period)
      const groupBy = getGroupByFromPeriod(period)

      const [metricsResult, trendResult, productsResult, alertsResult] = await Promise.all([
        getDashboardMetrics(storeId),
        getRevenueTrend(storeId, days, groupBy),
        getTopProducts(storeId, 5, days),
        getLowStockAlerts(storeId),
      ])

      if (metricsResult.success && metricsResult.data) {
        setMetrics(metricsResult.data)
      }
      if (trendResult.success && trendResult.data) {
        setRevenueTrend(trendResult.data)
      }
      if (productsResult.success && productsResult.data) {
        setTopProducts(productsResult.data)
      }
      if (alertsResult.success && alertsResult.data) {
        setLowStockAlerts(alertsResult.data)
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }, [storeId, period])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const formatCurrency = (value: number) => {
    const formatted = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)
    return `${formatted} CFA`
  }

  return (
    <div className="space-y-6">
      {/* Header with period selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t('title')}</h2>
          {storeName && (
            <p className="text-muted-foreground">{storeName}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <PeriodSelector value={period} onChange={setPeriod} />
          <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          <>
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
          </>
        ) : (
          <>
            <KpiCard
              title={t('metrics.todayRevenue')}
              value={formatCurrency(metrics?.todayRevenue || 0)}
              previousValue={metrics?.yesterdayRevenue}
              currentValue={metrics?.todayRevenue}
              icon={<DollarSign className="h-4 w-4" />}
            />
            <KpiCard
              title={t('metrics.weekRevenue')}
              value={formatCurrency(metrics?.weekRevenue || 0)}
              previousValue={metrics?.lastWeekRevenue}
              currentValue={metrics?.weekRevenue}
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <KpiCard
              title={t('metrics.transactions')}
              value={metrics?.todayTransactions || 0}
              icon={<ShoppingCart className="h-4 w-4" />}
            />
            <KpiCard
              title={t('metrics.lowStock')}
              value={metrics?.lowStockCount || 0}
              icon={<AlertTriangle className="h-4 w-4" />}
              className={metrics?.lowStockCount && metrics.lowStockCount > 0 ? 'border-orange-500/50' : undefined}
            />
          </>
        )}
      </div>

      {/* Revenue Chart */}
      <DashboardRevenueChart
        data={revenueTrend}
        loading={loading}
        period={period}
      />

      {/* Top Products and Low Stock Alerts */}
      <div className="grid gap-4 md:grid-cols-2">
        <DashboardTopProducts
          products={topProducts}
          loading={loading}
        />
        <DashboardLowStockAlerts
          alerts={lowStockAlerts}
          loading={loading}
        />
      </div>
    </div>
  )
}
