import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { parseStudentImportDate, parseStudentImportWorkbook, STUDENT_IMPORT_MAX_ROWS } from "@/lib/students/student-import-parse";

test("student parser keeps only identity and placement data and folds middle names into first name", () => {
  const csv = "\uFEFFStudent Name,Adm No,Gender,Grade,Class Group,GES Index Number,Notes\nAma Mary Mensah, ADM-1, F, Basic 1, A, GES-9, ignore";
  const result = parseStudentImportWorkbook(Buffer.from(csv), "students.csv");
  assert.equal(result.rows[0]?.sourceRowNumber, 2);
  assert.equal(result.rows[0]?.firstName, "Ama Mary");
  assert.equal(result.rows[0]?.middleName, null);
  assert.equal(result.rows[0]?.lastName, "Mensah");
  assert.equal(result.rows[0]?.admissionNo, null);
  assert.equal(result.rows[0]?.rawSex, null);
  assert.equal(result.rows[0]?.gesIndexNumber, null);
  assert.deepEqual(result.rows[0]?.sourceValues, { "Student Name": "Ama Mary Mensah", Grade: "Basic 1", "Class Group": "A" });
  assert.deepEqual(result.unusedColumns, ["Adm No", "Gender", "GES Index Number", "Notes"]);
});

test("student parser scores all worksheets and keeps the selected sheet reviewable", () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Notes"], ["not a roster"]]), "Notes");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["First Name", "Last Name", "Grade", "Class"], ["Kofi", "Mensah", "JHS 1", "A"]]), "Roster");
  const result = parseStudentImportWorkbook(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }), "students.xlsx");
  assert.equal(result.selectedSheetName, "Roster");
  assert.equal(result.sheets.length, 2);
  assert.equal(result.rows[0]?.sourceSheetName, "Roster");
  assert.equal(result.rows[0]?.sourceRowNumber, 2);
});

test("student parser flags competing roster worksheets for administrator selection", () => {
  const workbook = XLSX.utils.book_new();
  for (const name of ["Class A", "Class B"]) {
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([["First Name", "Last Name", "Grade", "Class"], ["Kofi", "Mensah", "Primary 1", name]]),
      name
    );
  }
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  const result = parseStudentImportWorkbook(buffer, "students.xlsx");
  assert.equal(result.sheetSelectionRequired, true);
  assert.equal(parseStudentImportWorkbook(buffer, "students.xlsx", "Class B").selectedSheetName, "Class B");
});

test("student parser rejects a worksheet over the hard row limit", () => {
  const rows = [["First Name", "Last Name"]];
  for (let i = 0; i < STUDENT_IMPORT_MAX_ROWS + 1; i += 1) rows.push([`First${i}`, `Last${i}`]);
  assert.throws(() => parseStudentImportWorkbook(Buffer.from(rows.map((row) => row.join(",")).join("\n")), "students.csv"), /more than 500/);
});

test("student dates require an explicit choice for ambiguous slash values", () => {
  assert.equal(parseStudentImportDate("03/04/2017", "auto"), null);
  assert.equal(parseStudentImportDate("03/04/2017", "dmy")?.toISOString().slice(0, 10), "2017-04-03");
  assert.equal(parseStudentImportDate("03/04/2017", "mdy")?.toISOString().slice(0, 10), "2017-03-04");
  assert.equal(parseStudentImportDate("2017-02-30"), null);
});

test("student dates accept named dates and two-digit years", () => {
  assert.equal(parseStudentImportDate("1st August 2010")?.toISOString().slice(0, 10), "2010-08-01");
  assert.equal(parseStudentImportDate("1st Aug 10")?.toISOString().slice(0, 10), "2010-08-01");
  assert.equal(parseStudentImportDate("01-08-2010", "dmy")?.toISOString().slice(0, 10), "2010-08-01");
  assert.equal(parseStudentImportDate("01-08-2010", "mdy")?.toISOString().slice(0, 10), "2010-01-08");
});
