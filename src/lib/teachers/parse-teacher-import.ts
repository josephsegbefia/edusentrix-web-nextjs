import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";
import type {
  ITeacherImportColumnMapping,
  ITeacherImportParsedRow,
  TeacherImportMappingSource,
  TeacherImportResolutionStatus,
} from "@/models/TeacherImportJob";

export const TEACHER_IMPORT_MAX_ROWS = 1000;

export const TEACHER_IMPORT_CANONICAL_FIELDS = [
  "firstName",
  "lastName",
  "fullName",
  "email",
  "phone",
  "employeeId",
  "department",
  "status",
  "subjects",
  "subjectOfferingIds",
  "homeroomClass",
  "homeroomGrade",
  "homeroomClassGroupId",
] as const;

export type TeacherImportCanonicalField = (typeof TEACHER_IMPORT_CANONICAL_FIELDS)[number];

export type TeacherImportRow = ITeacherImportParsedRow & {
  homeroom?: string | null;
};

export type TeacherImportSheet = {
  name: string;
  headers: string[];
  rows: Array<{ rowNumber: number; values: Record<string, string> }>;
  score: number;
  signals: string[];
};

export type ParsedTeacherWorkbook = {
  sheets: TeacherImportSheet[];
  selectedSheetName: string | null;
  sheetSelectionRequired: boolean;
  columnMappings: ITeacherImportColumnMapping[];
  rows: TeacherImportRow[];
};

export type TeacherImportParseOptions = {
  selectedSheetName?: string | null;
  columnMappings?: ITeacherImportColumnMapping[];
};

type CellRow = unknown[];

const FIELD_ALIASES: Record<TeacherImportCanonicalField, string[]> = {
  firstName: ["first name", "firstname", "given name", "teacher first name", "staff first name"],
  lastName: ["last name", "lastname", "surname", "family name", "teacher last name", "staff last name"],
  fullName: ["full name", "teacher name", "staff name", "name", "teacher"],
  email: ["email", "email address", "staff email", "teacher email", "e mail", "staff mail"],
  phone: ["phone", "mobile", "telephone", "contact number", "phone number", "mobile number"],
  employeeId: ["employee id", "employeeid", "staff id", "teacher id", "staff number", "employee number"],
  department: ["department", "faculty", "division"],
  status: ["status", "employment status", "employment", "teacher status", "staff status"],
  subjects: ["subjects", "subject", "subjects taught", "courses", "teaching subjects", "subject names"],
  subjectOfferingIds: ["subject offering ids", "subject offering id", "offering ids"],
  homeroomClass: ["homeroom", "homeroom class", "homeroom class name", "class teacher of", "form class", "class"],
  homeroomGrade: ["homeroom grade", "grade", "form", "class grade"],
  homeroomClassGroupId: ["homeroom class group id", "class group id", "homeroom id"],
};

function normalizedKey(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "");
}

function displayValue(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/^\uFEFF/, "").trim();
}

function emptyRow(values: unknown[]) {
  return values.every((value) => !displayValue(value));
}

function sheetScore(headers: string[], rows: Array<{ rowNumber: number; values: Record<string, string> }>) {
  const normalizedHeaders = headers.map(normalizedKey);
  const recognized = normalizedHeaders.filter((header) =>
    Object.values(FIELD_ALIASES).some((aliases) => aliases.some((alias) => normalizedKey(alias) === header))
  ).length;
  const emailValues = rows.filter((row) =>
    Object.values(row.values).some((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()))
  ).length;
  const nameValues = rows.filter((row) =>
    Object.values(row.values).some((value) => value.trim().split(/\s+/).length >= 2)
  ).length;
  const headerText = headers.join(" ").toLowerCase();
  const teacherSignal = /teacher|staff|employee|subject|homeroom|class/.test(headerText) ? 4 : 0;
  const score = recognized * 12 + Math.min(rows.length, 40) + Math.min(emailValues, 20) * 3 + Math.min(nameValues, 20) + teacherSignal;
  const signals = [
    recognized ? `${recognized} recognizable teacher columns` : "no recognizable teacher columns",
    emailValues ? `${emailValues} rows with email-like values` : "no email-like values",
    rows.length ? `${rows.length} data rows` : "no data rows",
  ];
  return { score, signals };
}

