"use client";

import * as React from "react";
import { Plus, SlidersHorizontal, X } from "lucide-react";
import { Table } from "@tanstack/react-table";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { DataTableFacetedFilter } from "./data-table-faceted-filter";
import type { DataTableToolbarConfig } from "@/types/data-table";

interface DataTableMobileToolbarProps<TData> {
  table: Table<TData>;
  config?: DataTableToolbarConfig<TData>;
}

export function DataTableMobileToolbar<TData>({
  table,
  config,
}: DataTableMobileToolbarProps<TData>) {
  const t = useTranslations("DataTable");
  const tCommon = useTranslations("Common");
  const [sheetOpen, setSheetOpen] = React.useState(false);

  const activeFilterCount = table.getState().columnFilters.length;
  const isFiltered = activeFilterCount > 0;

  const sortableColumns = table
    .getAllColumns()
    .filter((c) => c.getCanSort() && c.columnDef.header);

  const currentSort = table.getState().sorting[0];

  return (
    <div
      className={cn(
        "sticky top-0 z-20 flex items-center gap-2 border-b bg-background/95 py-2 backdrop-blur",
        "pt-[max(0.5rem,env(safe-area-inset-top))]",
      )}
    >
      {config?.searchKey && (
        <Input
          type="search"
          inputMode="search"
          autoComplete="off"
          spellCheck={false}
          placeholder={config.searchPlaceholder ?? t("search")}
          value={
            (table.getColumn(config.searchKey)?.getFilterValue() as string) ?? ""
          }
          onChange={(e) =>
            table.getColumn(config.searchKey!)?.setFilterValue(e.target.value)
          }
          className="h-9 flex-1 min-w-0"
        />
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="relative h-9 w-9 shrink-0"
            aria-label={t("filters")}
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            {activeFilterCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent
          side="bottom"
          className="max-h-[85vh] overflow-y-auto overscroll-contain"
        >
          <SheetHeader>
            <SheetTitle>{t("filters")}</SheetTitle>
          </SheetHeader>

          <div className="space-y-6 py-4">
            {config?.filterableColumns && config.filterableColumns.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {config.filterableColumns.map((fc) => {
                  const column = table.getColumn(fc.id);
                  return column ? (
                    <DataTableFacetedFilter
                      key={fc.id}
                      column={column}
                      title={fc.title}
                      options={fc.options}
                    />
                  ) : null;
                })}
                {isFiltered && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => table.resetColumnFilters()}
                  >
                    {tCommon("reset")}
                    <X className="ml-2 h-4 w-4" aria-hidden="true" />
                  </Button>
                )}
              </div>
            )}

            {sortableColumns.length > 0 && (
              <div className="space-y-3">
                <div className="text-sm font-medium">{t("sortBy")}</div>
                <RadioGroup
                  value={currentSort?.id ?? ""}
                  onValueChange={(id) => {
                    table.setSorting([{ id, desc: currentSort?.desc ?? false }]);
                  }}
                  className="space-y-1"
                >
                  {sortableColumns.map((col) => (
                    <div key={col.id} className="flex items-center gap-2">
                      <RadioGroupItem value={col.id} id={`sort-${col.id}`} />
                      <Label htmlFor={`sort-${col.id}`} className="text-sm font-normal">
                        {typeof col.columnDef.header === "string"
                          ? col.columnDef.header
                          : col.id}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>

                {currentSort && (
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant={!currentSort.desc ? "default" : "outline"}
                      onClick={() =>
                        table.setSorting([{ id: currentSort.id, desc: false }])
                      }
                    >
                      {t("ascending")}
                    </Button>
                    <Button
                      size="sm"
                      variant={currentSort.desc ? "default" : "outline"}
                      onClick={() =>
                        table.setSorting([{ id: currentSort.id, desc: true }])
                      }
                    >
                      {t("descending")}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          <SheetFooter>
            <Button onClick={() => setSheetOpen(false)} className="w-full">
              {t("apply")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {config?.onAdd && (
        <Button
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={config.onAdd}
          aria-label={config.addLabel ?? tCommon("add")}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}
