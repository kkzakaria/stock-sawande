'use client'

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
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

interface AreaChartData {
  [key: string]: string | number
}

interface AreaChartWrapperProps {
  title: string
  description?: string
  data: AreaChartData[]
  xAxisKey: string
  areas: {
    dataKey: string
    label: string
    color: string
    stackId?: string
  }[]
  className?: string
  showLegend?: boolean
  showGrid?: boolean
  height?: number
  valueFormatter?: (value: number) => string
  xAxisFormatter?: (value: string) => string
  loading?: boolean
}

export function AreaChartWrapper({
  title,
  description,
  data,
  xAxisKey,
  areas,
  className,
  showLegend = true,
  showGrid = true,
  height = 300,
  valueFormatter = (v) => v.toLocaleString('fr-FR'),
  xAxisFormatter,
  loading = false,
}: AreaChartWrapperProps) {
  const chartConfig: ChartConfig = areas.reduce((acc, area) => ({
    ...acc,
    [area.dataKey]: {
      label: area.label,
      color: area.color,
    },
  }), {} as ChartConfig)

  if (loading) {
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

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="w-full" style={{ height }}>
          <AreaChart data={data} margin={{ left: 12, right: 12, top: 12, bottom: 12 }}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" vertical={false} />}
            <XAxis
              dataKey={xAxisKey}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={xAxisFormatter}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => valueFormatter(value)}
            />
            <ChartTooltip
              cursor={{ strokeDasharray: '3 3' }}
              content={
                <ChartTooltipContent
                  formatter={(value, name) => (
                    <div className="flex items-center justify-between gap-8">
                      <span className="text-muted-foreground">
                        {chartConfig[name as string]?.label || name}
                      </span>
                      <span className="font-mono font-medium">
                        {valueFormatter(Number(value))}
                      </span>
                    </div>
                  )}
                />
              }
            />
            {showLegend && (
              <ChartLegend content={<ChartLegendContent />} />
            )}
            {areas.map((area) => (
              <Area
                key={area.dataKey}
                type="monotone"
                dataKey={area.dataKey}
                stackId={area.stackId}
                stroke={`var(--color-${area.dataKey})`}
                fill={`var(--color-${area.dataKey})`}
                fillOpacity={0.3}
                strokeWidth={2}
              />
            ))}
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