function parseCsvSheets(buffer: Buffer): TeacherImportSheet[] {
  const records = parse(buffer.toString("utf8"), {
    bom: true,
    skip_empty_lines: false,
    relax_column_count: true,
    trim: false,
    cast: false,
  }) as CellRow[];
  const nonEmptyHeaderIndex = records.findIndex((row) => !emptyRow(row));
  if (nonEmptyHeaderIndex < 0) return [];
  const headers = records[nonEmptyHeaderIndex].map(displayValue).map((header, index) => header || `Column ${index + 1}`);
  const rows = records
    .slice(nonEmptyHeaderIndex + 1)
    .map((values, offset) => ({
      rowNumber: nonEmptyHeaderIndex + offset + 2,
      values: Object.fromEntries(headers.map((header, index) => [header, displayValue(values[index])])),
      raw: values,
    }))
    .filter((row) => !emptyRow(row.raw))
    .map(({ rowNumber, values }) => ({ rowNumber, values }));
  return [{ name: "CSV", headers, rows, ...sheetScore(headers, rows) }];
}

function parseWorkbookSheets(buffer: Buffer): TeacherImportSheet[] {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false, raw: false });
  return workbook.SheetNames.map((name) => {
    const matrix = XLSX.utils.sheet_to_json<CellRow>(workbook.Sheets[name], {
      header: 1,
      defval: "",
      raw: false,
      blankrows: false,
    });
    const headerIndex = matrix.findIndex((row) => !emptyRow(row));
    if (headerIndex < 0) return { name, headers: [], rows: [], score: 0, signals: ["no data rows"] };
    const headers = matrix[headerIndex].map(displayValue).map((header, index) => header || `Column ${index + 1}`);
    const rows = matrix
      .slice(headerIndex + 1)
      .map((values, offset) => ({
        rowNumber: headerIndex + offset + 2,
        values: Object.fromEntries(headers.map((header, index) => [header, displayValue(values[index])])),
        raw: values,
      }))
      .filter((row) => !emptyRow(row.raw))
      .map(({ rowNumber, values }) => ({ rowNumber, values }));
    return { name, headers, rows, ...sheetScore(headers, rows) };
  });
}

export function teacherImportMappingForHeader(header: string): ITeacherImportColumnMapping {
  const headerKey = normalizedKey(header);
  for (const field of TEACHER_IMPORT_CANONICAL_FIELDS) {
    if (headerKey === normalizedKey(field)) {
      return { sourceHeader: header, canonicalField: field, source: "exact", confidence: 1, status: "resolved" };
    }
  }
  for (const field of TEACHER_IMPORT_CANONICAL_FIELDS) {
    if (FIELD_ALIASES[field].some((alias) => normalizedKey(alias) === headerKey)) {
      return { sourceHeader: header, canonicalField: field, source: "alias", confidence: 0.95, status: "resolved" };
    }
  }
  return { sourceHeader: header, canonicalField: null, source: "inferred", confidence: 0, status: "needs_review" };
}

function splitFullName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { firstName: parts[0] || "", lastName: "", confidence: 0.25 };
  return { firstName: parts[0], lastName: parts.slice(1).join(" "), confidence: parts.length === 2 ? 0.75 : 0.6 };
}

function splitList(value: string) {
  return value.split(/[;,|\n]/).map((item) => item.trim()).filter(Boolean);
}

function canonicalRow(
  sheetRow: { rowNumber: number; values: Record<string, string> },
  mappings: ITeacherImportColumnMapping[]
): TeacherImportRow {
  const values: Record<string, string> = {};
  for (const mapping of mappings) {
    if (mapping.canonicalField && values[mapping.canonicalField] === undefined) {
      values[mapping.canonicalField] = sheetRow.values[mapping.sourceHeader] || "";
    }
  }
  const fullName = values.fullName || "";
  const split = !values.firstName && !values.lastName && fullName ? splitFullName(fullName) : null;
  return {
    sourceRowNumber: sheetRow.rowNumber,
    sourceValues: sheetRow.values,
    firstName: values.firstName || split?.firstName || "",
    lastName: values.lastName || split?.lastName || "",
    fullName: fullName || null,
    email: (values.email || "").trim().toLowerCase(),
    phone: values.phone || null,
    employeeId: values.employeeId || null,
    department: values.department || null,
    status: values.status || null,
    subjects: splitList(values.subjects || ""),
    subjectOfferingIds: splitList(values.subjectOfferingIds || ""),
    subjectIds: [],
    homeroomClass: values.homeroomClass || null,
    homeroomGrade: values.homeroomGrade || null,
    homeroomClassGroupId: values.homeroomClassGroupId || null,
    homeroom: values.homeroomClass || null,
    resolutionStatus: "resolved" as TeacherImportResolutionStatus,
    rowState: "pending",
    issues: [],
  };
}

