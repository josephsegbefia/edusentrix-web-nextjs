import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { parseTeacherImportWorkbook } from "@/lib/teachers/parse-teacher-import";

test("teacher import parser accepts reasonable CSV aliases and preserves source rows", () => {
  const csv = [
    "Given Name,Family Name,Staff Mail,Mobile,Subjects Taught,Class Teacher Of",
    "Ama,Asante,ama.asante@example.com,0240000000,Creative Arts - Primary,JHS 1 A",
  ].join("\n");
  const result = parseTeacherImportWorkbook(Buffer.from(`\uFEFF${csv}`), "teachers.csv");
  assert.equal(result.selectedSheetName, "CSV");
  assert.deepEqual(
    result.rows[0] && {
      row: result.rows[0].sourceRowNumber,
      firstName: result.rows[0].firstName,
      lastName: result.rows[0].lastName,
      email: result.rows[0].email,
      phone: result.rows[0].phone,
      subjects: result.rows[0].subjects,
      homeroom: result.rows[0].homeroomClass,
    },
    {
      row: 2,
      firstName: "Ama",
      lastName: "Asante",
      email: "ama.asante@example.com",
      phone: "0240000000",
      subjects: ["Creative Arts - Primary"],
      homeroom: "JHS 1 A",
    }
  );
  assert.equal(result.columnMappings.find((mapping) => mapping.sourceHeader === "Staff Mail")?.canonicalField, "email");
});

test("teacher import parser derives a reviewable split from a full-name-only sheet", () => {
  const csv = "Teacher Name,Email Address\nPatricia Amankwah,patricia@example.com\n";
  const result = parseTeacherImportWorkbook(Buffer.from(csv), "teachers.csv");
  assert.equal(result.rows[0]?.firstName, "Patricia");
  assert.equal(result.rows[0]?.lastName, "Amankwah");
  assert.equal(result.rows[0]?.fullName, "Patricia Amankwah");
});

test("teacher import parser chooses the strongest visible XLSX worksheet", () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Notes"], ["Former staff list"]]), "Notes");
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ["First Name", "Last Name", "Email", "Subjects", "Homeroom Class"],
      ["Kojo", "Mensah", "kojo@example.com", "Mathematics - JHS", "JHS 2 A"],
    ]),
    "Teaching Staff"
  );
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  const result = parseTeacherImportWorkbook(buffer, "teachers.xlsx");
  assert.equal(result.selectedSheetName, "Teaching Staff");
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0]?.email, "kojo@example.com");
});

test("teacher import parser requires review when two worksheets are plausible", () => {
  const workbook = XLSX.utils.book_new();
  for (const sheetName of ["Primary 1", "Primary 4"]) {
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ["Staff Mail Address", "Courses Handled", "Form Master", "Full Name"],
        [`${sheetName.replace(" ", "").toLowerCase()}@example.com`, "Creative Arts - Primary", `${sheetName} A`, "Ama Mensah"],
      ]),
      sheetName
    );
  }
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  const initial = parseTeacherImportWorkbook(buffer, "teachers.xlsx");
  assert.equal(initial.sheetSelectionRequired, true);
  const selected = parseTeacherImportWorkbook(buffer, "teachers.xlsx", { selectedSheetName: "Primary 4" });
  assert.equal(selected.selectedSheetName, "Primary 4");
  assert.equal(selected.sheetSelectionRequired, false);
});
