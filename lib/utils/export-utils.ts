import { type Table } from "@tanstack/react-table";

type ExportableData = Record<string, unknown>;

function collectExportRows<TData>(
  table: Table<TData>,
  selectedOnly: boolean
): { headers: string[]; data: ExportableData[] } {
  const rows = selectedOnly
    ? table.getSelectedRowModel().rows
    : table.getFilteredRowModel().rows;

  if (rows.length === 0) {
    return { headers: [], data: [] };
  }

  const visibleColumns = table.getVisibleLeafColumns();
  const headers = visibleColumns
    .map((column) => column.columnDef.header as string)
    .filter((header) => header !== "Actions" && header !== "Select");

  const data = rows.map((row) => {
    const rowData: ExportableData = {};
    visibleColumns.forEach((column) => {
      const header = column.columnDef.header as string;
      if (header !== "Actions" && header !== "Select") {
        const cellValue = row.getValue(column.id);
        rowData[header] = cellValue ?? "";
      }
    });
    return rowData;
  });

  return { headers, data };
}

/**
 * Export table data to CSV.
 * Dynamically imports papaparse so it is not in the initial bundle.
 */
export async function exportToCSV<TData>(
  table: Table<TData>,
  filename: string = "export.csv",
  selectedOnly: boolean = false
) {
  const { headers, data } = collectExportRows(table, selectedOnly);
  if (data.length === 0) {
    console.warn("No data to export");
    return;
  }

  const { default: Papa } = await import("papaparse");
  const csv = Papa.unparse(data, { columns: headers });
  downloadFile(csv, filename, "text/csv");
}

/**
 * Export table data to Excel.
 * Dynamically imports xlsx so the ~800KB library is not in the initial bundle.
 */
export async function exportToExcel<TData>(
  table: Table<TData>,
  filename: string = "export.xlsx",
  selectedOnly: boolean = false
) {
  const { headers, data } = collectExportRows(table, selectedOnly);
  if (data.length === 0) {
    console.warn("No data to export");
    return;
  }

  const { utils, writeFile } = await import("xlsx");

  const worksheet = utils.json_to_sheet(data, { header: headers });
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, worksheet, "Data");

  worksheet["!cols"] = headers.map((header) => ({
    wch: Math.max(
      header.length,
      ...data.map((row) => String(row[header] ?? "").length)
    ),
  }));

  writeFile(workbook, filename);
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
