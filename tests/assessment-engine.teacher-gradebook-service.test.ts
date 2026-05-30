/**
 * Teacher gradebook v2 read helpers — Slice 8.
 *
 * Run: node --test --import tsx tests/assessment-engine.teacher-gradebook-service.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildTeacherGradebookComponentSummaries,
  buildTeacherGradebookReadiness,
  buildTeacherGradebookStudentRows,
} from "../src/lib/academics/assessment-engine/teacher-gradebook-service";
import type {
  AssessmentItemDTO,
  AssessmentPlanDTO,
  AssessmentScoreDTO,
  AcademicGradingPolicyDTO,
  ComponentRule,
} from "../src/types/academics/assessment-engine";

const scoreComponents = [
  {
    key: "classroom_work",
    label: "Classroom Work",
    weight: 30,
    order: 1,
    required: true,
    allowedAssessmentTypes: ["classwork", "homework"],
  },
  {
    key: "exam",
    label: "Exam",
    weight: 70,
    order: 2,
    required: true,
    allowedAssessmentTypes: ["exam"],
  },
];

const componentRules = [
  {
    componentKey: "classroom_work",
    contributionMode: "teacher_selected",
    minItems: 1,
    maxItems: 3,
  },
  {
    componentKey: "exam",
    contributionMode: "fixed_required_item",
    requiredAssessmentTypes: ["exam"],
  },
] satisfies ComponentRule[];

const gradingPolicy = {
  _id: "507f1f77bcf86cd799439012",
  schoolId: "507f1f77bcf86cd799439010",
  name: "Default Policy",
  gradeLabelMode: "letters",
  appliesToGradeIds: [],
  appliesToGradeBandCodes: [],
  isDefault: true,
  status: "active",
  scoreComponents,
  gradeBoundaries: [
    {
      minPercentage: 80,
      maxPercentage: 100,
      gradeLabel: "A",
      gradePoint: 4,
      isPassing: true,
    },
    {
      minPercentage: 0,
      maxPercentage: 79.99,
      gradeLabel: "C",
      gradePoint: 2,
      isPassing: false,
    },
  ],
  passMark: 50,
  roundingRule: "one_decimal",
  showClassPosition: true,
  showSubjectPosition: false,
  showGradeKey: true,
  allowTeacherContributionSelection: true,
  requireAdminApprovalForPolicyChanges: false,
} satisfies AcademicGradingPolicyDTO;

const assessmentPlan = {
  _id: "507f1f77bcf86cd799439013",
  schoolId: "507f1f77bcf86cd799439010",
  name: "Term 1 Plan",
  academicPeriodId: "507f1f77bcf86cd799439011",
  gradingPolicyId: gradingPolicy._id,
  appliesToGradeId: "507f1f77bcf86cd799439014",
  appliesToClassGroupIds: ["507f1f77bcf86cd799439015"],
  status: "active",
  componentRules,
  teacherCanCreateReportItems: true,
  teacherCanMarkItemsAsReportContributing: true,
  allowOfflineMarks: true,
  allowAppAssignmentImport: true,
  allowCsvImport: false,
} satisfies AssessmentPlanDTO;

function makeItem(
  overrides: Partial<AssessmentItemDTO> & Pick<AssessmentItemDTO, "_id" | "title">
): AssessmentItemDTO {
  return {
    _id: overrides._id,
    schoolId: "507f1f77bcf86cd799439010",
    academicPeriodId: "507f1f77bcf86cd799439011",
    assessmentPlanId: assessmentPlan._id,
    classGroupId: "507f1f77bcf86cd799439015",
    gradeId: "507f1f77bcf86cd799439014",
    subjectId: "507f1f77bcf86cd799439016",
    teacherId: "507f1f77bcf86cd799439017",
    title: overrides.title,
    assessmentType: overrides.assessmentType ?? "classwork",
    sourceType: "manual",
    maxScore: overrides.maxScore ?? 20,
    componentKey: overrides.componentKey ?? null,
    contributesToReport: overrides.contributesToReport ?? false,
    contributionLockedByRule: overrides.contributionLockedByRule ?? false,
    visibility: "teacher_only",
    status: overrides.status ?? "open",
    ...overrides,
  };
}

function makeScore(
  overrides: Partial<AssessmentScoreDTO> &
    Pick<AssessmentScoreDTO, "assessmentItemId" | "studentId">
): AssessmentScoreDTO {
  return {
    _id: overrides._id ?? `${overrides.studentId}-${overrides.assessmentItemId}`,
    schoolId: "507f1f77bcf86cd799439010",
    academicPeriodId: "507f1f77bcf86cd799439011",
    assessmentPlanId: assessmentPlan._id,
    classGroupId: "507f1f77bcf86cd799439015",
    subjectId: "507f1f77bcf86cd799439016",
    teacherId: "507f1f77bcf86cd799439017",
    score: overrides.score ?? null,
    maxScoreSnapshot: overrides.maxScoreSnapshot ?? 20,
    percentage: overrides.percentage ?? null,
    status: overrides.status ?? "draft",
    ...overrides,
  };
}

describe("teacher gradebook component summaries", () => {
  it("uses policy components instead of hardcoded CA/exam buckets", () => {
    const items = [
      makeItem({
        _id: "item-classwork",
        title: "Week 1 Classwork",
        assessmentType: "classwork",
        componentKey: "classroom_work",
        contributesToReport: true,
      }),
      makeItem({
        _id: "item-exam",
        title: "End of Term Exam",
        assessmentType: "exam",
        componentKey: "exam",
        maxScore: 100,
        contributesToReport: true,
        contributionLockedByRule: true,
      }),
    ];

    const summary = buildTeacherGradebookComponentSummaries({
      scoreComponents,
      componentRules,
      items,
      scores: [
        makeScore({
          assessmentItemId: "item-classwork",
          studentId: "student-1",
          score: 16,
          status: "recorded",
          percentage: 80,
        }),
        makeScore({
          assessmentItemId: "item-exam",
          studentId: "student-1",
          score: 70,
          maxScoreSnapshot: 100,
          status: "recorded",
          percentage: 70,
        }),
      ],
      studentIds: ["student-1"],
    });

    assert.equal(summary.length, 2);
    assert.equal(summary[0]?.componentKey, "classroom_work");
    assert.equal(summary[1]?.componentKey, "exam");
    assert.equal(summary[0]?.contributionMode, "teacher_selected");
    assert.equal(summary[1]?.contributionMode, "fixed_required_item");
    assert.equal(summary[0]?.contributingItemCount, 1);
    assert.equal(summary[1]?.contributingItemCount, 1);
  });

  it("flags missing teacher-selected items when below minimum", () => {
    const summary = buildTeacherGradebookComponentSummaries({
      scoreComponents,
      componentRules,
      items: [
        makeItem({
          _id: "item-classwork",
          title: "Week 1 Classwork",
          assessmentType: "classwork",
          componentKey: "classroom_work",
          contributesToReport: false,
        }),
      ],
      scores: [],
      studentIds: ["student-1"],
    });

    const classroomSummary = summary.find(
      (entry) => entry.componentKey === "classroom_work"
    );
    assert.equal(classroomSummary?.ready, false);
    assert.match(
      classroomSummary?.issues[0]?.message ?? "",
      /Select at least 1 contributing items/
    );
  });
});

describe("teacher gradebook readiness", () => {
  it("builds submit checklist from component summaries", () => {
    const componentSummary = buildTeacherGradebookComponentSummaries({
      scoreComponents,
      componentRules,
      items: [
        makeItem({
          _id: "item-classwork",
          title: "Week 1 Classwork",
          assessmentType: "classwork",
          componentKey: "classroom_work",
          contributesToReport: true,
        }),
        makeItem({
          _id: "item-exam",
          title: "End of Term Exam",
          assessmentType: "exam",
          componentKey: "exam",
          maxScore: 100,
          contributesToReport: true,
          contributionLockedByRule: true,
        }),
      ],
      scores: [
        makeScore({
          assessmentItemId: "item-classwork",
          studentId: "student-1",
          score: 16,
          status: "recorded",
        }),
        makeScore({
          assessmentItemId: "item-exam",
          studentId: "student-1",
          score: 70,
          maxScoreSnapshot: 100,
          status: "recorded",
        }),
      ],
      studentIds: ["student-1"],
    });

    const readiness = buildTeacherGradebookReadiness({
      assessmentPlan,
      gradingPolicy,
      componentSummary,
      assessmentItems: [
        makeItem({
          _id: "item-classwork",
          title: "Week 1 Classwork",
          assessmentType: "classwork",
          componentKey: "classroom_work",
          contributesToReport: true,
        }),
        makeItem({
          _id: "item-exam",
          title: "End of Term Exam",
          assessmentType: "exam",
          componentKey: "exam",
          maxScore: 100,
          contributesToReport: true,
          contributionLockedByRule: true,
        }),
      ],
      assessmentScores: [
        makeScore({
          assessmentItemId: "item-classwork",
          studentId: "student-1",
          score: 16,
          status: "recorded",
        }),
        makeScore({
          assessmentItemId: "item-exam",
          studentId: "student-1",
          score: 70,
          maxScoreSnapshot: 100,
          status: "recorded",
        }),
      ],
      studentCount: 1,
    });

    assert.equal(readiness.assessmentPlanActive, true);
    assert.equal(readiness.canSubmit, true);
    assert.deepEqual(
      readiness.checklist.map((entry) => entry.key),
      ["active_plan", "required_items", "required_scores", "valid_scores"]
    );
  });

  it("blocks submission when no active assessment plan exists", () => {
    const readiness = buildTeacherGradebookReadiness({
      assessmentPlan: null,
      gradingPolicy: null,
      componentSummary: [],
      assessmentItems: [],
      assessmentScores: [],
      studentCount: 2,
    });

    assert.equal(readiness.canSubmit, false);
    assert.equal(readiness.blockedSubmission, true);
    assert.equal(
      readiness.issues.some((issue) => issue.code === "NO_ASSESSMENT_PLAN"),
      true
    );
  });
});

describe("teacher gradebook student rows", () => {
  it("calculates per-student preview from dynamic policy components", () => {
    const items = [
      makeItem({
        _id: "item-classwork",
        title: "Week 1 Classwork",
        assessmentType: "classwork",
        componentKey: "classroom_work",
        contributesToReport: true,
      }),
      makeItem({
        _id: "item-exam",
        title: "End of Term Exam",
        assessmentType: "exam",
        componentKey: "exam",
        maxScore: 100,
        contributesToReport: true,
        contributionLockedByRule: true,
      }),
    ];

    const scores = [
      makeScore({
        assessmentItemId: "item-classwork",
        studentId: "student-1",
        score: 16,
        status: "recorded",
      }),
      makeScore({
        assessmentItemId: "item-exam",
        studentId: "student-1",
        score: 70,
        maxScoreSnapshot: 100,
        status: "recorded",
      }),
    ];

    const rows = buildTeacherGradebookStudentRows({
      students: [{ _id: "student-1", name: "Ama Mensah" }],
      assessmentItems: items,
      assessmentScores: scores,
      scoreComponents,
      componentRules,
      gradingPolicy,
      subjectResultsByStudentId: new Map(),
    });

    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.scores.length, 2);
    assert.equal(rows[0]?.preview?.roundedFinalScore, 73);
    assert.equal(rows[0]?.preview?.gradeLabel, "C");
    assert.equal(rows[0]?.preview?.blocked, false);
  });
});
