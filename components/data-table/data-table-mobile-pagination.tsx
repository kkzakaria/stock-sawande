"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Table } from "@tanstack/react-table";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

interface DataTableMobilePaginationProps<TData> {
  table: Table<TData>;
}

export function DataTableMobilePagination<TData>({
  table,
}: DataTableMobilePaginationProps<TData>) {
  const t = useTranslations("DataTable");
  const pageIndex = table.getState().pagination.pageIndex;
  const pageCount = table.getPageCount();

  if (pageCount <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-4 py-2">
      <Button
        variant="outline"
        size="icon"
        className="h-11 w-11"
        onClick={() => table.previousPage()}
        disabled={!table.getCanPreviousPage()}
        aria-label={t("goToPrevious")}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </Button>
      <div
        className="min-w-24 text-center text-sm font-medium tabular-nums"
        aria-live="polite"
      >
        {t("page", { current: pageIndex + 1, total: pageCount })}
      </div>
      <Button
        variant="outline"
        size="icon"
        className="h-11 w-11"
        onClick={() => table.nextPage()}
        disabled={!table.getCanNextPage()}
        aria-label={t("goToNext")}
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
