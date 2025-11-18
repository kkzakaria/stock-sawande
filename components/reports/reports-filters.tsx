'use client';

import { X, Calendar } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useReportFilters } from '@/lib/hooks/use-report-filters';
import { REPORT_TYPE_OPTIONS, REPORT_GROUP_OPTIONS } from '@/lib/types/filters';

interface Store {
  id: string;
  name: string;
}

interface ReportsFiltersProps {
  stores: Store[];
}

export function ReportsFilters({ stores }: ReportsFiltersProps) {
  const { filters, setFilters, resetFilters } = useReportFilters();

  const hasActiveFilters = Boolean(
    filters.store || filters.dateFrom || filters.dateTo
  );

  return (
    <div className="space-y-4">
      {/* Main Filters Row */}
      <div className="flex items-center gap-4">
        <div className="grid gap-4 md:grid-cols-5 flex-1">
          {/* Report Type */}
          <Select
            value={filters.reportType ?? 'sales'}
            onValueChange={(value) => setFilters({ reportType: value as 'sales' | 'inventory' | 'performance' })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Report Type" />
            </SelectTrigger>
            <SelectContent>
              {REPORT_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Date From */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none z-10" />
            <Input
              type="date"
              value={filters.dateFrom ? filters.dateFrom.toISOString().split('T')[0] : ''}
              onChange={(e) => {
                const date = e.target.value ? new Date(e.target.value) : null;
                setFilters({ dateFrom: date });
              }}
              className="pl-9"
              placeholder="From date"
            />
          </div>

          {/* Date To */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none z-10" />
            <Input
              type="date"
              value={filters.dateTo ? filters.dateTo.toISOString().split('T')[0] : ''}
              onChange={(e) => {
                const date = e.target.value ? new Date(e.target.value) : null;
                setFilters({ dateTo: date });
              }}
              className="pl-9"
              placeholder="To date"
            />
          </div>

          {/* Store Filter */}
          <Select
            value={filters.store ?? 'all'}
            onValueChange={(value) => setFilters({ store: value === 'all' ? null : value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="All Stores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stores</SelectItem>
              {stores.map((store) => (
                <SelectItem key={store.id} value={store.id}>
                  {store.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Group By */}
          <Select
            value={filters.groupBy ?? 'daily'}
            onValueChange={(value) => setFilters({ groupBy: value as 'daily' | 'weekly' | 'monthly' })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Group By" />
            </SelectTrigger>
            <SelectContent>
              {REPORT_GROUP_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {hasActiveFilters && (
          <Button variant="outline" onClick={resetFilters} size="sm">
            <X className="mr-2 h-4 w-4" />
            Reset
          </Button>
        )}
      </div>
    </div>
  );
}
