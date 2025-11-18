/**
 * Filter types for URL state management across dashboard pages
 */

/**
 * Sort order type
 */
export type SortOrder = 'asc' | 'desc';

/**
 * Products page filters
 */
export interface ProductFilters {
  search?: string | null;
  category?: string | null;
  status?: 'active' | 'inactive' | null;
  store?: string | null;
  sortBy?: 'name' | 'sku' | 'price' | 'quantity' | 'created_at' | null;
  sortOrder?: SortOrder;
  page?: number;
  limit?: number;
}

/**
 * Products sort by options
 */
export const PRODUCT_SORT_OPTIONS = [
  { label: 'Name', value: 'name' },
  { label: 'SKU', value: 'sku' },
  { label: 'Price', value: 'price' },
  { label: 'Quantity', value: 'quantity' },
  { label: 'Date Created', value: 'created_at' },
] as const;

/**
 * Sales page filters
 */
export interface SaleFilters {
  search?: string | null;
  status?: 'completed' | 'refunded' | 'pending' | null;
  store?: string | null;
  dateFrom?: Date | null;
  dateTo?: Date | null;
  sortBy?: 'created_at' | 'total_amount' | 'invoice_number' | null;
  sortOrder?: SortOrder;
  page?: number;
  limit?: number;
}

/**
 * Sales sort by options
 */
export const SALE_SORT_OPTIONS = [
  { label: 'Date', value: 'created_at' },
  { label: 'Amount', value: 'total_amount' },
  { label: 'Invoice Number', value: 'invoice_number' },
] as const;

/**
 * Reports page filters
 */
export interface ReportFilters {
  reportType?: 'sales' | 'inventory' | 'performance' | null;
  store?: string | null;
  dateFrom?: Date | null;
  dateTo?: Date | null;
  groupBy?: 'daily' | 'weekly' | 'monthly' | null;
}

/**
 * Report type options
 */
export const REPORT_TYPE_OPTIONS = [
  { label: 'Sales Report', value: 'sales' },
  { label: 'Inventory Report', value: 'inventory' },
  { label: 'Performance Report', value: 'performance' },
] as const;

/**
 * Report grouping options
 */
export const REPORT_GROUP_OPTIONS = [
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
] as const;

/**
 * Stores page filters
 */
export interface StoreFilters {
  search?: string | null;
  status?: 'active' | 'inactive' | null;
}

/**
 * Common pagination defaults
 */
export const PAGINATION_DEFAULTS = {
  page: 1,
  limit: 10,
} as const;

/**
 * Items per page options
 */
export const ITEMS_PER_PAGE_OPTIONS = [
  { label: '10', value: 10 },
  { label: '25', value: 25 },
  { label: '50', value: 50 },
  { label: '100', value: 100 },
] as const;

/**
 * Status options
 */
export const STATUS_OPTIONS = [
  { label: 'All', value: null },
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
] as const;
