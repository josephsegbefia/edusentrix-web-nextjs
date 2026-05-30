import { test } from "node:test";
import assert from "node:assert/strict";
import { EXAM_TIMETABLE_ENTRY_SOURCE_REF_TYPE } from "../src/constants/academics/exam-scheduling-engine";
import {
  buildExamAssessmentLinkStatus,
  entryRequiresAssessmentLink,
  isExamEntryAssessmentLinkComplete,
  listMissingAssessmentLinkEntries,
  resolvePrimaryAssessmentItemId,
  validateAssessmentItemForExamEntryLink,
  isExamEntryReadyForAssessmentReporting,
  type ExamAssessmentLinkEntryInput,
  type ExamAssessmentLinkItemInput,
} from "../src/lib/exams/exam-assessment-link-validation";

const baseEntry: ExamAssessmentLinkEntryInput = {
  id: "entry-1",
  title: "Math End of Term",
  subjectId: "subject-1",
  academicPeriodId: "period-1",
  classGroupIds: ["class-a", "class-b"],
  contributesToReport: true,
  assessmentComponentKey: "exam",
  maxScore: 100,
  assessmentItemId: null,
};

const baseItem = (overrides: Partial<ExamAssessmentLinkItemInput> = {}): ExamAssessmentLinkItemInput => ({
  id: "item-1",
  schoolId: "school-1",
  academicPeriodId: "period-1",
  subjectId: "subject-1",
  classGroupId: "class-a",
  contributesToReport: true,
  componentKey: "exam",
  maxScore: 100,
  sourceRefType: EXAM_TIMETABLE_ENTRY_SOURCE_REF_TYPE,
  sourceRefId: "entry-1",
  status: "open",
  ...overrides,
});

test("entryRequiresAssessmentLink is true only when contributesToReport is true", () => {
  assert.equal(entryRequiresAssessmentLink({ contributesToReport: true }), true);
  assert.equal(entryRequiresAssessmentLink({ contributesToReport: false }), false);
});

test("validateAssessmentItemForExamEntryLink rejects mismatched subject and period", () => {
  const result = validateAssessmentItemForExamEntryLink({
    entry: baseEntry,
    item: baseItem({ subjectId: "subject-2" }),
    classGroupId: "class-a",
    schoolId: "school-1",
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.errors.join(" "), /subject/i);
  }
});

test("validateAssessmentItemForExamEntryLink rejects non-report-contributing items", () => {
  const result = validateAssessmentItemForExamEntryLink({
    entry: baseEntry,
    item: baseItem({ contributesToReport: false }),
    classGroupId: "class-a",
    schoolId: "school-1",
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.errors.join(" "), /report/i);
  }
});

test("validateAssessmentItemForExamEntryLink rejects items linked to another entry", () => {
  const result = validateAssessmentItemForExamEntryLink({
    entry: baseEntry,
    item: baseItem({ sourceRefId: "entry-other" }),
    classGroupId: "class-a",
    schoolId: "school-1",
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.errors.join(" "), /already linked/i);
  }
});

test("isExamEntryAssessmentLinkComplete requires links for every class group", () => {
  assert.equal(
    isExamEntryAssessmentLinkComplete(baseEntry, [baseItem()]),
    false
  );

  assert.equal(
    isExamEntryAssessmentLinkComplete(baseEntry, [
      baseItem({ id: "item-a", classGroupId: "class-a" }),
      baseItem({ id: "item-b", classGroupId: "class-b" }),
    ]),
    true
  );
});

test("buildExamAssessmentLinkStatus marks non-report entries as not required", () => {
  const status = buildExamAssessmentLinkStatus({
    entry: { ...baseEntry, contributesToReport: false },
    linkedItems: [],
    schoolId: "school-1",
  });

  assert.equal(status.required, false);
  assert.equal(status.isComplete, true);
  assert.equal(status.classGroups.every((row) => row.status === "not_required"), true);
});

test("listMissingAssessmentLinkEntries returns entries with missing class groups", () => {
  const missing = listMissingAssessmentLinkEntries({
    entries: [baseEntry],
    linkedItemsByEntryId: {
      "entry-1": [baseItem({ classGroupId: "class-a" })],
    },
  });

  assert.equal(missing.length, 1);
  assert.deepEqual(missing[0].missingClassGroupIds, ["class-b"]);
});

test("resolvePrimaryAssessmentItemId returns first linked item when complete", () => {
  const linkedItems = [
    baseItem({ id: "item-a", classGroupId: "class-a" }),
    baseItem({ id: "item-b", classGroupId: "class-b" }),
  ];

  assert.equal(
    resolvePrimaryAssessmentItemId(baseEntry, linkedItems),
    "item-a"
  );
});

test("isExamEntryReadyForAssessmentReporting mirrors link completeness", () => {
  assert.equal(
    isExamEntryReadyForAssessmentReporting(baseEntry, [baseItem()]),
    false
  );

  assert.equal(
    isExamEntryReadyForAssessmentReporting(
      { ...baseEntry, contributesToReport: false },
      []
    ),
    true
  );
});
