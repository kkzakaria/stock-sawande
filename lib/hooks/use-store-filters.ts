'use client';

/**
 * Custom hook for managing store filters with nuqs
 * Provides type-safe URL state management for the Stores page
 */

import { useQueryStates } from 'nuqs';
import { parseAsStringEnum } from 'nuqs';
import { searchParser } from '@/lib/url-state-parsers';

/**
 * Store status options
 */
const STORE_STATUS = ['active', 'inactive'];
type StoreStatus = typeof STORE_STATUS[number];

/**
 * Hook for managing store filters in URL state
 * Returns current filter values and setter functions
 */
export function useStoreFilters() {
  const [filters, setFilters] = useQueryStates({
    search: searchParser,
    status: parseAsStringEnum<StoreStatus>(STORE_STATUS),
  });

  /**
   * Reset all filters to default values
   */
  const resetFilters = () => {
    setFilters({
      search: '',
      status: null,
    });
  };

  return {
    filters,
    setFilters,
    resetFilters,
  };
}
