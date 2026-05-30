import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeMissingScoreCount,
  isExamMarksPendingEligible,
  teacherTeachesExamEntry,
} from "../src/lib/exams/exam-teacher-validation";

test("isExamMarksPendingEligible requires published session and past exam date", () => {
  assert.equal(
    isExamMarksPendingEligible({
      examDateIso: "2026-05-29T00:00:00.000Z",
      sessionStatus: "published",
      assessmentItemStatus: "open",
      contributesToReport: true,
      referenceDate: new Date("2026-05-30T12:00:00.000Z"),
    }),
    true
  );

  assert.equal(
    isExamMarksPendingEligible({
      examDateIso: "2026-05-31T00:00:00.000Z",
      sessionStatus: "published",
      assessmentItemStatus: "open",
      contributesToReport: true,
      referenceDate: new Date("2026-05-30T12:00:00.000Z"),
    }),
    false
  );

  assert.equal(
    isExamMarksPendingEligible({
      examDateIso: "2026-05-29T00:00:00.000Z",
      sessionStatus: "draft",
      assessmentItemStatus: "open",
      contributesToReport: true,
      referenceDate: new Date("2026-05-30T12:00:00.000Z"),
    }),
    false
  );

  assert.equal(
    isExamMarksPendingEligible({
      examDateIso: "2026-05-29T00:00:00.000Z",
      sessionStatus: "published",
      assessmentItemStatus: "closed",
      contributesToReport: true,
      referenceDate: new Date("2026-05-30T12:00:00.000Z"),
    }),
    false
  );
});

test("teacherTeachesExamEntry matches class and subject assignment keys", () => {
  const assignmentKeys = new Set(["class-a|subject-math", "class-b|subject-english"]);

  assert.equal(
    teacherTeachesExamEntry({
      subjectId: "subject-math",
      classGroupIds: ["class-a", "class-c"],
      assignmentKeys,
    }),
    true
  );

  assert.equal(
    teacherTeachesExamEntry({
      subjectId: "subject-science",
      classGroupIds: ["class-a"],
      assignmentKeys,
    }),
    false
  );
});

test("computeMissingScoreCount never returns negative values", () => {
  assert.equal(computeMissingScoreCount({ studentCount: 30, gradedCount: 12 }), 18);
  assert.equal(computeMissingScoreCount({ studentCount: 10, gradedCount: 12 }), 0);
});
