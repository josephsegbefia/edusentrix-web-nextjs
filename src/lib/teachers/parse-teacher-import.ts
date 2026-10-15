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
  "middleNames",
  "lastName",
  "fullName",
  "email",
  "phone",
  "employeeId",
  "department",
  "status",
  "subjects",
  "gradeScopes",
  "classScopes",
  "explicitAssignments",
  "subjectOfferingIds",
  "homeroomClass",
  "homeroomGrade",
  "homeroomClassGroupId",
] as const;

export type TeacherImportCanonicalField = (typeof TEACHER_IMPORT_CANONICAL_FIELDS)[number];

/** Fields that may cross the upload boundary into the identity setup workflow. */
export const TEACHER_IDENTITY_CANONICAL_FIELDS = [
  "firstName",
  "middleNames",
  "lastName",
  "fullName",
  "email",
  "phone",
] as const satisfies readonly TeacherImportCanonicalField[];

const TEACHER_IDENTITY_FIELD_SET = new Set<string>(TEACHER_IDENTITY_CANONICAL_FIELDS);

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
  mappingMode?: "deterministic" | "leo_first";
};

/** Identity-only rows used by the staged teacher setup workflow. */
export type TeacherIdentityImportRow = TeacherImportRow & {
  sourceFullName: string | null;
};

export type ParsedTeacherIdentityWorkbook = Omit<ParsedTeacherWorkbook, "rows"> & {
  rows: TeacherIdentityImportRow[];
};

type CellRow = unknown[];

const FIELD_ALIASES: Record<TeacherImportCanonicalField, string[]> = {
  firstName: ["first name", "first names", "firstname", "given name", "teacher first name", "staff first name"],
  middleNames: ["middle name", "middle names", "other name", "other names", "middle", "additional names"],
  lastName: ["last name", "lastname", "surname", "family name", "teacher last name", "staff last name"],
  fullName: ["full name", "teacher name", "staff name", "name", "teacher"],
  email: ["email", "email address", "staff email", "teacher email", "e mail", "staff mail"],
  phone: ["phone", "mobile", "telephone", "contact number", "phone number", "mobile number"],
  employeeId: ["employee id", "employeeid", "staff id", "teacher id", "staff number", "employee number"],
  department: ["department", "faculty", "division"],
  status: ["status", "employment status", "employment", "teacher status", "staff status"],
  subjects: ["subjects", "subject", "subjects taught", "courses", "courses handled", "course handled", "teaching subjects", "subject names"],
  gradeScopes: ["grades", "grades taught", "grade taught", "forms taught", "levels", "year groups", "teaching grades"],
  classScopes: ["classes", "classes taught", "streams", "sections", "teaching classes", "forms handled"],
  explicitAssignments: ["teaching assignments", "teaching assignment", "assignment", "assignments", "teaching load"],
  subjectOfferingIds: ["subject offering ids", "subject offering id", "offering ids"],
  homeroomClass: ["homeroom", "homeroom class", "homeroom class name", "class teacher of", "form class", "form master", "home class"],
  homeroomGrade: ["homeroom grade", "grade", "form", "class grade"],
  homeroomClassGroupId: ["homeroom class group id", "class group id", "homeroom id"],
};

const REPEATABLE_FIELDS = new Set<TeacherImportCanonicalField>([
  "subjects",
  "gradeScopes",
  "classScopes",
  "explicitAssignments",
]);

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
  if (/^(subject|course)([0-9]+|one|two|three|four|five)?$/.test(headerKey)) {
    return { sourceHeader: header, canonicalField: "subjects", source: "structural", confidence: 0.9, status: "resolved" };
  }
  if (/^(grade|form|level)([0-9]+|one|two|three|four|five)?$/.test(headerKey)) {
    return { sourceHeader: header, canonicalField: "gradeScopes", source: "structural", confidence: 0.88, status: "resolved" };
  }
  if (/^(class|stream|section)([0-9]+|one|two|three|four|five)?$/.test(headerKey)) {
    return { sourceHeader: header, canonicalField: "classScopes", source: "structural", confidence: 0.88, status: "resolved" };
  }
  if (/(math|mathematics|science|computing|english|french|subject|course).*class$/.test(headerKey)) {
    return { sourceHeader: header, canonicalField: "explicitAssignments", source: "structural", confidence: 0.75, status: "resolved" };
  }
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
  if (parts.length < 2) return { firstName: parts[0] || "", middleNames: [] as string[], lastName: "", confidence: 0.25 };
  return {
    firstName: parts[0],
    middleNames: parts.slice(1, -1),
    lastName: parts[parts.length - 1],
    confidence: parts.length === 2 ? 0.75 : 0.9,
  };
}

