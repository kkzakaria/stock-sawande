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

import { cn } from "@/lib/utils";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
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
  emptyMessage = "No results.",
  getRowId,
  onRowSelectionChange,
  manualPagination = false,
  pageCount,
  onPaginationChange,
  // Controlled state props
  columnFilters: controlledColumnFilters,
  onColumnFiltersChange: onControlledColumnFiltersChange,
  sorting: controlledSorting,
  onSortingChange: onControlledSortingChange,
  columnVisibility: controlledColumnVisibility,
  onColumnVisibilityChange: onControlledColumnVisibilityChange,
  controlledPagination,
  onControlledPaginationChange,
}: DataTableProps<TData, TValue>) {
  // Local state (used when not controlled)
  const [rowSelection, setRowSelection] = React.useState({});
  const [localColumnVisibility, setLocalColumnVisibility] =
    React.useState<VisibilityState>({});
  const [localColumnFilters, setLocalColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [localSorting, setLocalSorting] = React.useState<SortingState>([]);
  const [localPagination, setLocalPagination] = React.useState({
    pageIndex: 0,
    pageSize,
  });

  // Determine if controlled or uncontrolled
  const isColumnFiltersControlled = controlledColumnFilters !== undefined;
  const isSortingControlled = controlledSorting !== undefined;
  const isColumnVisibilityControlled = controlledColumnVisibility !== undefined;
  const isPaginationControlled = controlledPagination !== undefined;

  // Use controlled state if provided, otherwise use local state
  const columnFilters = isColumnFiltersControlled ? controlledColumnFilters : localColumnFilters;
  const sorting = isSortingControlled ? controlledSorting : localSorting;
  const columnVisibility = isColumnVisibilityControlled ? controlledColumnVisibility : localColumnVisibility;
  const pagination = isPaginationControlled ? controlledPagination : localPagination;

  // Wrapper setters that call controlled callbacks or update local state
  const setColumnFilters = React.useCallback(
    (updater: ColumnFiltersState | ((prev: ColumnFiltersState) => ColumnFiltersState)) => {
      const newValue = typeof updater === 'function' ? updater(columnFilters) : updater;
      if (isColumnFiltersControlled && onControlledColumnFiltersChange) {
        onControlledColumnFiltersChange(newValue);
      } else {
        setLocalColumnFilters(newValue);
      }
    },
    [columnFilters, isColumnFiltersControlled, onControlledColumnFiltersChange]
  );

  const setSorting = React.useCallback(
    (updater: SortingState | ((prev: SortingState) => SortingState)) => {
      const newValue = typeof updater === 'function' ? updater(sorting) : updater;
      if (isSortingControlled && onControlledSortingChange) {
        onControlledSortingChange(newValue);
      } else {
        setLocalSorting(newValue);
      }
    },
    [sorting, isSortingControlled, onControlledSortingChange]
  );

  const setColumnVisibility = React.useCallback(
    (updater: VisibilityState | ((prev: VisibilityState) => VisibilityState)) => {
      const newValue = typeof updater === 'function' ? updater(columnVisibility) : updater;
      if (isColumnVisibilityControlled && onControlledColumnVisibilityChange) {
        onControlledColumnVisibilityChange(newValue);
      } else {
        setLocalColumnVisibility(newValue);
      }
    },
    [columnVisibility, isColumnVisibilityControlled, onControlledColumnVisibilityChange]
  );

  const setPagination = React.useCallback(
    (updater: { pageIndex: number; pageSize: number } | ((prev: { pageIndex: number; pageSize: number }) => { pageIndex: number; pageSize: number })) => {
      const newValue = typeof updater === 'function' ? updater(pagination) : updater;
      if (isPaginationControlled && onControlledPaginationChange) {
        onControlledPaginationChange(newValue);
      } else {
        setLocalPagination(newValue);
      }
    },
    [pagination, isPaginationControlled, onControlledPaginationChange]
  );

  const table = useReactTable({
    data,
    columns,
    pageCount: pageCount ?? -1,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      pagination,
    },
    enableRowSelection,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
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
      onPaginationChange(pagination.pageIndex, pagination.pageSize);
      prevPaginationRef.current = pagination;
    }
  }, [pagination, manualPagination, onPaginationChange]);

  return (
    <div className="flex flex-col h-full space-y-4">
      {toolbar && <DataTableToolbar table={table} config={toolbar} />}
      <div className="rounded-md border flex-1 min-h-0">
        <div className="relative h-full overflow-auto">
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
                  {headerGroup.headers.map((header) => {
                    return (
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
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody className={cn("[&_tr:last-child]:border-0")}>
              {isLoading ? (
                <tr
                  className={cn(
                    "hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors"
                  )}
                >
                  <td
                    colSpan={columns.length}
                    className={cn(
                      "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
                      "h-24 text-center"
                    )}
                  >
                    Loading...
                  </td>
                </tr>
              ) : table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className={cn(
                      "hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors"
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className={cn(
                          "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]"
                        )}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr
                  className={cn(
                    "hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors"
                  )}
                >
                  <td
                    colSpan={columns.length}
                    className={cn(
                      "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
                      "h-24 text-center"
                    )}
                  >
                    {emptyMessage}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {enablePagination && (
        <div className="flex-shrink-0">
          <DataTablePagination table={table} pageSizeOptions={pageSizeOptions} />
        </div>
      )}
    </div>
  );
}
