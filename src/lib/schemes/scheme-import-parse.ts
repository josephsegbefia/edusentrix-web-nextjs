import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";
import type { ISchemeImportParsedRow } from "@/models/SchemeImportJob";

const MAX_ROWS = 500;

function normalizeHeaderCell(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function mapHeaderKey(header: string): "title" | "week" | "objective" | "notes" | null {
  const n = normalizeHeaderCell(header);
  if (!n) return null;
  if (["title", "topic", "theme", "unit", "strand"].includes(n)) return "title";
  if (["week", "wk", "week_no", "week_number", "w"].includes(n)) return "week";
  if (
    ["learning_objective", "objective", "objectives", "lo", "learning_objectives"].includes(n)
  ) {
    return "objective";
  }
  if (["notes", "note", "remarks", "comments", "resources"].includes(n)) return "notes";
  if (n.includes("topic") || (n.includes("title") && !n.includes("subtitle"))) return "title";
  if (n.includes("week")) return "week";
  if (n.includes("objective")) return "objective";
  if (n.includes("note") || n.includes("remark")) return "notes";
  return null;
}

function parseWeek(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number.parseInt(String(value).trim(), 10);
  if (Number.isNaN(n)) return null;
  return n;
}

function rowErrors(row: { title: string; weekNumber: number | null }): string[] {
  const errors: string[] = [];
  const t = row.title.trim();
  if (t.length < 2) errors.push("Title must be at least 2 characters");
  if (row.weekNumber != null && (row.weekNumber < 1 || row.weekNumber > 53)) {
    errors.push("Week must be between 1 and 53");
  }
  return errors;
}

function extractMappedFields(rec: Record<string, unknown>): {
  title: string;
  weekNumber: number | null;
  learningObjective: string | null;
  notes: string | null;
} {
  let title = "";
  let weekNumber: number | null = null;
  let learningObjective: string | null = null;
  let notes: string | null = null;

  for (const key of Object.keys(rec)) {
    const role = mapHeaderKey(key);
    const val = rec[key];
    const str = val === null || val === undefined ? "" : String(val).trim();
    if (role === "title" && !title) title = str;
    else if (role === "week" && weekNumber === null) weekNumber = parseWeek(val);
    else if (role === "objective" && learningObjective === null)
      learningObjective = str || null;
    else if (role === "notes" && notes === null) notes = str || null;
  }

  if (!title) {
    const vals = Object.values(rec);
    title = String(vals[0] ?? "").trim();
    if (vals.length > 1 && weekNumber === null) weekNumber = parseWeek(vals[1]);
    if (vals.length > 2 && learningObjective === null)
      learningObjective = String(vals[2] ?? "").trim() || null;
    if (vals.length > 3 && notes === null) notes = String(vals[3] ?? "").trim() || null;
  }

  return { title, weekNumber, learningObjective, notes };
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
    const rec = records[i];
    const { title, weekNumber, learningObjective, notes } = extractMappedFields(rec);
    const rowIndex = i + 2;
    const candidate = {
      rowIndex,
      weekNumber,
      title,
      learningObjective,
      notes,
      skipped: false,
      errors: [] as string[],
    };
    candidate.errors = rowErrors(candidate);
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

  const headerRow = (grid[0] || []).map((c) => normalizeHeaderCell(c));
  const colMap: Partial<Record<"title" | "week" | "objective" | "notes", number>> = {};

  headerRow.forEach((h, idx) => {
    const key = mapHeaderKey(h);
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
    const titleCol = colMap.title ?? 0;
    const title = String(line[titleCol] ?? "").trim();
    const weekNumber =
      colMap.week !== undefined ? parseWeek(line[colMap.week]) : null;
    const learningObjective =
      colMap.objective !== undefined
        ? String(line[colMap.objective] ?? "").trim() || null
        : null;
    const notes =
      colMap.notes !== undefined ? String(line[colMap.notes] ?? "").trim() || null : null;

    const rowIndex = i + 2;
    const candidate = {
      rowIndex,
      weekNumber,
      title,
      learningObjective,
      notes,
      skipped: false,
      errors: [] as string[],
    };
    candidate.errors = rowErrors(candidate);
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
