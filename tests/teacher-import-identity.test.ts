import assert from "node:assert/strict";
import test from "node:test";
import { parseTeacherIdentityImportWorkbook, splitTeacherNameForCreation } from "@/lib/teachers/parse-teacher-import";
import { TEACHER_IMPORT_TEMPLATE_CSV } from "@/lib/teachers/teacher-import-template";

test("teacher identity names retain middle-name tokens in firstName", () => {
  assert.deepEqual(splitTeacherNameForCreation("Joseph Morgan Stanley"), {
    firstName: "Joseph Morgan",
    lastName: "Stanley",
  });
});

test("identity import stages only the upload identity fields", () => {
  const parsed = parseTeacherIdentityImportWorkbook(
    Buffer.from("Teacher Name,Phone,Email,Employee ID,Notes\nJoseph Morgan Stanley,0240000000,JOSEPH@EXAMPLE.COM,EMP001,Ignore this\n"),
    "teachers.csv"
  );
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].sourceFullName, "Joseph Morgan Stanley");
  assert.equal(parsed.rows[0].firstName, "Joseph Morgan");
  assert.equal(parsed.rows[0].lastName, "Stanley");
  assert.equal(parsed.rows[0].phone, "0240000000");
  assert.equal(parsed.rows[0].email, "joseph@example.com");
  assert.equal(parsed.rows[0].employeeId, null);
  assert.deepEqual(parsed.rows[0].sourceValues, {
    "Teacher Name": "Joseph Morgan Stanley",
    Phone: "0240000000",
    Email: "JOSEPH@EXAMPLE.COM",
  });
  assert.deepEqual(parsed.rows[0].subjectOfferingIds, []);
  assert.deepEqual(parsed.rows[0].explicitAssignments, []);
});

test("teacher template contains no relationship fields", () => {
  assert.equal(TEACHER_IMPORT_TEMPLATE_CSV, "Teacher Name,Phone,Email\nJoseph Morgan Stanley,0240000000,joseph.stanley@example.com\n");
});
