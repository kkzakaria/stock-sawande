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
}: DataTableProps<TData, TValue>) {
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize,
  });

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
