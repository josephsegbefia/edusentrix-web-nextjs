import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildMissingAssessmentLinkIssues,
  buildPublishReadinessSummary,
  buildUnscheduledEntryIssues,
  computePublishEligibility,
} from "../src/lib/exams/exam-readiness-validation";
import type { ExamConflictDTO } from "../src/types/academics/exam-scheduling-engine";

const baseConflict = (overrides: Partial<ExamConflictDTO> = {}): ExamConflictDTO => ({
  key: "conflict-1",
  type: "class_overlap",
  severity: "error",
  message: "Class overlap detected.",
  affectedEntryIds: ["entry-a"],
  affectedTeacherIds: [],
  affectedClassGroupIds: ["class-1"],
  affectedVenueIds: [],
  suggestion: "Reschedule one paper.",
  canOverride: true,
  ...overrides,
});

test("computePublishEligibility blocks when blocking issues exist", () => {
  assert.equal(
    computePublishEligibility({
      entryCount: 2,
      blockingIssues: [
        {
          key: "x",
          type: "missing_assessment_link",
          severity: "error",
          message: "Missing link",
          affectedEntryIds: ["entry-a"],
          canOverride: false,
          isOverridden: false,
          suggestion: null,
        },
      ],
    }),
    false
  );

  assert.equal(
    computePublishEligibility({
      entryCount: 2,
      blockingIssues: [],
    }),
    true
  );

  assert.equal(
    computePublishEligibility({
      entryCount: 0,
      blockingIssues: [],
    }),
    false
  );
});

test("buildUnscheduledEntryIssues flags unscheduled papers", () => {
  const issues = buildUnscheduledEntryIssues([
    { id: "entry-a", isUnscheduled: true, status: "draft" },
    { id: "entry-b", isUnscheduled: false, status: "ready" },
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.type, "unscheduled_entry");
});

test("buildMissingAssessmentLinkIssues maps missing links to blocking issues", () => {
  const issues = buildMissingAssessmentLinkIssues([
    {
      entryId: "entry-a",
      title: "Math Paper",
      subjectId: "subject-1",
      classGroupIds: ["class-a"],
      missingClassGroupIds: ["class-a"],
      contributesToReport: true,
      assessmentComponentKey: "exam",
    },
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.type, "missing_assessment_link");
  assert.match(issues[0]?.message ?? "", /Math Paper/i);
});

test("buildPublishReadinessSummary blocks unresolved error conflicts", () => {
  const readiness = buildPublishReadinessSummary({
    entries: [
      { id: "entry-a", isUnscheduled: false, status: "ready" },
      { id: "entry-b", isUnscheduled: false, status: "ready" },
    ],
    conflicts: [baseConflict()],
    missingAssessmentLinks: [],
    requiredEntryCount: 2,
    completeEntryCount: 2,
  });

  assert.equal(readiness.canPublish, false);
  assert.equal(readiness.blockingCount, 1);
  assert.equal(readiness.blockingIssues[0]?.type, "class_overlap");
});

test("buildPublishReadinessSummary allows publish when only warnings remain", () => {
  const readiness = buildPublishReadinessSummary({
    entries: [{ id: "entry-a", isUnscheduled: false, status: "ready" }],
    conflicts: [
      baseConflict({
        key: "warning-1",
        severity: "warning",
        type: "teacher_workload_warning",
        message: "Teacher workload is high.",
      }),
    ],
    missingAssessmentLinks: [],
    requiredEntryCount: 1,
    completeEntryCount: 1,
  });

  assert.equal(readiness.canPublish, true);
  assert.equal(readiness.warningCount, 1);
  assert.equal(readiness.blockingCount, 0);
});

test("buildPublishReadinessSummary includes assessment link and unscheduled blockers", () => {
  const readiness = buildPublishReadinessSummary({
    entries: [
      { id: "entry-a", isUnscheduled: true, status: "draft" },
      { id: "entry-b", isUnscheduled: false, status: "ready" },
    ],
    conflicts: [],
    missingAssessmentLinks: [
      {
        entryId: "entry-b",
        title: "English",
        subjectId: "subject-1",
        classGroupIds: ["class-a"],
        missingClassGroupIds: ["class-a"],
        contributesToReport: true,
        assessmentComponentKey: "exam",
      },
    ],
    requiredEntryCount: 1,
    completeEntryCount: 0,
  });

  assert.equal(readiness.canPublish, false);
  assert.equal(readiness.blockingCount, 2);
  assert.equal(readiness.missingAssessmentLinkCount, 1);
  assert.equal(readiness.unscheduledEntryCount, 1);
});

test("buildPublishReadinessSummary ignores overridden conflicts for blocking", () => {
  const readiness = buildPublishReadinessSummary({
    entries: [{ id: "entry-a", isUnscheduled: false, status: "ready" }],
    conflicts: [
      baseConflict({
        isOverridden: true,
        overriddenBy: "admin-1",
        overrideReason: "Accepted for this session.",
      }),
    ],
    missingAssessmentLinks: [],
    requiredEntryCount: 0,
    completeEntryCount: 0,
  });

  assert.equal(readiness.canPublish, true);
  assert.equal(readiness.blockingCount, 0);
});
