"use client";

import * as React from "react";
import {
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { DataTableMobileList } from "@/components/data-table/data-table-mobile-list";
import { DataTableMobileToolbar } from "@/components/data-table/data-table-mobile-toolbar";
import { DataTableMobilePagination } from "@/components/data-table/data-table-mobile-pagination";
import type { DataTableProps } from "@/types/data-table";

export function DataTable<TData, TValue>({
  columns,
  data,
  toolbar,
  pageSize = 10,
  pageSizeOptions = [10, 20, 30, 40, 50],
  enablePagination = true,
  enableRowSelection = false,
  enableSorting = true,
  isLoading = false,
  emptyMessage,
  getRowId,
  onRowSelectionChange,
  manualPagination = false,
  pageCount,
  // Initial state from URL
  initialColumnFilters = [],
  initialSorting = [],
  initialColumnVisibility = {},
  initialPagination,
  // Callbacks for state changes
  onColumnFiltersChange,
  onSortingChange,
  onColumnVisibilityChange,
  onPaginationChange,
  mobileCard,
  bulkActions,
}: DataTableProps<TData, TValue>) {
  const t = useTranslations("DataTable");

  // Track if component is mounted to prevent state updates during render
  const isMountedRef = React.useRef(false);
  React.useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Local state initialized with URL values
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(initialColumnVisibility);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(initialColumnFilters);
  const [sorting, setSorting] = React.useState<SortingState>(initialSorting);
  const [pagination, setPagination] = React.useState(initialPagination || {
    pageIndex: 0,
    pageSize,
  });

  // Wrapper setters that update local state (only after mount to prevent render-time state updates)
  const handleColumnFiltersChange = React.useCallback(
    (updater: ColumnFiltersState | ((prev: ColumnFiltersState) => ColumnFiltersState)) => {
      if (isMountedRef.current) {
        setColumnFilters(updater);
      }
    },
    []
  );

  const handleSortingChange = React.useCallback(
    (updater: SortingState | ((prev: SortingState) => SortingState)) => {
      if (isMountedRef.current) {
        setSorting(updater);
      }
    },
    []
  );

  const handleColumnVisibilityChange = React.useCallback(
    (updater: VisibilityState | ((prev: VisibilityState) => VisibilityState)) => {
      if (isMountedRef.current) {
        setColumnVisibility(updater);
      }
    },
    []
  );

  const handlePaginationChange = React.useCallback(
    (updater: { pageIndex: number; pageSize: number } | ((prev: { pageIndex: number; pageSize: number }) => { pageIndex: number; pageSize: number })) => {
      if (isMountedRef.current) {
        setPagination(updater);
      }
    },
    []
  );

  // Call URL sync callbacks after state changes (outside of render)
  // Skip initial render to prevent state updates before mount
  React.useEffect(() => {
    if (isMountedRef.current && onColumnFiltersChange) {
      onColumnFiltersChange(columnFilters);
    }
  }, [columnFilters, onColumnFiltersChange]);

  React.useEffect(() => {
    if (isMountedRef.current && onSortingChange) {
      onSortingChange(sorting);
    }
  }, [sorting, onSortingChange]);

  React.useEffect(() => {
    if (isMountedRef.current && onColumnVisibilityChange) {
      onColumnVisibilityChange(columnVisibility);
    }
  }, [columnVisibility, onColumnVisibilityChange]);

  React.useEffect(() => {
    if (isMountedRef.current && onPaginationChange) {
      onPaginationChange(pagination);
    }
  }, [pagination, onPaginationChange]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    // Only set pageCount for manual pagination, otherwise let TanStack Table calculate it
    pageCount: manualPagination ? (pageCount ?? -1) : undefined,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      pagination,
    },
    enableRowSelection,
    onRowSelectionChange: setRowSelection,
    onSortingChange: handleSortingChange,
    onColumnFiltersChange: handleColumnFiltersChange,
    onColumnVisibilityChange: handleColumnVisibilityChange,
    onPaginationChange: handlePaginationChange,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: enablePagination
      ? getPaginationRowModel()
      : undefined,
    getSortedRowModel: enableSorting ? getSortedRowModel() : undefined,
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getRowId,
    manualPagination,
  });

  // Track previous pagination to detect actual changes
  const prevPaginationRef = React.useRef(pagination);

  // Notify parent of selection changes
  React.useEffect(() => {
    if (onRowSelectionChange) {
      const selectedRows = table
        .getFilteredSelectedRowModel()
        .rows.map((row) => row.original);
      onRowSelectionChange(selectedRows);
    }
  }, [rowSelection, onRowSelectionChange, table]);

  // Notify parent of pagination changes (for server-side pagination)
  React.useEffect(() => {
    // Only call if pagination actually changed from previous value
    const prevPagination = prevPaginationRef.current;
    const hasChanged =
      prevPagination.pageIndex !== pagination.pageIndex ||
      prevPagination.pageSize !== pagination.pageSize;

    if (hasChanged && manualPagination && onPaginationChange) {
      onPaginationChange(pagination);
      prevPaginationRef.current = pagination;
    }
  }, [pagination, manualPagination, onPaginationChange]);

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Desktop toolbar */}
      {toolbar && (
        <div className="hidden md:block">
          <DataTableToolbar table={table} config={toolbar} />
        </div>
      )}

      {/* Mobile toolbar — only shown when mobileCard is provided */}
      {mobileCard && (
        <div className="md:hidden">
          <DataTableMobileToolbar table={table} config={toolbar} />
        </div>
      )}

      {/* Desktop table */}
      <div
        className={cn(
          "rounded-md border flex-1 min-h-0",
          mobileCard && "hidden md:block",
        )}
      >
        <div className="relative h-full overflow-auto overscroll-x-contain">
          <table className="w-full caption-bottom text-sm">
            <thead className="[&_tr]:border-b sticky top-0 z-10 bg-card shadow-sm">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr
                  key={headerGroup.id}
                  className={cn(
                    "hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors",
                    "bg-card hover:bg-card border-b-2"
                  )}
                >
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      colSpan={header.colSpan}
                      className={cn(
                        "text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
                        "!font-bold"
                      )}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className={cn("[&_tr:last-child]:border-0")}>
              {isLoading ? (
                <tr className="hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors">
                  <td
                    colSpan={columns.length}
                    className="p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] h-24 text-center"
                  >
                    {t("loading")}
                  </td>
                </tr>
              ) : table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className="hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]"
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr className="hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors">
                  <td
                    colSpan={columns.length}
                    className="p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] h-24 text-center"
                  >
                    {emptyMessage ?? t("noResults")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile card list */}
      {mobileCard && (
        <div className="md:hidden flex-1 min-h-0 overflow-y-auto">
          <DataTableMobileList
            table={table}
            mobileCard={mobileCard}
            bulkActions={bulkActions}
            isLoading={isLoading}
            emptyMessage={emptyMessage}
          />
        </div>
      )}

      {enablePagination && (
        <div className="flex-shrink-0">
          <div className="hidden md:block">
            <DataTablePagination table={table} pageSizeOptions={pageSizeOptions} />
          </div>
          {mobileCard && (
            <div className="md:hidden">
              <DataTableMobilePagination table={table} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
