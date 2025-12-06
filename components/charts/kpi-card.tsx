'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { CURRENCY_CONFIG } from '@/lib/config/currency'
import {
  ArrowDown,
  ArrowUp,
  Minus,
  DollarSign,
  TrendingUp,
  TrendingDown,
  BarChart3,
  AlertTriangle,
  Package,
  Users,
} from 'lucide-react'

type IconName = 'dollar' | 'trending' | 'chart' | 'alert' | 'package' | 'users'

interface KpiCardProps {
  title: string
  value: string | number
  previousValue?: number
  currentValue?: number
  format?: 'number' | 'currency' | 'percentage'
  locale?: string
  currency?: string
  icon?: React.ReactNode | IconName
  trend?: 'up' | 'down' | 'neutral'
  className?: string
  loading?: boolean
}

const iconMap: Record<IconName, React.ReactNode> = {
  dollar: <DollarSign className="h-4 w-4" />,
  trending: <TrendingUp className="h-4 w-4" />,
  chart: <BarChart3 className="h-4 w-4" />,
  alert: <AlertTriangle className="h-4 w-4" />,
  package: <Package className="h-4 w-4" />,
  users: <Users className="h-4 w-4" />,
}

export function KpiCard({
  title,
  value,
  previousValue,
  currentValue,
  format = 'number',
  locale = CURRENCY_CONFIG.locale,
  currency = CURRENCY_CONFIG.code,
  icon,
  trend: trendProp,
  className,
  loading = false,
}: KpiCardProps) {
  // Calculate trend from values or use prop
  const calculatedTrend = previousValue !== undefined && currentValue !== undefined
    ? previousValue > 0
      ? ((currentValue - previousValue) / previousValue) * 100
      : currentValue > 0
        ? 100
        : 0
    : undefined

  // Resolve icon (string name or ReactNode)
  const resolvedIcon = typeof icon === 'string' && icon in iconMap
    ? iconMap[icon as IconName]
    : icon

  // Format value
  const formatValue = (val: string | number): string => {
    if (typeof val === 'string') return val

    switch (format) {
      case 'currency':
        // Format number then add currency symbol (correct CFA format: "amount CFA")
        const formattedNumber = new Intl.NumberFormat(locale, {
          minimumFractionDigits: CURRENCY_CONFIG.minimumFractionDigits,
          maximumFractionDigits: CURRENCY_CONFIG.maximumFractionDigits,
        }).format(val)
        return `${formattedNumber} ${CURRENCY_CONFIG.symbol}`
      case 'percentage':
        return new Intl.NumberFormat(locale, {
          style: 'percent',
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        }).format(val / 100)
      default:
        return new Intl.NumberFormat(locale).format(val)
    }
  }

  // Determine which trend indicator to use
  const showTrend = calculatedTrend !== undefined || trendProp !== undefined

  const TrendIcon = !showTrend
    ? null
    : trendProp === 'up' || (calculatedTrend !== undefined && calculatedTrend > 0)
      ? ArrowUp
      : trendProp === 'down' || (calculatedTrend !== undefined && calculatedTrend < 0)
        ? ArrowDown
        : Minus

  const trendColor = !showTrend
    ? ''
    : trendProp === 'up' || (calculatedTrend !== undefined && calculatedTrend > 0)
      ? 'text-green-600 dark:text-green-400'
      : trendProp === 'down' || (calculatedTrend !== undefined && calculatedTrend < 0)
        ? 'text-red-600 dark:text-red-400'
        : 'text-muted-foreground'

  if (loading) {
    return (
      <Card className={cn('animate-pulse', className)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="h-4 w-24 bg-muted rounded" />
          <div className="h-4 w-4 bg-muted rounded" />
        </CardHeader>
        <CardContent>
          <div className="h-8 w-32 bg-muted rounded mb-2" />
          <div className="h-3 w-20 bg-muted rounded" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {resolvedIcon && <div className="text-muted-foreground">{resolvedIcon}</div>}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formatValue(value)}</div>
        {calculatedTrend !== undefined && TrendIcon && (
          <p className={cn('text-xs flex items-center gap-1 mt-1', trendColor)}>
            <TrendIcon className="h-3 w-3" />
            <span>{Math.abs(calculatedTrend).toFixed(1)}%</span>
            <span className="text-muted-foreground">vs période précédente</span>
          </p>
        )}
      </CardContent>
    </Card>
  )
}
