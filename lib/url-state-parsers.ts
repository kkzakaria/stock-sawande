/**
 * Reusable URL state parsers for nuqs
 * These parsers ensure type-safe URL parameter handling across the application
 */

import { parseAsInteger, parseAsString, parseAsStringEnum, parseAsIsoDateTime } from 'nuqs';

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
