import Papa from "papaparse";
import { read, utils } from "xlsx";
import type { ImportResult, ImportError } from "@/types/data-table";

/**
 * Parse CSV file
 */
export async function parseCSV<TData>(
  file: File
): Promise<ImportResult<TData>> {
  return new Promise((resolve) => {
    Papa.parse<TData>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      complete: (results) => {
        const errors: ImportError[] = results.errors.map((error, index) => ({
          row: error.row ?? index,
          message: error.message,
        }));

        resolve({
          data: results.data,
          errors,
          success: errors.length === 0,
        });
      },
      error: (error) => {
        resolve({
          data: [],
          errors: [{ row: 0, message: error.message }],
          success: false,
        });
      },
    });
  });
}

/**
 * Parse Excel file
 */
export async function parseExcel<TData>(
  file: File
): Promise<ImportResult<TData>> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = read(arrayBuffer);

    // Get first sheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON
    const data = utils.sheet_to_json<TData>(worksheet, {
      header: 1,
      defval: "",
      blankrows: false,
    });

    // First row is headers
    const headers = data[0] as unknown as string[];
    const rows = data.slice(1) as unknown as unknown[][];

    // Transform to objects
    const transformedData = rows.map((row) => {
      const obj: Record<string, unknown> = {};
      headers.forEach((header, index) => {
        obj[header] = row[index];
      });
      return obj as TData;
    });

    return {
      data: transformedData,
      errors: [],
      success: true,
    };
  } catch (error) {
    return {
      data: [],
      errors: [
        {
          row: 0,
          message:
            error instanceof Error ? error.message : "Failed to parse Excel file",
        },
      ],
      success: false,
    };
  }
}

/**
 * Validate imported data
 */
export function validateImportData<TData>(
  data: TData[],
  requiredFields: (keyof TData)[]
): ImportResult<TData> {
  const errors: ImportError[] = [];

  data.forEach((row, index) => {
    requiredFields.forEach((field) => {
      if (!row[field]) {
        errors.push({
          row: index + 1,
          field: String(field),
          message: `Missing required field: ${String(field)}`,
        });
      }
    });
  });

  return {
    data,
    errors,
    success: errors.length === 0,
  };
}
