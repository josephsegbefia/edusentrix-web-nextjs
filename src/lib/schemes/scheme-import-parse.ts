import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";
import type { ISchemeImportParsedRow } from "@/models/SchemeImportJob";
import { mapSchemeImportHeaderKey, type SchemeImportHeaderKey } from "@/lib/schemes/scheme-import-columns";
import {
  buildSchemeImportRowFromFieldRecord,
  SCHEME_IMPORT_MAX_ROWS,
  schemeImportRowErrors,
} from "@/lib/schemes/scheme-import-row-build";

const MAX_ROWS = SCHEME_IMPORT_MAX_ROWS;

function extractMappedFields(rec: Record<string, unknown>): Omit<
  ISchemeImportParsedRow,
  "rowIndex" | "skipped" | "errors"
> {
  const built = buildSchemeImportRowFromFieldRecord(rec, 0);
  if (!built) {
    return {
      title: "",
      weekNumber: null,
      weekEnding: null,
      strand: null,
      subStrand: null,
      contentStandard: null,
      indicators: [],
      learningOutcomes: [],
      teachingLearningActivities: null,
      resources: [],
      assessment: [],
      learningObjective: null,
      notes: null,
      rowType: "teaching",
      rawText: null,
    };
  }
  const { rowIndex: _ri, skipped: _s, errors: _e, ...fields } = built;
  return fields;
}

function parseCsvBuffer(buffer: Buffer): ISchemeImportParsedRow[] {
  const text = buffer.toString("utf8");
  const records = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
    relax_column_count: true,
  }) as Record<string, unknown>[];

  const out: ISchemeImportParsedRow[] = [];
  for (let i = 0; i < records.length && out.length < MAX_ROWS; i++) {
    const mapped = extractMappedFields(records[i]);
    const rowIndex = i + 2;
    const candidate = {
      rowIndex,
      ...mapped,
      skipped: false,
      errors: [] as string[],
    };
    candidate.errors = schemeImportRowErrors(candidate);
    out.push(candidate);
  }
  return out;
}

function parseXlsxBuffer(buffer: Buffer): ISchemeImportParsedRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  const grid = XLSX.utils.sheet_to_json<(string | number | null | undefined)[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });
  if (!grid.length) return [];

  const headerRow = (grid[0] || []).map((c) => String(c ?? "").trim());
  const colMap: Partial<Record<SchemeImportHeaderKey, number>> = {};

  headerRow.forEach((h, idx) => {
    const key = mapSchemeImportHeaderKey(h);
    if (!key) return;
    if (colMap[key] === undefined) colMap[key] = idx;
  });

  if (colMap.title === undefined) {
    colMap.title = 0;
  }

  const dataRows = grid.slice(1);
  const out: ISchemeImportParsedRow[] = [];

  for (let i = 0; i < dataRows.length && out.length < MAX_ROWS; i++) {
    const line = dataRows[i] || [];
    const rec: Record<string, unknown> = {};
    headerRow.forEach((header, idx) => {
      if (header) rec[header] = line[idx] ?? "";
    });
    const mapped = extractMappedFields(rec);
    const rowIndex = i + 2;
    const candidate = {
      rowIndex,
      ...mapped,
      skipped: false,
      errors: [] as string[],
    };
    candidate.errors = schemeImportRowErrors(candidate);
    out.push(candidate);
  }

  return out;
}

export function parseSchemeSpreadsheet(buffer: Buffer, fileName: string): ISchemeImportParsedRow[] {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "csv" || ext === "txt") {
    return parseCsvBuffer(buffer);
  }
  if (ext === "xlsx" || ext === "xls") {
    return parseXlsxBuffer(buffer);
  }
  throw new Error(`Unsupported extension .${ext}`);
}
