/**
 * Report contribution UI helpers — Slice 13.
 *
 * Run: node --test --import tsx tests/assessment-engine.contribution-rules.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getComponentContributionModeExplanation,
  getItemContributionDisplay,
} from "../src/lib/academics/assessment-engine/assessment-item-rules";
import type {
  AssessmentPlanDTO,
  TeacherGradebookComponentItemSummary,
} from "../src/types/academics/assessment-engine";

const basePlan: AssessmentPlanDTO = {
  _id: "plan-1",
  schoolId: "school-1",
  name: "Term plan",
  status: "active",
  academicPeriodId: "period-1",
  gradingPolicyId: "policy-1",
  appliesToGradeId: "grade-1",
  appliesToClassGroupIds: ["class-1"],
  teacherCanCreateReportItems: true,
  teacherCanMarkItemsAsReportContributing: true,
  allowOfflineMarks: true,
  allowAppAssignmentImport: false,
  allowCsvImport: false,
  componentRules: [
    {
      componentKey: "classwork",
      contributionMode: "teacher_selected",
      minItems: 2,
      maxItems: 4,
    },
    {
      componentKey: "exam",
      contributionMode: "fixed_required_item",
      requiredAssessmentTypes: ["exam"],
    },
  ],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function makeItem(
  overrides: Partial<TeacherGradebookComponentItemSummary> = {}
): TeacherGradebookComponentItemSummary {
  return {
    assessmentItemId: "item-1",
    title: "Quiz 1",
    assessmentType: "quiz",
    maxScore: 20,
    contributesToReport: false,
    contributionLockedByRule: false,
    status: "open",
    scoredStudentCount: 10,
    missingStudentCount: 0,
    includedByRule: false,
    ...overrides,
  };
}

describe("getComponentContributionModeExplanation", () => {
  it("explains teacher-selected limits and selection count", () => {
    const explanation = getComponentContributionModeExplanation({
      contributionMode: "teacher_selected",
      rule: {
        componentKey: "classwork",
        contributionMode: "teacher_selected",
        minItems: 2,
        maxItems: 4,
      },
      contributingItemCount: 1,
      eligibleItemCount: 5,
      assessmentPlan: basePlan,
    });

    assert.match(explanation, /Choose which eligible items/);
    assert.match(explanation, /Select between 2 and 4 items/);
    assert.match(explanation, /1 of 5 items selected/);
  });

  it("explains best N rule-based mode", () => {
    const explanation = getComponentContributionModeExplanation({
      contributionMode: "best_n",
      rule: { componentKey: "classwork", contributionMode: "best_n", bestN: 3 },
      contributingItemCount: 5,
      eligibleItemCount: 5,
      assessmentPlan: basePlan,
    });

    assert.match(explanation, /best 3 marks/);
  });
});

describe("getItemContributionDisplay", () => {
  it("allows toggling teacher-selected items when permitted", () => {
    const display = getItemContributionDisplay({
      item: makeItem({ includedByRule: false }),
      component: {
        contributionMode: "teacher_selected",
        rule: { componentKey: "classwork", contributionMode: "teacher_selected" },
        label: "Classwork",
      },
      assessmentPlan: basePlan,
      canRecord: true,
    });

    assert.equal(display.canToggle, true);
    assert.equal(display.status, "excluded");
    assert.equal(display.switchChecked, false);
  });

  it("marks fixed required matches as included and locked", () => {
    const display = getItemContributionDisplay({
      item: makeItem({
        assessmentType: "exam",
        title: "End of term exam",
        includedByRule: true,
        contributionLockedByRule: true,
      }),
      component: {
        contributionMode: "fixed_required_item",
        rule: {
          componentKey: "exam",
          contributionMode: "fixed_required_item",
          requiredAssessmentTypes: ["exam"],
        },
        label: "Examination",
      },
      assessmentPlan: basePlan,
      canRecord: true,
    });

    assert.equal(display.status, "locked");
    assert.equal(display.canToggle, false);
    assert.equal(display.switchChecked, true);
  });

  it("explains why fixed required items are excluded", () => {
    const display = getItemContributionDisplay({
      item: makeItem({ assessmentType: "quiz", title: "Weekly quiz", includedByRule: false }),
      component: {
        contributionMode: "fixed_required_item",
        rule: {
          componentKey: "exam",
          contributionMode: "fixed_required_item",
          requiredAssessmentTypes: ["exam"],
        },
        label: "Examination",
      },
      assessmentPlan: basePlan,
      canRecord: true,
    });

    assert.equal(display.status, "excluded");
    assert.match(display.explanation, /requires type Exam/);
  });
});
