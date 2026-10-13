import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Types } from "mongoose";
import { resolveBulkImportRouting } from "@/lib/imports/bulk-import-routing";

test("a staged teacher analysis route is exact and cannot fall through", () => {
  const id = new Types.ObjectId();
  const route = resolveBulkImportRouting({
    subjectType: "TeacherImportJob",
    subjectId: id,
    input: { teacherImportJobId: String(id), teacherImportPhase: "analysis" },
  } as never);
  assert.deepEqual(route, {
    ok: true,
    routing: { kind: "teacher_staged", importJobId: String(id), phase: "analysis" },
  });
});

test("mixed legacy and staged identifiers are permanently rejected", () => {
  const id = new Types.ObjectId();
  const legacy = new Types.ObjectId();
  const route = resolveBulkImportRouting({
    subjectType: "TeacherImportJob",
    subjectId: id,
    input: {
      teacherImportJobId: String(id),
      teacherImportPhase: "analysis",
      bulkImportJobId: String(legacy),
    },
  } as never);
  assert.equal(route.ok, false);
  if (!route.ok) assert.equal(route.code, "BULK_IMPORT_ROUTING_INVALID");
});

test("the production bulk dispatcher has no direct legacy teacher executor", () => {
  const dispatcher = readFileSync(join(process.cwd(), "src/lib/imports/execute-bulk-import.ts"), "utf8");
  assert.doesNotMatch(dispatcher, /importTeachersFromBuffer/);
  assert.doesNotMatch(dispatcher, /importStudentsFromRows/);
  assert.match(dispatcher, /executeTeacherImportAnalysis/);
  assert.match(dispatcher, /executeTeacherImportCommit/);
});
