/**
 * Assessment item and score mutation helpers — Slice 9.
 *
 * Run: node --test --import tsx tests/assessment-engine.assessment-mutations.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseCreateAssessmentItemBody,
  parseUpdateAssessmentItemBody,
  resolveContributionFlags,
  canMutateAssessmentItem,
} from "../src/lib/academics/assessment-engine/assessment-item-service";
import {
  parseBulkAssessmentScoresBody,
  validateScoreValue,
  resolveScoreStatus,
  canMutateAssessmentScore,
} from "../src/lib/academics/assessment-engine/assessment-score-service";
import type {
  AcademicGradingPolicyDTO,
  AssessmentPlanDTO,
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
  gradeBoundaries: [],
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

describe("assessment item payload parsing", () => {
  it("parses a valid manual assessment item payload", () => {
    const parsed = parseCreateAssessmentItemBody({
      classGroupId: "507f1f77bcf86cd799439015",
      subjectId: "507f1f77bcf86cd799439016",
      title: "Week 1 Classwork",
      assessmentType: "classwork",
      maxScore: 20,
      componentKey: "classroom_work",
      contributesToReport: true,
    });

    assert.equal(parsed.ok, true);
  });

  it("parses update payloads with archive status", () => {
    const parsed = parseUpdateAssessmentItemBody({ status: "archived" });
    assert.equal(parsed.ok, true);
  });
});

describe("resolveContributionFlags", () => {
  it("allows teacher-selected report contribution when permitted", () => {
    const result = resolveContributionFlags({
      componentKey: "classroom_work",
      assessmentType: "classwork",
      title: "Week 1 Classwork",
      requestedContributesToReport: true,
      assessmentPlan,
      gradingPolicy,
    });

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.contributesToReport, true);
      assert.equal(result.contributionLockedByRule, false);
    }
  });

  it("locks fixed required exam items by rule", () => {
    const result = resolveContributionFlags({
      componentKey: "exam",
      assessmentType: "exam",
      title: "End of Term Exam",
      requestedContributesToReport: false,
      assessmentPlan,
      gradingPolicy,
    });

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.contributesToReport, true);
      assert.equal(result.contributionLockedByRule, true);
    }
  });

  it("rejects report contribution when plan disallows it", () => {
    const result = resolveContributionFlags({
      componentKey: "classroom_work",
      assessmentType: "classwork",
      title: "Week 1 Classwork",
      requestedContributesToReport: true,
      assessmentPlan: {
        ...assessmentPlan,
        teacherCanMarkItemsAsReportContributing: false,
      },
      gradingPolicy,
    });

    assert.equal(result.ok, false);
  });
});

describe("assessment score helpers", () => {
  it("parses bulk score payloads", () => {
    const parsed = parseBulkAssessmentScoresBody({
      assessmentItemId: "507f1f77bcf86cd799439020",
      records: [{ studentId: "507f1f77bcf86cd799439021", score: 16 }],
    });

    assert.equal(parsed.ok, true);
  });

  it("validates score ranges against item max score", () => {
    assert.equal(validateScoreValue(16, 20).ok, true);
    assert.equal(validateScoreValue(21, 20).ok, false);
    assert.equal(validateScoreValue(-1, 20).ok, false);
  });

  it("resolves missing and recorded statuses", () => {
    assert.equal(resolveScoreStatus(null), "missing");
    assert.equal(resolveScoreStatus(15), "recorded");
    assert.equal(resolveScoreStatus(15, "draft"), "draft");
  });

  it("blocks locked score mutation", () => {
    assert.equal(canMutateAssessmentItem({ status: "locked" }), false);
    assert.equal(canMutateAssessmentScore("locked"), false);
  });
});