function sheetSelectionIsAmbiguous(sheets: TeacherImportSheet[]) {
  const ranked = [...sheets].sort((a, b) => b.score - a.score);
  const [first, second] = ranked;
  if (!first || !second || first.rows.length === 0 || second.rows.length === 0) return false;
  // Scores are intentionally coarse. A second sheet within two recognized
  // columns or 20% of the leading score is a real candidate, not a fallback.
  return second.score >= Math.max(first.score - 24, Math.ceil(first.score * 0.8));
}

function mappingsForSheet(
  sheet: TeacherImportSheet,
  supplied?: ITeacherImportColumnMapping[]
) {
  const defaults = sheet.headers.map(teacherImportMappingForHeader);
  if (!supplied?.length) return defaults;
  const suppliedByHeader = new Map(supplied.map((mapping) => [mapping.sourceHeader, mapping]));
  const usedFields = new Set<string>();
  return defaults.map((fallback) => {
    const selected = suppliedByHeader.get(fallback.sourceHeader);
    if (!selected || usedFields.has(selected.canonicalField || "")) {
      if (selected?.canonicalField === null) {
        return {
          sourceHeader: fallback.sourceHeader,
          canonicalField: null,
          source: selected.source,
          confidence: selected.confidence,
          status: selected.status,
        };
      }
      if (fallback.canonicalField) usedFields.add(fallback.canonicalField);
      return fallback;
    }
    usedFields.add(selected.canonicalField);
    return {
      sourceHeader: fallback.sourceHeader,
      canonicalField: selected.canonicalField,
      source: selected.source,
      confidence: selected.confidence,
      status: selected.status,
    };
  });
}

export function parseTeacherImportWorkbook(
  buffer: Buffer,
  fileName: string,
  options: TeacherImportParseOptions = {}
): ParsedTeacherWorkbook {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (!["csv", "txt", "xls", "xlsx"].includes(extension)) {
    throw new Error("Unsupported file type. Upload a CSV, XLS, or XLSX file.");
  }
  const sheets = extension === "csv" || extension === "txt" ? parseCsvSheets(buffer) : parseWorkbookSheets(buffer);
  if (sheets.length === 0 || sheets.every((sheet) => sheet.rows.length === 0)) {
    throw new Error("Import file contains no data rows");
  }
  if (Math.max(...sheets.map((sheet) => sheet.rows.length)) > TEACHER_IMPORT_MAX_ROWS) {
    throw new Error(`Teacher imports are limited to ${TEACHER_IMPORT_MAX_ROWS} rows.`);
  }
  const ranked = [...sheets].sort((a, b) => b.score - a.score);
  const selected = options.selectedSheetName
    ? sheets.find((sheet) => sheet.name === options.selectedSheetName)
    : ranked[0];
  if (!selected) throw new Error("Selected worksheet is not available in this import file.");
  const mappings = mappingsForSheet(selected, options.columnMappings);
  const rows = selected.rows.map((row) => canonicalRow(row, mappings));
  return {
    sheets,
    selectedSheetName: selected.name,
    sheetSelectionRequired: !options.selectedSheetName && sheetSelectionIsAmbiguous(sheets),
    columnMappings: mappings,
    rows,
  };
}

/** Backward-compatible deterministic parser used by legacy callers. */
export function parseTeacherImportFile(buffer: Buffer, fileName: string): TeacherImportRow[] {
  return parseTeacherImportWorkbook(buffer, fileName).rows;
}

export function isAcceptedTeacherImportFilename(fileName: string) {
  return /\.(csv|txt|xls|xlsx)$/i.test(fileName);
}

export function teacherImportFieldAliases(field: TeacherImportCanonicalField) {
  return [...FIELD_ALIASES[field]];
}

export function teacherImportMappingSourceForAdmin(): TeacherImportMappingSource {
  return "admin";
}
