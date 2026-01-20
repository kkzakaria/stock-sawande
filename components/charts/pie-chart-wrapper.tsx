'use client'

import { Pie, PieChart, Cell, Label } from 'recharts'
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useMemo } from 'react'

interface PieChartData {
  name: string
  value: number
  color?: string
  fill?: string
}

export interface PieChartWrapperProps {
  title: string
  description?: string
  data: PieChartData[]
  className?: string
  showLegend?: boolean
  height?: number
  innerRadius?: number
  outerRadius?: number
  valueFormatter?: (value: number) => string
  loading?: boolean
  centerLabel?: string
  centerValue?: string | number
  colors?: string[]
}

const DEFAULT_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
]

export function PieChartWrapper({
  title,
  description,
  data,
  className,
  showLegend = true,
  height = 300,
  innerRadius = 60,
  outerRadius = 100,
  valueFormatter = (v) => v.toLocaleString('fr-FR'),
  loading = false,
  centerLabel,
  centerValue,
  colors = DEFAULT_COLORS,
}: PieChartWrapperProps) {
  const chartData = useMemo(() =>
    data.map((item, index) => ({
      ...item,
      fill: item.fill || item.color || colors[index % colors.length],
    })),
    [data, colors]
  )

  const chartConfig: ChartConfig = useMemo(() =>
    chartData.reduce((acc, item) => ({
      ...acc,
      [item.name]: {
        label: item.name,
        color: item.fill,
      },
    }), {} as ChartConfig),
    [chartData]
  )

  const total = useMemo(() =>
    chartData.reduce((sum, item) => sum + item.value, 0),
    [chartData]
  )

  if (loading) {
    return (
      <Card className={cn('animate-pulse', className)}>
        <CardHeader>
          <div className="h-5 w-32 bg-muted rounded" />
          <div className="h-4 w-48 bg-muted rounded mt-1" />
        </CardHeader>
        <CardContent className="flex justify-center">
          <div className="rounded-full bg-muted" style={{ width: outerRadius * 2, height: outerRadius * 2 }} />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="mx-auto" style={{ height }}>
          <PieChart margin={{ left: 12, right: 12, top: 12, bottom: 12 }}>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name) => (
                    <div className="flex items-center justify-between gap-8">
                      <span className="text-muted-foreground">
                        {name}
                      </span>
                      <span className="font-mono font-medium">
                        {valueFormatter(Number(value))} ({((Number(value) / total) * 100).toFixed(1)}%)
                      </span>
                    </div>
                  )}
                />
              }
            />
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              innerRadius={innerRadius}
              outerRadius={outerRadius}
              strokeWidth={2}
              stroke="hsl(var(--background))"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
              {(centerLabel || centerValue) && (
                <Label
                  content={({ viewBox }) => {
                    if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                      return (
                        <text
                          x={viewBox.cx}
                          y={viewBox.cy}
                          textAnchor="middle"
                          dominantBaseline="middle"
                        >
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy || 0) - 8}
                            className="fill-foreground text-2xl font-bold"
                          >
                            {centerValue?.toString() || valueFormatter(total)}
                          </tspan>
                          {centerLabel && (
                            <tspan
                              x={viewBox.cx}
                              y={(viewBox.cy || 0) + 12}
                              className="fill-muted-foreground text-xs"
                            >
                              {centerLabel}
                            </tspan>
                          )}
                        </text>
                      )
                    }
                  }}
                />
              )}
            </Pie>
            {showLegend && (
              <ChartLegend
                content={<ChartLegendContent nameKey="name" />}
                className="flex-wrap gap-2"
              />
            )}
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