/** Keep middle-name tokens in firstName because the platform has no middle-name field. */
export function splitTeacherNameForCreation(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { firstName: parts[0] || "", lastName: "" };
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
}

function sourceNameForRow(row: TeacherImportRow) {
  return (row.fullName || [row.firstName, ...row.middleNames, row.lastName].filter(Boolean).join(" ")).trim();
}

function identityRow(row: TeacherImportRow): TeacherIdentityImportRow {
  const sourceFullName = sourceNameForRow(row);
  const fromSource = sourceFullName ? splitTeacherNameForCreation(sourceFullName) : null;
  const firstName = fromSource?.firstName || [row.firstName, ...row.middleNames].filter(Boolean).join(" ").trim();
  const lastName = fromSource?.lastName || row.lastName || "";
  return {
    ...row,
    sourceFullName: sourceFullName || null,
    firstName,
    lastName,
    fullName: sourceFullName || null,
    middleNames: [],
    employeeId: null,
    department: null,
    status: null,
    subjects: [],
    gradeScopes: [],
    classScopes: [],
    explicitAssignments: [],
    subjectOfferingIds: [],
    subjectIds: [],
    homeroomClass: null,
    homeroomGrade: null,
    homeroomClassGroupId: null,
    setupStatus: "pending",
    setupError: null,
    photoUrl: null,
    resolutionStatus: firstName && lastName ? "resolved" : "needs_review",
    rowState: "pending",
    issues: firstName && lastName ? [] : [{
      code: "missing_name",
      message: "Add a first and last name in the teacher setup step.",
      field: "name",
      value: sourceFullName || null,
    }],
  };
}

function identitySourceValues(row: TeacherImportRow, mappings: ITeacherImportColumnMapping[]) {
  const allowedHeaders = new Set(
    mappings
      .filter((mapping) => TEACHER_IDENTITY_FIELD_SET.has(mapping.canonicalField || ""))
      .map((mapping) => mapping.sourceHeader),
  );
  return Object.fromEntries(
    [...allowedHeaders].map((header) => [header, row.sourceValues[header] || ""]),
  );
}

export function parseTeacherIdentityImportWorkbook(
  buffer: Buffer,
  fileName: string,
  options: TeacherImportParseOptions = {}
): ParsedTeacherIdentityWorkbook {
  const parsed = parseTeacherImportWorkbook(buffer, fileName, options);
  return {
    ...parsed,
    rows: parsed.rows.map((row) => identityRow({
      ...row,
      sourceValues: identitySourceValues(row, parsed.columnMappings),
    })),
  };
}

function splitList(value: string) {
  return value.split(/[;,|\n]/).map((item) => item.trim()).filter(Boolean);
}

