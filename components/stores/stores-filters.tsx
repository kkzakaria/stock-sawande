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
import { useStoreFilters } from '@/lib/hooks/use-store-filters';
import { STATUS_OPTIONS } from '@/lib/types/filters';
import { useDebouncedCallback } from 'use-debounce';
import { useTranslations } from 'next-intl';

export function StoresFilters() {
  const { filters, setFilters, resetFilters } = useStoreFilters();
  const t = useTranslations('Stores');
  const tStatus = useTranslations('Stores.status');

  // Debounce search input
  const debouncedSearchChange = useDebouncedCallback((value: string) => {
    setFilters({ search: value || '' });
  }, 300);

  const hasActiveFilters = Boolean(filters.search || filters.status);

  return (
    <div className="flex items-center gap-4">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t('searchPlaceholder')}
          defaultValue={filters.search}
          onChange={(e) => debouncedSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      <Select
        value={filters.status ?? 'all'}
        onValueChange={(value) => setFilters({ status: value === 'all' ? null : (value as 'active' | 'inactive') })}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder={t('filters.allStatus')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{tStatus('all')}</SelectItem>
          {STATUS_OPTIONS.filter(opt => opt.value !== null).map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {tStatus(option.value as 'active' | 'inactive')}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasActiveFilters && (
        <Button variant="outline" onClick={resetFilters} size="sm">
          <X className="mr-2 h-4 w-4" />
          {t('filters.reset')}
        </Button>
      )}
    </div>
  );
}
