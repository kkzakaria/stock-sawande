'use client';

/**
 * Custom hook for managing product filters with nuqs
 * Provides type-safe URL state management for the Products page
 */

import { useQueryStates } from 'nuqs';
import { parseAsString, parseAsStringEnum } from 'nuqs';
import { pageParser, limitParser, sortOrderParser, searchParser } from '@/lib/url-state-parsers';
import type { ProductFilters } from '@/lib/types/filters';

/**
 * Product sort by options
 */
const PRODUCT_SORT_BY = ['name', 'sku', 'price', 'quantity', 'created_at'];
type ProductSortBy = typeof PRODUCT_SORT_BY[number];

/**
 * Product status options
 */
const PRODUCT_STATUS = ['active', 'inactive'];
type ProductStatus = typeof PRODUCT_STATUS[number];

/**
 * Hook for managing product filters in URL state
 * Returns current filter values and setter functions
 */
export function useProductFilters() {
  const [filters, setFilters] = useQueryStates({
    search: searchParser,
    category: parseAsString,
    status: parseAsStringEnum<ProductStatus>(PRODUCT_STATUS),
    store: parseAsString,
    sortBy: parseAsStringEnum<ProductSortBy>(PRODUCT_SORT_BY).withDefault('created_at'),
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
      category: null,
      status: null,
      store: null,
      sortBy: 'created_at',
      sortOrder: 'asc',
      page: 1,
      limit: 10,
    });
  };

  /**
   * Reset pagination when filters change
   */
  const setFilterWithResetPage = (key: keyof ProductFilters, value: string | number | null | undefined) => {
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
