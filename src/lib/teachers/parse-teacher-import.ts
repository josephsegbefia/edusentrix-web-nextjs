import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";

export type TeacherImportRow = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  employeeId?: string;
  department?: string;
  status?: string;
  subjects?: string;
  subjectIds?: string;
  subjectOfferingIds?: string;
  homeroom?: string;
  homeroomGrade?: string;
  homeroomClass?: string;
  homeroomClassGroupId?: string;
};

type SpreadsheetRow = Record<string, unknown>;

export function parseTeacherImportFile(buffer: Buffer, fileName: string): TeacherImportRow[] {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  let rows: SpreadsheetRow[];

  if (ext === "csv" || ext === "txt") {
    rows = parse(buffer.toString("utf8"), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      cast: false,
      bom: true,
      relax_column_count: true,
    }) as SpreadsheetRow[];
  } else if (ext === "xlsx" || ext === "xls") {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return [];
    rows = XLSX.utils.sheet_to_json<SpreadsheetRow>(workbook.Sheets[sheetName], {
      defval: "",
      raw: false,
    });
  } else {
    throw new Error("Unsupported file type. Upload a CSV, XLS, or XLSX file.");
  }

  return rows.map((row) => {
    const normalized: Record<string, unknown> = {};
    const norm = (k: string) => k.toLowerCase().trim().replace(/\s+/g, "");
    for (const [key, value] of Object.entries(row)) {
      const n = norm(key);
      if (n === "firstname" || n === "first_name") normalized.firstName = value;
      else if (n === "lastname" || n === "last_name") normalized.lastName = value;
      else if (n === "email") normalized.email = value;
      else if (n === "phone") normalized.phone = value;
      else if (n === "employeeid" || n === "employee_id") normalized.employeeId = value;
      else if (n === "department") normalized.department = value;
      else if (n === "status") normalized.status = value;
      else if (n === "subjects" || n === "subject") normalized.subjects = value;
      else if (n === "subjectids" || n === "subject_ids") normalized.subjectIds = value;
      else if (n === "subjectofferingids" || n === "subject_offering_ids")
        normalized.subjectOfferingIds = value;
      else if (n === "homeroom" || n === "homeroomclassname" || n === "homeroom_class_name")
        normalized.homeroom = value;
      else if (n === "homeroomgrade" || n === "homeroom_grade") normalized.homeroomGrade = value;
      else if (n === "homeroomclass" || n === "homeroom_class") normalized.homeroomClass = value;
      else if (n === "homeroomclassgroupid" || n === "homeroom_class_group_id")
        normalized.homeroomClassGroupId = value;
      else normalized[key] = value;
    }
    return normalized as TeacherImportRow;
  });
}

export function isAcceptedTeacherImportFilename(fileName: string) {
  return /\.(csv|txt|xls|xlsx)$/i.test(fileName);
}
