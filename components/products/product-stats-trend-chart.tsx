'use client'

import { format } from 'date-fns'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'

const chartConfig = {
  quantity: {
    label: 'Stock Quantity',
    color: 'hsl(var(--chart-1))',
  },
} satisfies ChartConfig

interface ProductStatsTrendChartProps {
  data: Array<{ date: string; quantity: number }>
}

export default function ProductStatsTrendChart({ data }: ProductStatsTrendChartProps) {
  return (
    <ChartContainer config={chartConfig} className="h-[200px] w-full">
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="fillQuantity" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-quantity)" stopOpacity={0.8} />
            <stop offset="95%" stopColor="var(--color-quantity)" stopOpacity={0.1} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(value) => {
            const date = new Date(value)
            return format(date, 'MMM dd')
          }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(value) => `${value}`}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(value) => format(new Date(value), 'MMM dd, yyyy')}
              formatter={(value) => [`${value} units`, 'Stock']}
            />
          }
        />
        <Area
          type="monotone"
          dataKey="quantity"
          stroke="var(--color-quantity)"
          fill="url(#fillQuantity)"
          fillOpacity={0.4}
        />
      </AreaChart>
    </ChartContainer>
  )
}
