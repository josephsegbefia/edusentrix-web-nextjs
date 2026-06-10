const ACCEPTED_EXTENSIONS = new Set(["csv", "txt", "xlsx", "xls"]);

export const STUDENT_IMPORT_ACCEPTED_FILE_TYPES =
  ".csv,.txt,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel";

export function isAcceptedStudentImportFilename(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return ACCEPTED_EXTENSIONS.has(ext);
}
