"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Table } from "@tanstack/react-table";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTableCard } from "./data-table-card";
import type { BulkAction, MobileCardConfig } from "@/types/data-table";

interface DataTableMobileListProps<TData> {
  table: Table<TData>;
  mobileCard: MobileCardConfig<TData>;
  bulkActions?: BulkAction<TData>[];
  isLoading?: boolean;
  emptyMessage?: string;
}

export function DataTableMobileList<TData>({
  table,
  mobileCard,
  bulkActions,
  isLoading,
  emptyMessage,
}: DataTableMobileListProps<TData>) {
  const t = useTranslations("DataTable");
  const [selectionMode, setSelectionMode] = React.useState(false);

  const rows = table.getRowModel().rows;
  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const selectedCount = selectedRows.length;

  // Exit selection mode when there are no selected rows left
  React.useEffect(() => {
    if (selectionMode && selectedCount === 0) {
      setSelectionMode(false);
    }
  }, [selectionMode, selectedCount]);

  // Exit selection mode when filters/pagination change
  const filterState = table.getState().columnFilters;
  const pageIndex = table.getState().pagination.pageIndex;
  React.useEffect(() => {
    if (selectionMode) {
      table.resetRowSelection();
      setSelectionMode(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterState, pageIndex]);

  const exitSelectionMode = () => {
    table.resetRowSelection();
    setSelectionMode(false);
  };

  if (isLoading) {
    return (
      <div className="space-y-2" role="list" aria-busy="true">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg border bg-card p-3">
            <Skeleton className="h-11 w-11 rounded-md" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-5 w-12" />
          </div>
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div
        className="flex min-h-40 items-center justify-center rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground"
        role="status"
      >
        {emptyMessage ?? t("noResults")}
      </div>
    );
  }

  return (
    <>
      <div role="list" className="space-y-2 pb-24">
        {rows.map((row) => {
          const content = mobileCard(row);
          return (
            <DataTableCard
              key={row.id}
              content={content}
              selected={row.getIsSelected()}
              selectionMode={selectionMode}
              actionsLabel={t("actions")}
              onTap={() => {
                if (selectionMode) {
                  row.toggleSelected(!row.getIsSelected());
                } else {
                  content.onClick?.();
                }
              }}
              onLongPressActivate={() => {
                setSelectionMode(true);
                row.toggleSelected(true);
              }}
            />
          );
        })}
      </div>

      {selectionMode && (
        <div
          className={cn(
            "fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur",
            "pb-[env(safe-area-inset-bottom)]",
          )}
        >
          <div className="flex items-center gap-2 p-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={exitSelectionMode}
              aria-label={t("clearSelection")}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
            <span
              className="flex-1 text-sm font-medium"
              aria-live="polite"
            >
              {t("rowsSelectedShort", { count: selectedCount })}
            </span>
            <div className="flex items-center gap-2">
              {bulkActions?.map((action, i) => {
                const Icon = action.icon;
                return (
                  <Button
                    key={i}
                    size="sm"
                    variant={action.variant === "destructive" ? "destructive" : "outline"}
                    onClick={() =>
                      action.onClick(selectedRows.map((r) => r.original))
                    }
                  >
                    {Icon && <Icon className="mr-1 h-4 w-4" aria-hidden="true" />}
                    {action.label}
                  </Button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
