/**
 * Subject result preview/submit helpers — Slice 14.
 *
 * Run: node --test --import tsx tests/assessment-engine.subject-result-service.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildSubjectResultPreviewStudents,
  parseSubjectResultScopeBody,
} from "../src/lib/academics/assessment-engine/subject-result-service";
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
    allowedAssessmentTypes: ["classwork"],
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
  allowAppAssignmentImport: false,
  allowCsvImport: false,
} satisfies AssessmentPlanDTO;

const items = [
  {
    _id: "507f1f77bcf86cd799439020",
    schoolId: assessmentPlan.schoolId,
    academicPeriodId: assessmentPlan.academicPeriodId,
    assessmentPlanId: assessmentPlan._id,
    classGroupId: "507f1f77bcf86cd799439015",
    gradeId: assessmentPlan.appliesToGradeId,
    subjectId: "507f1f77bcf86cd799439016",
    teacherId: "507f1f77bcf86cd799439017",
    title: "Class test",
    assessmentType: "classwork",
    sourceType: "manual",
    maxScore: 20,
    componentKey: "classroom_work",
    contributesToReport: true,
    contributionLockedByRule: false,
    missingPolicy: "block_submission",
    visibility: "class_only",
    status: "open",
  },
  {
    _id: "507f1f77bcf86cd799439021",
    schoolId: assessmentPlan.schoolId,
    academicPeriodId: assessmentPlan.academicPeriodId,
    assessmentPlanId: assessmentPlan._id,
    classGroupId: "507f1f77bcf86cd799439015",
    gradeId: assessmentPlan.appliesToGradeId,
    subjectId: "507f1f77bcf86cd799439016",
    teacherId: "507f1f77bcf86cd799439017",
    title: "End of term exam",
    assessmentType: "exam",
    sourceType: "manual",
    maxScore: 100,
    componentKey: "exam",
    contributesToReport: true,
    contributionLockedByRule: true,
    missingPolicy: "block_submission",
    visibility: "class_only",
    status: "open",
  },
] satisfies AssessmentItemDTO[];

const studentId = "507f1f77bcf86cd799439030";

const scores = [
  {
    _id: "507f1f77bcf86cd799439040",
    schoolId: assessmentPlan.schoolId,
    academicPeriodId: assessmentPlan.academicPeriodId,
    assessmentItemId: items[0]._id,
    assessmentPlanId: assessmentPlan._id,
    classGroupId: items[0].classGroupId,
    subjectId: items[0].subjectId,
    studentId,
    teacherId: items[0].teacherId,
    score: 16,
    maxScoreSnapshot: 20,
    percentage: 80,
    status: "recorded",
  },
  {
    _id: "507f1f77bcf86cd799439041",
    schoolId: assessmentPlan.schoolId,
    academicPeriodId: assessmentPlan.academicPeriodId,
    assessmentItemId: items[1]._id,
    assessmentPlanId: assessmentPlan._id,
    classGroupId: items[1].classGroupId,
    subjectId: items[1].subjectId,
    studentId,
    teacherId: items[1].teacherId,
    score: 70,
    maxScoreSnapshot: 100,
    percentage: 70,
    status: "recorded",
  },
] satisfies AssessmentScoreDTO[];

describe("parseSubjectResultScopeBody", () => {
  it("accepts valid scope payloads", () => {
    const parsed = parseSubjectResultScopeBody({
      classGroupId: "507f1f77bcf86cd799439015",
      subjectId: "507f1f77bcf86cd799439016",
    });
    assert.equal(parsed.ok, true);
  });

  it("rejects invalid ids", () => {
    const parsed = parseSubjectResultScopeBody({
      classGroupId: "bad",
      subjectId: "507f1f77bcf86cd799439016",
    });
    assert.equal(parsed.ok, false);
  });
});

describe("buildSubjectResultPreviewStudents", () => {
  it("builds component snapshots and final grades from calculation utilities", () => {
    const previewStudents = buildSubjectResultPreviewStudents({
      classGroupRef: {
        _id: "507f1f77bcf86cd799439015",
        name: "A",
        label: "JHS 1 A",
        gradeId: assessmentPlan.appliesToGradeId,
        gradeName: "JHS 1",
      },
      subjectRef: { _id: "507f1f77bcf86cd799439016", name: "Mathematics" },
      academicPeriodRef: {
        _id: assessmentPlan.academicPeriodId,
        yearLabel: "2025/2026",
        term: "Term 1",
        isCurrent: true,
      },
      students: [{ _id: studentId, name: "Ada Lovelace", admissionNo: "ADM001" }],
      assessmentItems: items,
      assessmentScores: scores,
      scoreComponents,
      componentRules,
      gradingPolicy,
      assessmentPlan,
      scope: {
        classGroupId: "507f1f77bcf86cd799439015" as unknown as never,
        subjectId: "507f1f77bcf86cd799439016" as unknown as never,
        academicPeriodId: assessmentPlan.academicPeriodId as unknown as never,
        gradeId: assessmentPlan.appliesToGradeId as unknown as never,
        classGroup: { _id: "x", name: "A", gradeId: "y" } as never,
        subject: { _id: "x", name: "Mathematics" } as never,
        grade: { _id: "y", name: "JHS 1" } as never,
        academicPeriod: {
          _id: assessmentPlan.academicPeriodId,
          yearLabel: "2025/2026",
          term: "Term 1",
          isCurrent: true,
        } as never,
        assessmentPlan,
        gradingPolicy,
      },
      existingResultsByStudentId: new Map(),
      readiness: {
        assessmentPlanActive: true,
        hasAssessmentPlan: true,
        hasGradingPolicy: true,
        studentsExpected: 1,
        assessmentItemCount: 2,
        draftAssessmentItemCount: 0,
        missingScoreCount: 0,
        invalidScoreCount: 0,
        blockedSubmission: false,
        canSubmit: true,
        checklist: [],
        issues: [],
      },
      componentSummary: [],
    });

    assert.equal(previewStudents.length, 1);
    assert.equal(previewStudents[0]?.blocked, false);
    assert.equal(previewStudents[0]?.components.length, 2);
    assert.equal(previewStudents[0]?.gradeLabel, "C");
    assert.equal(previewStudents[0]?.subjectPosition, 1);
  });
});
