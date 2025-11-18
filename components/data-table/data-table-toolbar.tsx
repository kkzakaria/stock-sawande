"use client";

import * as React from "react";
import { Table } from "@tanstack/react-table";
import { Download, Plus, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTableViewOptions } from "@/components/data-table/data-table-view-options";
import { DataTableFacetedFilter } from "@/components/data-table/data-table-faceted-filter";
import type { DataTableToolbarConfig } from "@/types/data-table";
import { exportToCSV, exportToExcel } from "@/lib/utils/export-utils";
import { parseCSV, parseExcel } from "@/lib/utils/import-utils";
import { toast } from "sonner";

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  config?: DataTableToolbarConfig<TData>;
}

export function DataTableToolbar<TData>({
  table,
  config,
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0;
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const isCSV = file.name.endsWith(".csv");
      const result = isCSV
        ? await parseCSV<TData>(file)
        : await parseExcel<TData>(file);

      if (result.success && config?.onImport) {
        await config.onImport(result.data);
        toast.success(`Successfully imported ${result.data.length} rows`);
      } else if (result.errors.length > 0) {
        toast.error(`Import failed: ${result.errors[0].message}`);
      }
    } catch {
      toast.error("Failed to import file");
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleExport = (format: "csv" | "excel") => {
    const hasSelection = table.getFilteredSelectedRowModel().rows.length > 0;

    if (format === "csv") {
      exportToCSV(table, "export.csv", hasSelection);
      toast.success(
        hasSelection
          ? `Exported ${table.getFilteredSelectedRowModel().rows.length} selected rows`
          : `Exported ${table.getFilteredRowModel().rows.length} rows`
      );
    } else {
      exportToExcel(table, "export.xlsx", hasSelection);
      toast.success(
        hasSelection
          ? `Exported ${table.getFilteredSelectedRowModel().rows.length} selected rows`
          : `Exported ${table.getFilteredRowModel().rows.length} rows`
      );
    }
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2">
        {config?.searchKey && (
          <Input
            placeholder={config.searchPlaceholder ?? "Search..."}
            value={
              (table.getColumn(config.searchKey)?.getFilterValue() as string) ??
              ""
            }
            onChange={(event) =>
              table
                .getColumn(config.searchKey!)
                ?.setFilterValue(event.target.value)
            }
            className="h-8 w-[150px] lg:w-[250px]"
          />
        )}
        {config?.filterableColumns?.map((filterColumn) => {
          const column = table.getColumn(filterColumn.id);
          return column ? (
            <DataTableFacetedFilter
              key={filterColumn.id}
              column={column}
              title={filterColumn.title}
              options={filterColumn.options}
            />
          ) : null;
        })}
        {isFiltered && (
          <Button
            variant="ghost"
            onClick={() => table.resetColumnFilters()}
            className="h-8 px-2 lg:px-3"
          >
            Reset
            <X className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
      <div className="flex items-center space-x-2">
        {config?.onAdd && (
          <Button onClick={config.onAdd} size="sm" className="h-8">
            <Plus className="mr-2 h-4 w-4" />
            {config.addLabel ?? "Add"}
          </Button>
        )}
        {config?.enableImport && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleImport}
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              Import
            </Button>
          </>
        )}
        {config?.enableExport && (
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => handleExport("csv")}
          >
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        )}
        <DataTableViewOptions table={table} />
      </div>
    </div>
  );
}
