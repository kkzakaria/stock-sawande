import { type ColumnDef, type ColumnFiltersState, type Row, type SortingState, type VisibilityState } from "@tanstack/react-table";
import type { LucideIcon } from "lucide-react";

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

  // Initial state from URL (for nuqs integration - uncontrolled with URL sync)
  initialColumnFilters?: ColumnFiltersState;
  initialSorting?: SortingState;
  initialColumnVisibility?: VisibilityState;
  initialPagination?: { pageIndex: number; pageSize: number };

  // Callbacks for state changes (called on user interaction, not on mount)
  onColumnFiltersChange?: (filters: ColumnFiltersState) => void;
  onSortingChange?: (sorting: SortingState) => void;
  onColumnVisibilityChange?: (visibility: VisibilityState) => void;
  onPaginationChange?: (pagination: { pageIndex: number; pageSize: number }) => void;

  // Mobile cards (<md)
  mobileCard?: MobileCardConfig<TData>;
  bulkActions?: BulkAction<TData>[];
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

/**
 * Badge shown on the right of a mobile card.
 */
export type MobileCardBadgeVariant = "default" | "success" | "warning" | "danger";

export interface MobileCardBadge {
  label: React.ReactNode;
  variant?: MobileCardBadgeVariant;
}

/**
 * Menu action in the mobile card "⋮" dropdown.
 */
export interface MobileCardMenuItem {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  variant?: "default" | "destructive";
  disabled?: boolean;
}

/**
 * Content of a single mobile card, computed from a row.
 */
export interface MobileCardContent {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  details?: React.ReactNode;
  rightValue?: React.ReactNode;
  badge?: MobileCardBadge;
  thumbnail?: React.ReactNode;
  onClick?: () => void;
  menuItems?: MobileCardMenuItem[];
}

/**
 * Render prop the DataTable consumer provides to describe each row as a card.
 */
export type MobileCardConfig<TData> = (row: Row<TData>) => MobileCardContent;

/**
 * Action available in the mobile selection-mode bottom bar.
 */
export interface BulkAction<TData> {
  label: string;
  icon?: LucideIcon;
  onClick: (rows: TData[]) => void;
  variant?: "default" | "destructive";
}
