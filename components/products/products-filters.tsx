'use client';

import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useProductFilters } from '@/lib/hooks/use-product-filters';
import { PRODUCT_SORT_OPTIONS, ITEMS_PER_PAGE_OPTIONS, STATUS_OPTIONS } from '@/lib/types/filters';
import { useDebouncedCallback } from 'use-debounce';

interface Category {
  id: string;
  name: string;
}

interface Store {
  id: string;
  name: string;
}

interface ProductsFiltersProps {
  categories: Category[];
  stores: Store[];
}

export function ProductsFilters({ categories, stores }: ProductsFiltersProps) {
  const { filters, setFilters, resetFilters, setFilterWithResetPage } = useProductFilters();

  // Debounce search input to avoid too many URL updates
  const debouncedSearchChange = useDebouncedCallback((value: string) => {
    setFilterWithResetPage('search', value || '');
  }, 300);

  const hasActiveFilters = Boolean(
    filters.search || filters.category || filters.status || filters.store
  );

  return (
    <div className="space-y-4">
      {/* Search and Reset */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or SKU..."
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
      <div className="grid gap-4 md:grid-cols-5">
        {/* Category Filter */}
        <Select
          value={filters.category ?? 'all'}
          onValueChange={(value) => setFilterWithResetPage('category', value === 'all' ? null : value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

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
            {STATUS_OPTIONS.filter(opt => opt.value !== null).map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
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
          onValueChange={(value) => setFilters({ sortBy: value as 'name' | 'sku' | 'price' | 'quantity' | 'created_at' })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            {PRODUCT_SORT_OPTIONS.map((option) => (
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
