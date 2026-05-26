import "server-only";

import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";
import { isPdfSource } from "@/lib/schemes/scheme-import-pdf-utils";
import { resolvePdfTableGrids } from "@/lib/schemes/scheme-import-pdf-grids";
import { detectSchemeImportColumnMapFromGrids } from "@/lib/schemes/scheme-import-pdf-table-map";
import {
  buildSchemeImportColumnMapFromHeaderLabels,
  evaluateSchemeImportColumnMap,
  formatSchemeImportColumnValidationError,
  formatSchemeImportNoTableError,
} from "@/lib/schemes/scheme-import-required-columns";

export const SCHEME_IMPORT_MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export type SchemeImportFileValidationResult =
  | { ok: true }
  | { ok: false; error: string; missingColumns?: string[] };

function spreadsheetExtension(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

function detectColumnMapFromSpreadsheetBuffer(buffer: Buffer, fileName: string) {
  const ext = spreadsheetExtension(fileName);

  if (ext === "csv" || ext === "txt") {
    const text = buffer.toString("utf8");
    const records = parse(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
      relax_column_count: true,
      to_line: 2,
    }) as Record<string, unknown>[];

    if (!records.length) return null;
    return buildSchemeImportColumnMapFromHeaderLabels(Object.keys(records[0] ?? {}));
  }

  if (ext === "xlsx" || ext === "xls") {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return null;
    const sheet = workbook.Sheets[sheetName];
    const grid = XLSX.utils.sheet_to_json<(string | number | null | undefined)[]>(sheet, {
      header: 1,
      defval: "",
      raw: false,
    });
    if (!grid.length) return null;
    const stringGrid = grid.map((row) => row.map((c) => String(c ?? "").trim()));
    return detectSchemeImportColumnMapFromGrids([stringGrid]);
  }

  return null;
}

async function validatePdfSchemeImportBuffer(
  buffer: Buffer,
): Promise<SchemeImportFileValidationResult> {
  const gridsResult = await resolvePdfTableGrids(buffer);
  if (!gridsResult.ok) {
    return { ok: false, error: formatSchemeImportNoTableError("pdf") };
  }

  const colMap = detectSchemeImportColumnMapFromGrids(gridsResult.grids);
  if (!colMap) {
    return { ok: false, error: formatSchemeImportNoTableError("pdf") };
  }

  const check = evaluateSchemeImportColumnMap(colMap);
  if (!check.ok) {
    return {
      ok: false,
      error: formatSchemeImportColumnValidationError(check.missing),
      missingColumns: check.missing,
    };
  }

  return { ok: true };
}

function validateSpreadsheetSchemeImportBuffer(
  buffer: Buffer,
  fileName: string,
): SchemeImportFileValidationResult {
  const ext = spreadsheetExtension(fileName);
  if (!["csv", "txt", "xlsx", "xls"].includes(ext)) {
    return {
      ok: false,
      error: "Unsupported file type. Upload a .pdf, .csv, or .xlsx Scheme of Learning file.",
    };
  }

  const colMap = detectColumnMapFromSpreadsheetBuffer(buffer, fileName);
  if (!colMap || Object.keys(colMap).length < 2) {
    return { ok: false, error: formatSchemeImportNoTableError("spreadsheet") };
  }

  const check = evaluateSchemeImportColumnMap(colMap);
  if (!check.ok) {
    return {
      ok: false,
      error: formatSchemeImportColumnValidationError(check.missing),
      missingColumns: check.missing,
    };
  }

  return { ok: true };
}

export async function validateSchemeImportFileBuffer(
  buffer: Buffer,
  fileName: string,
  mimeType?: string | null,
): Promise<SchemeImportFileValidationResult> {
  if (!buffer.length) {
    return { ok: false, error: "The file is empty." };
  }
  if (buffer.length > SCHEME_IMPORT_MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      error: `File is too large. Maximum size is ${Math.round(SCHEME_IMPORT_MAX_UPLOAD_BYTES / (1024 * 1024))} MB.`,
    };
  }

  if (isPdfSource(fileName, mimeType ?? undefined)) {
    return validatePdfSchemeImportBuffer(buffer);
  }

  return validateSpreadsheetSchemeImportBuffer(buffer, fileName);
}
