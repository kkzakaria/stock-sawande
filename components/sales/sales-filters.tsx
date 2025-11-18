'use client';

import { Search, X, Calendar } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSaleFilters } from '@/lib/hooks/use-sale-filters';
import { SALE_SORT_OPTIONS, ITEMS_PER_PAGE_OPTIONS } from '@/lib/types/filters';
import { useDebouncedCallback } from 'use-debounce';

interface Store {
  id: string;
  name: string;
}

interface SalesFiltersProps {
  stores: Store[];
}

export function SalesFilters({ stores }: SalesFiltersProps) {
  const { filters, setFilters, resetFilters, setFilterWithResetPage } = useSaleFilters();

  // Debounce search input
  const debouncedSearchChange = useDebouncedCallback((value: string) => {
    setFilterWithResetPage('search', value || '');
  }, 300);

  const hasActiveFilters = Boolean(
    filters.search || filters.status || filters.store || filters.dateFrom || filters.dateTo
  );

  return (
    <div className="space-y-4">
      {/* Search and Reset */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by invoice number or customer..."
            defaultValue={filters.search}
            onChange={(e) => debouncedSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        {hasActiveFilters && (
          <Button variant="outline" onClick={resetFilters} size="sm">
            <X className="mr-2 h-4 w-4" />
            Reset Filters
          </Button>
        )}
      </div>

      {/* Filters Row */}
      <div className="grid gap-4 md:grid-cols-6">
        {/* Date From */}
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none z-10" />
          <Input
            type="date"
            value={filters.dateFrom ? filters.dateFrom.toISOString().split('T')[0] : ''}
            onChange={(e) => {
              const date = e.target.value ? new Date(e.target.value) : null;
              setFilterWithResetPage('dateFrom', date);
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
              setFilterWithResetPage('dateTo', date);
            }}
            className="pl-9"
            placeholder="To date"
          />
        </div>

        {/* Status Filter */}
        <Select
          value={filters.status ?? 'all'}
          onValueChange={(value) => setFilterWithResetPage('status', value === 'all' ? null : value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>

        {/* Store Filter */}
        <Select
          value={filters.store ?? 'all'}
          onValueChange={(value) => setFilterWithResetPage('store', value === 'all' ? null : value)}
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

        {/* Sort By */}
        <Select
          value={filters.sortBy ?? 'created_at'}
          onValueChange={(value) => setFilters({ sortBy: value as 'created_at' | 'total_amount' | 'invoice_number' })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            {SALE_SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Sort Order + Items per page */}
        <div className="flex gap-2">
          <Select
            value={filters.sortOrder}
            onValueChange={(value) => setFilters({ sortOrder: value as 'asc' | 'desc' })}
          >
            <SelectTrigger className="w-[110px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asc">Ascending</SelectItem>
              <SelectItem value="desc">Descending</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={String(filters.limit)}
            onValueChange={(value) => setFilters({ limit: Number(value), page: 1 })}
          >
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ITEMS_PER_PAGE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={String(option.value)}>
                  {option.label} / page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
