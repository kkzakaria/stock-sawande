'use client';

/**
 * Custom hook for managing data-table state with nuqs
 * Provides type-safe URL state management for shareable table filters and sorting
 */

import { useCallback } from 'react';
import { useQueryStates } from 'nuqs';
import {
  columnFiltersParser,
  sortingStateParser,
  columnVisibilityParser,
  pageIndexParser,
  pageSizeParser,
} from '@/lib/url-state-parsers';
import type { ColumnFiltersState, SortingState, VisibilityState } from '@tanstack/react-table';

/**
 * Options for configuring data table URL state
 */
export interface DataTableStateOptions {
  /**
   * Default page size for pagination
   * @default 10
   */
  defaultPageSize?: number;

  /**
   * Whether to sync column filters with URL
   * @default true
   */
  enableFiltersInUrl?: boolean;

  /**
   * Whether to sync sorting with URL
   * @default true
   */
  enableSortingInUrl?: boolean;

  /**
   * Whether to sync column visibility with URL
   * @default false
   */
  enableVisibilityInUrl?: boolean;

  /**
   * Whether to sync pagination with URL
   * @default true
   */
  enablePaginationInUrl?: boolean;
}

/**
 * Hook for managing data-table state in URL with nuqs
 * Returns current state values and setter functions
 *
 * @example
 * ```tsx
 * const { columnFilters, sorting, pagination, setColumnFilters, setSorting, setPagination } = useDataTableState();
 *
 * <DataTable
 *   data={data}
 *   columns={columns}
 *   columnFilters={columnFilters}
 *   sorting={sorting}
 *   pagination={pagination}
 *   onColumnFiltersChange={setColumnFilters}
 *   onSortingChange={setSorting}
 *   onPaginationChange={setPagination}
 * />
 * ```
 */
export function useDataTableState(options: DataTableStateOptions = {}) {
  const {
    defaultPageSize = 10,
    enableFiltersInUrl = true,
    enableSortingInUrl = true,
    enableVisibilityInUrl = false,
    enablePaginationInUrl = true,
  } = options;

  // Build parsers object dynamically based on enabled options
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parsers: Record<string, any> = {};

  if (enableFiltersInUrl) {
    parsers.filters = columnFiltersParser;
  }

  if (enableSortingInUrl) {
    parsers.sorting = sortingStateParser;
  }

  if (enableVisibilityInUrl) {
    parsers.visibility = columnVisibilityParser;
  }

  if (enablePaginationInUrl) {
    parsers.pageIndex = pageIndexParser;
    parsers.pageSize = pageSizeParser.withDefault(defaultPageSize);
  }

  const [state, setState] = useQueryStates(parsers, {
    shallow: true, // Use shallow routing to prevent server re-renders
  });

  /**
   * Reset all state to default values
   */
  const resetState = useCallback(() => {
    setState({
      filters: [],
      sorting: [],
      visibility: {},
      pageIndex: 0,
      pageSize: defaultPageSize,
    });
  }, [setState, defaultPageSize]);

  /**
   * Reset filters and go back to first page
   */
  const resetFilters = useCallback(() => {
    setState({
      filters: [],
      pageIndex: 0,
    });
  }, [setState]);

  // Memoize setters to prevent infinite re-renders
  const setColumnFilters = useCallback(
    (filters: ColumnFiltersState | ((prev: ColumnFiltersState) => ColumnFiltersState)) => {
      setState((prev) => {
        const currentFilters = (prev.filters ?? []) as ColumnFiltersState;
        const newFilters = typeof filters === 'function' ? filters(currentFilters) : filters;
        return {
          filters: newFilters,
          pageIndex: 0, // Reset to first page when filters change
        };
      });
    },
    [setState]
  );

  const setSorting = useCallback(
    (sorting: SortingState | ((prev: SortingState) => SortingState)) => {
      setState((prev) => {
        const currentSorting = (prev.sorting ?? []) as SortingState;
        const newSorting = typeof sorting === 'function' ? sorting(currentSorting) : sorting;
        return { sorting: newSorting };
      });
    },
    [setState]
  );

  const setColumnVisibility = useCallback(
    (visibility: VisibilityState | ((prev: VisibilityState) => VisibilityState)) => {
      setState((prev) => {
        const currentVisibility = (prev.visibility ?? {}) as VisibilityState;
        const newVisibility = typeof visibility === 'function' ? visibility(currentVisibility) : visibility;
        return { visibility: newVisibility };
      });
    },
    [setState]
  );

  const setPagination = useCallback(
    (pagination: { pageIndex: number; pageSize: number } | ((prev: { pageIndex: number; pageSize: number }) => { pageIndex: number; pageSize: number })) => {
      setState((prev) => {
        const currentPagination = {
          pageIndex: prev.pageIndex ?? 0,
          pageSize: prev.pageSize ?? defaultPageSize,
        };
        const newPagination = typeof pagination === 'function' ? pagination(currentPagination) : pagination;
        return {
          pageIndex: newPagination.pageIndex,
          pageSize: newPagination.pageSize,
        };
      });
    },
    [setState, defaultPageSize]
  );

  return {
    // Current state values
    columnFilters: (state.filters ?? []) as ColumnFiltersState,
    sorting: (state.sorting ?? []) as SortingState,
    columnVisibility: (state.visibility ?? {}) as VisibilityState,
    pagination: {
      pageIndex: state.pageIndex ?? 0,
      pageSize: state.pageSize ?? defaultPageSize,
    },

    // Setter functions
    setColumnFilters,
    setSorting,
    setColumnVisibility,
    setPagination,

    // Utility functions
    resetState,
    resetFilters,
  };
}