function structuralAssignmentSubject(header: string) {
  return header
    .replace(/[_-]+/g, " ")
    .replace(/\b(class|classes|stream|streams|section|sections|assigned|teaching|handled|taught|subject|course|assignment|assignments)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalRow(
  sheetRow: { rowNumber: number; values: Record<string, string> },
  mappings: ITeacherImportColumnMapping[]
): TeacherImportRow {
  const values: Record<string, string> = {};
  const repeatedValues: Record<string, string[]> = {};
  for (const mapping of mappings) {
    if (!mapping.canonicalField) continue;
    const rawValue = sheetRow.values[mapping.sourceHeader] || "";
    if (REPEATABLE_FIELDS.has(mapping.canonicalField as TeacherImportCanonicalField)) {
      repeatedValues[mapping.canonicalField] ||= [];
      if (rawValue) repeatedValues[mapping.canonicalField].push(rawValue);
    } else if (values[mapping.canonicalField] === undefined) values[mapping.canonicalField] = rawValue;
  }
  const fullName = values.fullName || "";
  const split = !values.firstName && !values.lastName && fullName ? splitFullName(fullName) : null;
  const firstNameParts = values.firstName ? splitFullName(values.firstName) : null;
  const splitRepeated = (field: string) => (repeatedValues[field] || []).flatMap(splitList);
  const subjects = repeatedValues.subjects ? splitRepeated("subjects") : splitList(values.subjects || "");
  const gradeScopes = repeatedValues.gradeScopes ? splitRepeated("gradeScopes") : splitList(values.gradeScopes || "");
  const classScopes = repeatedValues.classScopes ? splitRepeated("classScopes") : splitList(values.classScopes || "");
  const explicitAssignments = mappings
    .filter((mapping) => mapping.canonicalField === "explicitAssignments")
    .flatMap((mapping) => splitList(sheetRow.values[mapping.sourceHeader] || "").map((sourceValue) => {
      const subjectValue = structuralAssignmentSubject(mapping.sourceHeader);
      return {
        sourceValue,
        subjectValue,
        classValue: subjectValue ? sourceValue : null,
        source: mapping.source,
        status: "needs_review" as const,
        provenance: [{
          field: "explicitAssignments",
          sourceHeader: mapping.sourceHeader,
          sourceValue,
          source: mapping.source,
        }],
      };
    }));
  return {
    sourceRowNumber: sheetRow.rowNumber,
    rowRef: `T${String(sheetRow.rowNumber).padStart(3, "0")}`,
    sourceValues: sheetRow.values,
    firstName: firstNameParts?.firstName || values.firstName || split?.firstName || "",
    middleNames: [
      ...splitList(values.middleNames || ""),
      ...(firstNameParts?.middleNames || split?.middleNames || []),
    ],
    lastName: values.lastName || split?.lastName || "",
    fullName: fullName || null,
    email: (values.email || "").trim().toLowerCase(),
    phone: values.phone || null,
    employeeId: values.employeeId || null,
    department: values.department || null,
    status: values.status || null,
    subjects,
    gradeScopes,
    classScopes,
    explicitAssignments,
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
  supplied?: ITeacherImportColumnMapping[],
  mappingMode: TeacherImportParseOptions["mappingMode"] = "deterministic"
) {
  if (mappingMode === "leo_first" && !supplied?.length) {
    return sheet.headers.map((sourceHeader) => ({
      sourceHeader,
      canonicalField: null,
      source: "inferred" as const,
      confidence: 0,
      status: "needs_review" as const,
    }));
  }
  const defaults = sheet.headers.map(teacherImportMappingForHeader);
  if (!supplied?.length) return defaults;
  const suppliedByHeader = new Map(supplied.map((mapping) => [mapping.sourceHeader, mapping]));
  const usedFields = new Set<string>();
  return defaults.map((fallback) => {
    const selected = suppliedByHeader.get(fallback.sourceHeader);
    const selectedField = selected?.canonicalField as TeacherImportCanonicalField | null | undefined;
    if (!selected || (selectedField && !REPEATABLE_FIELDS.has(selectedField) && usedFields.has(selectedField))) {
      if (selected && selectedField && usedFields.has(selectedField)) {
        return {
          sourceHeader: fallback.sourceHeader,
          canonicalField: null,
          source: selected.source,
          confidence: 0,
          status: "needs_review" as const,
        };
      }
      if (selected?.canonicalField === null) {
        return {
          sourceHeader: fallback.sourceHeader,
          canonicalField: null,
          source: selected.source,
          confidence: selected.confidence,
          status: selected.status,
        };
      }
      if (fallback.canonicalField && !REPEATABLE_FIELDS.has(fallback.canonicalField as TeacherImportCanonicalField)) usedFields.add(fallback.canonicalField);
      return fallback;
    }
    if (selected.canonicalField && !REPEATABLE_FIELDS.has(selected.canonicalField as TeacherImportCanonicalField)) usedFields.add(selected.canonicalField);
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
  const mappings = mappingsForSheet(selected, options.columnMappings, options.mappingMode);
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
