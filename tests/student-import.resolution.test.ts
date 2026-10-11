import test from "node:test";
import assert from "node:assert/strict";
import { buildStudentImportLeoPrompt } from "@/lib/students/student-import-leo";

test("student Leo import prompt contains only structural values", () => {
  const prompt = buildStudentImportLeoPrompt({ unresolvedGrades: ["Basic One"], unresolvedClasses: ["JHS1A"], sexValues: ["F"], statusValues: ["current"], gradeCatalog: ["Basic 1"], classCatalog: [{ gradeName: "Basic 1", className: "A" }] });
  assert.match(prompt, /Basic One/);
  assert.match(prompt, /Never return database IDs/);
  assert.match(prompt, /dates of birth, admission numbers/);
  assert.doesNotMatch(prompt, /Ama|2017-05-12|ADM001/);
});
