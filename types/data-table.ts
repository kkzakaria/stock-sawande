import { type ColumnDef } from "@tanstack/react-table";

/**
 * Filter option for faceted filters
 */
export interface FilterOption {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
}

/**
 * Filterable column configuration
 */
export interface FilterableColumn {
  id: string;
  title: string;
  options: FilterOption[];
}

/**
 * DataTable toolbar configuration
 */
export interface DataTableToolbarConfig<TData> {
  searchKey?: string;
  searchPlaceholder?: string;
  filterableColumns?: FilterableColumn[];
  onAdd?: () => void;
  addLabel?: string;
  onImport?: (data: TData[]) => Promise<void>;
  onExport?: () => void;
  enableExport?: boolean;
  enableImport?: boolean;
}

/**
 * Main DataTable component props
 */
export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];

  // Toolbar configuration
  toolbar?: DataTableToolbarConfig<TData>;

  // Pagination
  pageSize?: number;
  pageSizeOptions?: number[];
  enablePagination?: boolean;

  // Server-side pagination
  manualPagination?: boolean;
  pageCount?: number;
  onPaginationChange?: (pageIndex: number, pageSize: number) => void;

  // Selection
  enableRowSelection?: boolean;
  onRowSelectionChange?: (selectedRows: TData[]) => void;

  // Sorting
  enableSorting?: boolean;

  // Column visibility
  enableColumnVisibility?: boolean;

  // States
  isLoading?: boolean;
  emptyMessage?: string;

  // Advanced
  getRowId?: (row: TData) => string;
}

/**
 * Export format options
 */
export type ExportFormat = "csv" | "excel";

/**
 * Export configuration
 */
export interface ExportConfig {
  filename?: string;
  format: ExportFormat;
  selectedOnly?: boolean;
}

/**
 * Import result
 */
export interface ImportResult<TData> {
  data: TData[];
  errors: ImportError[];
  success: boolean;
}

/**
 * Import error
 */
export interface ImportError {
  row: number;
  field?: string;
  message: string;
}
