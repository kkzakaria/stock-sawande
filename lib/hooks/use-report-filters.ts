'use client';

/**
 * Custom hook for managing report filters with nuqs
 * Provides type-safe URL state management for the Reports page
 */

import { useQueryStates } from 'nuqs';
import { parseAsString, parseAsStringEnum } from 'nuqs';
import {
  dateFromParser,
  dateToParser
} from '@/lib/url-state-parsers';

/**
 * Report type options
 */
const REPORT_TYPE = ['sales', 'inventory', 'performance'];
type ReportType = typeof REPORT_TYPE[number];

/**
 * Report grouping options
 */
const REPORT_GROUP_BY = ['daily', 'weekly', 'monthly'];
type ReportGroupBy = typeof REPORT_GROUP_BY[number];

/**
 * Hook for managing report filters in URL state
 * Returns current filter values and setter functions
 */
export function useReportFilters() {
  const [filters, setFilters] = useQueryStates({
    reportType: parseAsStringEnum<ReportType>(REPORT_TYPE).withDefault('sales'),
    store: parseAsString,
    dateFrom: dateFromParser,
    dateTo: dateToParser,
    groupBy: parseAsStringEnum<ReportGroupBy>(REPORT_GROUP_BY).withDefault('daily'),
  });

  /**
   * Reset all filters to default values
   */
  const resetFilters = () => {
    setFilters({
      reportType: 'sales',
      store: null,
      dateFrom: null,
      dateTo: null,
      groupBy: 'daily',
    });
  };

  return {
    filters,
    setFilters,
    resetFilters,
  };
}
