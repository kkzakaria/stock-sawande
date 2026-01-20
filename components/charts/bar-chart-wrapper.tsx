'use client'

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Cell } from 'recharts'
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

interface BarChartData {
  [key: string]: string | number
}

export interface BarChartWrapperProps {
  title: string
  description?: string
  data: BarChartData[]
  xAxisKey: string
  bars: {
    dataKey: string
    label: string
    color: string
    stackId?: string
  }[]
  className?: string
  showLegend?: boolean
  showGrid?: boolean
  height?: number
  layout?: 'vertical' | 'horizontal'
  valueFormatter?: (value: number) => string
  xAxisFormatter?: (value: string) => string
  loading?: boolean
  colorByValue?: boolean
  colors?: string[]
}

export function BarChartWrapper({
  title,
  description,
  data,
  xAxisKey,
  bars,
  className,
  showLegend = true,
  showGrid = true,
  height = 300,
  layout = 'horizontal',
  valueFormatter = (v) => v.toLocaleString('fr-FR'),
  xAxisFormatter,
  loading = false,
  colorByValue = false,
  colors = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'],
}: BarChartWrapperProps) {
  const chartConfig: ChartConfig = bars.reduce((acc, bar) => ({
    ...acc,
    [bar.dataKey]: {
      label: bar.label,
      color: bar.color,
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
          <BarChart
            data={data}
            layout={layout}
            margin={{ left: 12, right: 12, top: 12, bottom: 12 }}
          >
            {showGrid && <CartesianGrid strokeDasharray="3 3" vertical={layout === 'horizontal'} horizontal={layout === 'vertical'} />}
            {layout === 'horizontal' ? (
              <>
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
              </>
            ) : (
              <>
                <XAxis
                  type="number"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(value) => valueFormatter(value)}
                />
                <YAxis
                  dataKey={xAxisKey}
                  type="category"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={xAxisFormatter}
                  width={120}
                />
              </>
            )}
            <ChartTooltip
              cursor={{ fill: 'hsl(var(--muted) / 0.5)' }}
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
            {showLegend && bars.length > 1 && (
              <ChartLegend content={<ChartLegendContent />} />
            )}
            {bars.map((bar) => (
              <Bar
                key={bar.dataKey}
                dataKey={bar.dataKey}
                stackId={bar.stackId}
                fill={`var(--color-${bar.dataKey})`}
                radius={[4, 4, 0, 0]}
              >
                {colorByValue && data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Bar>
            ))}
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
