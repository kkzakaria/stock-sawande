'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type Period = '7d' | '30d' | '90d' | '12m'

interface PeriodOption {
  value: Period
  label: string
  days: number
}

const PERIOD_OPTIONS: PeriodOption[] = [
  { value: '7d', label: '7 jours', days: 7 },
  { value: '30d', label: '30 jours', days: 30 },
  { value: '90d', label: '90 jours', days: 90 },
  { value: '12m', label: '12 mois', days: 365 },
]

interface PeriodSelectorProps {
  value: Period
  onChange: (period: Period) => void
  className?: string
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg'
}

export function PeriodSelector({
  value,
  onChange,
  className,
  variant: _variant = 'outline',
  size = 'sm',
}: PeriodSelectorProps) {
  return (
    <div className={cn('flex gap-1 bg-muted p-1 rounded-lg', className)}>
      {PERIOD_OPTIONS.map((option) => (
        <Button
          key={option.value}
          variant={value === option.value ? 'default' : 'ghost'}
          size={size}
          onClick={() => onChange(option.value)}
          className={cn(
            'transition-all',
            value !== option.value && 'hover:bg-background/50'
          )}
        >
          {option.label}
        </Button>
      ))}
    </div>
  )
}

export function getPeriodDays(period: Period): number {
  const option = PERIOD_OPTIONS.find((o) => o.value === period)
  return option?.days || 30
}

export function getPeriodDateRange(period: Period): { from: Date; to: Date } {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - getPeriodDays(period))
  return { from, to }
}

export function getGroupByFromPeriod(period: Period): 'daily' | 'weekly' | 'monthly' {
  switch (period) {
    case '7d':
      return 'daily'
    case '30d':
      return 'daily'
    case '90d':
      return 'weekly'
    case '12m':
      return 'monthly'
    default:
      return 'daily'
  }
}
