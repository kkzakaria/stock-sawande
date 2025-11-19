/**
 * Reusable URL state parsers for nuqs
 * These parsers ensure type-safe URL parameter handling across the application
 */

import { parseAsInteger, parseAsString, parseAsStringEnum, parseAsIsoDateTime, createParser } from 'nuqs';
import type { ColumnFiltersState, SortingState, VisibilityState } from '@tanstack/react-table';

/**
 * Pagination parsers
 */
export const pageParser = parseAsInteger.withDefault(1);
export const limitParser = parseAsInteger.withDefault(10);

/**
 * Sorting parsers
 */
export const sortOrderParser = parseAsStringEnum(['asc', 'desc'] as const).withDefault('asc');

/**
 * Search parser (nullable string)
 */
export const searchParser = parseAsString.withDefault('');

/**
 * Status parsers (nullable for "all" option)
 */
export const statusParser = parseAsString;

/**
 * Date range parsers
 */
export const dateFromParser = parseAsIsoDateTime;
export const dateToParser = parseAsIsoDateTime;

/**
 * Common enum parsers
 */
export const createEnumParser = <T extends string>(values: T[], defaultValue?: T) => {
  const parser = parseAsStringEnum(values);
  return defaultValue ? parser.withDefault(defaultValue) : parser;
};

/**
 * Numeric ID parser (for filtering by store, category, etc.)
 */
export const idParser = parseAsInteger;

/**
 * TanStack Table state parsers
 * These parsers handle complex table state for shareable URLs
 */

/**
 * Parser for column filters state
 * Stores array of {id: string, value: unknown}
 */
export const columnFiltersParser = createParser({
  parse: (value) => {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed as ColumnFiltersState : [];
    } catch {
      return [];
    }
  },
  serialize: (value) => JSON.stringify(value),
}).withDefault([]);

/**
 * Parser for sorting state
 * Stores array of {id: string, desc: boolean}
 */
export const sortingStateParser = createParser({
  parse: (value) => {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed as SortingState : [];
    } catch {
      return [];
    }
  },
  serialize: (value) => JSON.stringify(value),
}).withDefault([]);

/**
 * Parser for column visibility state
 * Stores object of {columnId: boolean}
 */
export const columnVisibilityParser = createParser({
  parse: (value) => {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === 'object' && parsed !== null ? parsed as VisibilityState : {};
    } catch {
      return {};
    }
  },
  serialize: (value) => JSON.stringify(value),
}).withDefault({});

/**
 * Parser for pagination page index
 */
export const pageIndexParser = parseAsInteger.withDefault(0);

/**
 * Parser for pagination page size
 */
export const pageSizeParser = parseAsInteger.withDefault(10);
