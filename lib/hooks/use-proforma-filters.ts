'use client';

/**
 * Custom hook for managing proforma filters with nuqs
 * Provides type-safe URL state management for the Proformas page
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
import type { ProformaFilters } from '@/lib/types/filters';

/**
 * Proforma sort by options
 */
const PROFORMA_SORT_BY = ['created_at', 'total_amount', 'proforma_number', 'valid_until'];
type ProformaSortBy = typeof PROFORMA_SORT_BY[number];

/**
 * Proforma status options
 */
const PROFORMA_STATUS = ['draft', 'sent', 'accepted', 'rejected', 'converted', 'expired'];
type ProformaStatus = typeof PROFORMA_STATUS[number];

/**
 * Hook for managing proforma filters in URL state
 * Returns current filter values and setter functions
 */
export function useProformaFilters() {
  const [filters, setFilters] = useQueryStates({
    search: searchParser,
    status: parseAsStringEnum<ProformaStatus>(PROFORMA_STATUS),
    store: parseAsString,
    customerId: parseAsString,
    dateFrom: dateFromParser,
    dateTo: dateToParser,
    sortBy: parseAsStringEnum<ProformaSortBy>(PROFORMA_SORT_BY).withDefault('created_at'),
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
      customerId: null,
      dateFrom: null,
      dateTo: null,
      sortBy: 'created_at',
      sortOrder: 'desc',
      page: 1,
      limit: 10,
    });
  };

  /**
   * Reset pagination when filters change
   */
  const setFilterWithResetPage = (key: keyof ProformaFilters, value: string | number | Date | null | undefined) => {
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
