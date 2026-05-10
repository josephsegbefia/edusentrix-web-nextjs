import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";
import type { ISchemeImportParsedRow } from "@/models/SchemeImportJob";

const MAX_ROWS = 500;

function normalizeHeaderCell(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[-/]+/g, "_")
    .replace(/\s+/g, "_");
}

type ImportHeaderKey =
  | "title"
  | "week"
  | "weekEnding"
  | "strand"
  | "subStrand"
  | "contentStandard"
  | "indicators"
  | "resources"
  | "objective"
  | "notes";

function mapHeaderKey(header: string): ImportHeaderKey | null {
  const n = normalizeHeaderCell(header);
  if (!n) return null;
  if (["title", "topic", "theme", "unit"].includes(n)) return "title";
  if (["week", "wk", "week_no", "week_number", "w"].includes(n)) return "week";
  if (["week_ending", "week_end", "ending", "date", "planned_end_date"].includes(n)) {
    return "weekEnding";
  }
  if (["strand"].includes(n)) return "strand";
  if (["sub_strand", "substrand", "sub_topic", "subtopic"].includes(n)) return "subStrand";
  if (
    ["content_standard", "standard", "content_standards", "content"].includes(n)
  ) {
    return "contentStandard";
  }
  if (["indicator", "indicators", "indicator_s"].includes(n)) return "indicators";
  if (["resource", "resources", "teaching_resources", "materials"].includes(n)) {
    return "resources";
  }
  if (
    ["learning_objective", "objective", "objectives", "lo", "learning_objectives"].includes(n)
  ) {
    return "objective";
  }
  if (["notes", "note", "remarks", "comments"].includes(n)) return "notes";
  if (n.includes("topic") || (n.includes("title") && !n.includes("subtitle"))) return "title";
  if (n.includes("week") && (n.includes("end") || n.includes("ending"))) return "weekEnding";
  if (n.includes("week")) return "week";
  if (n.includes("sub") && n.includes("strand")) return "subStrand";
  if (n.includes("strand")) return "strand";
  if (n.includes("content") && n.includes("standard")) return "contentStandard";
  if (n.includes("indicator")) return "indicators";
  if (n.includes("resource") || n.includes("material")) return "resources";
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

function splitList(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(/\n|;|,(?=\s*[A-Z]?\d|\s*[A-Za-z])/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function inferRowType(value: string): ISchemeImportParsedRow["rowType"] {
  const text = value.toLowerCase();
  if (text.includes("examination") || /\bexam\b/.test(text)) return "examination";
  if (text.includes("revision")) return "revision";
  if (text.includes("holiday") || text.includes("vacation")) return "holiday";
  return "teaching";
}

function extractMappedFields(rec: Record<string, unknown>): {
  title: string;
  weekNumber: number | null;
  weekEnding: string | null;
  strand: string | null;
  subStrand: string | null;
  contentStandard: string | null;
  indicators: string[];
  resources: string[];
  learningObjective: string | null;
  notes: string | null;
  rowType: ISchemeImportParsedRow["rowType"];
  rawText: string | null;
} {
  let title = "";
  let weekNumber: number | null = null;
  let weekEnding: string | null = null;
  let strand: string | null = null;
  let subStrand: string | null = null;
  let contentStandard: string | null = null;
  let indicatorsText: string | null = null;
  let resourcesText: string | null = null;
  let learningObjective: string | null = null;
  let notes: string | null = null;

  for (const key of Object.keys(rec)) {
    const role = mapHeaderKey(key);
    const val = rec[key];
    const str = val === null || val === undefined ? "" : String(val).trim();
    if (role === "title" && !title) title = str;
    else if (role === "week" && weekNumber === null) weekNumber = parseWeek(val);
    else if (role === "weekEnding" && weekEnding === null) weekEnding = str || null;
    else if (role === "strand" && strand === null) strand = str || null;
    else if (role === "subStrand" && subStrand === null) subStrand = str || null;
    else if (role === "contentStandard" && contentStandard === null)
      contentStandard = str || null;
    else if (role === "indicators" && indicatorsText === null) indicatorsText = str || null;
    else if (role === "resources" && resourcesText === null) resourcesText = str || null;
    else if (role === "objective" && learningObjective === null)
      learningObjective = str || null;
    else if (role === "notes" && notes === null) notes = str || null;
  }

  if (!title) title = subStrand || strand || contentStandard || indicatorsText || "";

  if (!title) {
    const vals = Object.values(rec);
    title = String(vals[0] ?? "").trim();
    if (vals.length > 1 && weekNumber === null) weekNumber = parseWeek(vals[1]);
    if (vals.length > 2 && learningObjective === null)
      learningObjective = String(vals[2] ?? "").trim() || null;
    if (vals.length > 3 && notes === null) notes = String(vals[3] ?? "").trim() || null;
  }

  const rawText = Object.values(rec)
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(" | ");
  return {
    title,
    weekNumber,
    weekEnding,
    strand,
    subStrand,
    contentStandard,
    indicators: splitList(indicatorsText),
    resources: splitList(resourcesText),
    learningObjective,
    notes,
    rowType: inferRowType(rawText || title),
    rawText: rawText || null,
  };
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
    const mapped = extractMappedFields(rec);
    const rowIndex = i + 2;
    const candidate = {
      rowIndex,
      ...mapped,
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
  const colMap: Partial<Record<ImportHeaderKey, number>> = {};

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
    const get = (key: ImportHeaderKey) =>
      colMap[key] !== undefined ? String(line[colMap[key]] ?? "").trim() : "";
    const strand = get("strand") || null;
    const subStrand = get("subStrand") || null;
    const contentStandard = get("contentStandard") || null;
    const indicatorsText = get("indicators") || null;
    const title =
      String(line[titleCol] ?? "").trim() ||
      subStrand ||
      strand ||
      contentStandard ||
      indicatorsText ||
      "";
    const weekNumber =
      colMap.week !== undefined ? parseWeek(line[colMap.week]) : null;
    const weekEnding = get("weekEnding") || null;
    const learningObjective =
      colMap.objective !== undefined
        ? String(line[colMap.objective] ?? "").trim() || null
        : null;
    const notes =
      colMap.notes !== undefined ? String(line[colMap.notes] ?? "").trim() || null : null;
    const resourcesText = get("resources") || null;
    const rawText = line.map((value) => String(value ?? "").trim()).filter(Boolean).join(" | ");

    const rowIndex = i + 2;
    const candidate = {
      rowIndex,
      weekNumber,
      weekEnding,
      title,
      strand,
      subStrand,
      contentStandard,
      indicators: splitList(indicatorsText),
      resources: splitList(resourcesText),
      learningObjective,
      notes,
      rowType: inferRowType(rawText || title),
      rawText: rawText || null,
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
