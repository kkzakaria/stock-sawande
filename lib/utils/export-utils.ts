import { type Table } from "@tanstack/react-table";
import { utils, writeFile } from "xlsx";
import Papa from "papaparse";

/**
 * Export table data to CSV
 */
export function exportToCSV<TData>(
  table: Table<TData>,
  filename: string = "export.csv",
  selectedOnly: boolean = false
) {
  const rows = selectedOnly
    ? table.getSelectedRowModel().rows
    : table.getFilteredRowModel().rows;

  if (rows.length === 0) {
    console.warn("No data to export");
    return;
  }

  // Get visible columns
  const visibleColumns = table.getVisibleLeafColumns();

  // Create headers
  const headers = visibleColumns
    .map((column) => column.columnDef.header as string)
    .filter((header) => header !== "Actions" && header !== "Select");

  // Create data rows
  const data = rows.map((row) => {
    const rowData: Record<string, unknown> = {};
    visibleColumns.forEach((column) => {
      const header = column.columnDef.header as string;
      if (header !== "Actions" && header !== "Select") {
        const cellValue = row.getValue(column.id);
        rowData[header] = cellValue ?? "";
      }
    });
    return rowData;
  });

  // Convert to CSV
  const csv = Papa.unparse(data, {
    columns: headers,
  });

  // Download
  downloadFile(csv, filename, "text/csv");
}

/**
 * Export table data to Excel
 */
export function exportToExcel<TData>(
  table: Table<TData>,
  filename: string = "export.xlsx",
  selectedOnly: boolean = false
) {
  const rows = selectedOnly
    ? table.getSelectedRowModel().rows
    : table.getFilteredRowModel().rows;

  if (rows.length === 0) {
    console.warn("No data to export");
    return;
  }

  // Get visible columns
  const visibleColumns = table.getVisibleLeafColumns();

  // Create headers
  const headers = visibleColumns
    .map((column) => column.columnDef.header as string)
    .filter((header) => header !== "Actions" && header !== "Select");

  // Create data rows
  const data = rows.map((row) => {
    const rowData: Record<string, unknown> = {};
    visibleColumns.forEach((column) => {
      const header = column.columnDef.header as string;
      if (header !== "Actions" && header !== "Select") {
        const cellValue = row.getValue(column.id);
        rowData[header] = cellValue ?? "";
      }
    });
    return rowData;
  });

  // Create worksheet
  const worksheet = utils.json_to_sheet(data, { header: headers });

  // Create workbook
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, worksheet, "Data");

  // Auto-size columns
  const colWidths = headers.map((header) => ({
    wch: Math.max(
      header.length,
      ...data.map((row) => String(row[header] || "").length)
    ),
  }));
  worksheet["!cols"] = colWidths;

  // Download
  writeFile(workbook, filename);
}

/**
 * Download a file
 */
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
