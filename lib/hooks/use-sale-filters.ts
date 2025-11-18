'use client';

/**
 * Custom hook for managing sale filters with nuqs
 * Provides type-safe URL state management for the Sales page
 */

import { useQueryStates } from 'nuqs';
import { parseAsString, parseAsStringEnum } from 'nuqs';
import {
  pageParser,
  limitParser,
  sortOrderParser,
  searchParser,
  dateFromParser,
  dateToParser
} from '@/lib/url-state-parsers';
import type { SaleFilters } from '@/lib/types/filters';

/**
 * Sale sort by options
 */
const SALE_SORT_BY = ['created_at', 'total_amount', 'invoice_number'];
type SaleSortBy = typeof SALE_SORT_BY[number];

/**
 * Sale status options
 */
const SALE_STATUS = ['completed', 'refunded', 'pending'];
type SaleStatus = typeof SALE_STATUS[number];

/**
 * Hook for managing sale filters in URL state
 * Returns current filter values and setter functions
 */
export function useSaleFilters() {
  const [filters, setFilters] = useQueryStates({
    search: searchParser,
    status: parseAsStringEnum<SaleStatus>(SALE_STATUS),
    store: parseAsString,
    dateFrom: dateFromParser,
    dateTo: dateToParser,
    sortBy: parseAsStringEnum<SaleSortBy>(SALE_SORT_BY).withDefault('created_at'),
    sortOrder: sortOrderParser,
    page: pageParser,
    limit: limitParser,
  });

  /**
   * Reset all filters to default values
   */
  const resetFilters = () => {
    setFilters({
      search: '',
      status: null,
      store: null,
      dateFrom: null,
      dateTo: null,
      sortBy: 'created_at',
      sortOrder: 'asc',
      page: 1,
      limit: 10,
    });
  };

  /**
   * Reset pagination when filters change
   */
  const setFilterWithResetPage = (key: keyof SaleFilters, value: string | number | Date | null | undefined) => {
    setFilters({
      [key]: value,
      page: 1, // Reset to first page when filter changes
    });
  };

  return {
    filters,
    setFilters,
    resetFilters,
    setFilterWithResetPage,
  };
}
