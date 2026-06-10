import * as XLSX from "xlsx";

export { isAcceptedStudentImportFilename } from "@/lib/students/student-import-file-types";

export type StudentImportRow = {
  firstName: string;
  middleName?: string;
  lastName: string;
  gradeName: string;
  className: string;
  admissionNo?: string;
  sex?: string;
  dateOfBirth?: string;
  status?: string;
  enrolledAt?: string;
};

export const STUDENT_IMPORT_MAX_ROWS = 500;

function normalizeHeaderKey(header: string): string {
  return header
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/firstname|givenname/g, "firstname")
    .replace(/middlename|othername/g, "middlename")
    .replace(/lastname|surname|familyname/g, "lastname")
    .replace(/gradename|gradelevel|form|yeargroup|grade/g, "gradename")
    .replace(/classname|classgroup|stream|section|class$/g, "classname")
    .replace(/admissionno|admissionnumber|admno/g, "admissionno")
    .replace(/dateofbirth|dob/g, "dateofbirth")
    .replace(/enrolledat|enrollmentdate|enrolldate/g, "enrolledat")
    .replace(/gender/g, "sex");
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function mapRowValues(headers: string[], values: string[]): StudentImportRow {
  const headerMap: Record<string, number> = {};
  headers.forEach((h, i) => {
    headerMap[normalizeHeaderKey(h)] = i;
  });

  const get = (key: string) => {
    const idx = headerMap[key];
    if (idx === undefined) return undefined;
    const val = values[idx]?.trim();
    return val || undefined;
  };

  return {
    firstName: get("firstname") || "",
    middleName: get("middlename"),
    lastName: get("lastname") || "",
    gradeName: get("gradename") || "",
    className: get("classname") || "",
    admissionNo: get("admissionno"),
    sex: get("sex"),
    dateOfBirth: get("dateofbirth"),
    status: get("status"),
    enrolledAt: get("enrolledat"),
  };
}

export function parseStudentImportCsvText(text: string): StudentImportRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  const rows: StudentImportRow[] = [];

  for (let i = 1; i < lines.length && rows.length < STUDENT_IMPORT_MAX_ROWS; i++) {
    rows.push(mapRowValues(headers, parseCsvLine(lines[i])));
  }

  return rows;
}

function parseDelimitedText(text: string, delimiter: "\t" | ","): StudentImportRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const splitLine = (line: string) =>
    delimiter === "\t"
      ? line.split("\t").map((part) => part.trim())
      : parseCsvLine(line);

  const headers = splitLine(lines[0]);
  const rows: StudentImportRow[] = [];

  for (let i = 1; i < lines.length && rows.length < STUDENT_IMPORT_MAX_ROWS; i++) {
    rows.push(mapRowValues(headers, splitLine(lines[i])));
  }

  return rows;
}

export function parseStudentImportXlsxBuffer(buffer: Buffer): StudentImportRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const sheet = workbook.Sheets[sheetName];
  const grid = XLSX.utils.sheet_to_json<(string | number | null | undefined)[]>(
    sheet,
    {
      header: 1,
      defval: "",
      raw: false,
    }
  );

  if (grid.length < 2) return [];

  const headers = (grid[0] || []).map((cell) => String(cell ?? "").trim());
  const rows: StudentImportRow[] = [];

  for (let i = 1; i < grid.length && rows.length < STUDENT_IMPORT_MAX_ROWS; i++) {
    const values = (grid[i] || []).map((cell) => String(cell ?? "").trim());
    rows.push(mapRowValues(headers, values));
  }

  return rows;
}

export function parseStudentImportFile(
  buffer: Buffer,
  filename: string
): StudentImportRow[] {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";

  if (ext === "xlsx" || ext === "xls") {
    return parseStudentImportXlsxBuffer(buffer);
  }

  const text = buffer.toString("utf8");
  if (ext === "txt" && text.includes("\t")) {
    return parseDelimitedText(text, "\t");
  }

  return parseStudentImportCsvText(text);
}

export function parseStudentImportDate(value: string | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) {
    const parts = value.split(/[/\-.]/).map(Number);
    if (parts.length === 3) {
      const [a, b, c] = parts;
      if (a > 31) return new Date(a, b - 1, c);
      if (c > 31) return new Date(c, a - 1, b);
      return new Date(c + 2000, a - 1, b);
    }
    return null;
  }
  return d;
}
