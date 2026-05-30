/**
 * Assessment plan service tests — Slice 6.
 *
 * Run: node --test --import tsx tests/assessment-engine.assessment-plan-service.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseAssessmentPlanBody,
} from "../src/lib/academics/assessment-engine/assessment-plan-service";
import { validateAssessmentPlan } from "../src/lib/academics/assessment-engine/validate-assessment-plan";
import type { ComponentRule } from "../src/types/academics/assessment-engine";

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

const validPlanBody = {
  name: "Primary 3 Term 1 Plan",
  academicPeriodId: "507f1f77bcf86cd799439011",
  gradingPolicyId: "507f1f77bcf86cd799439012",
  appliesToGradeId: "507f1f77bcf86cd799439013",
  appliesToClassGroupIds: ["507f1f77bcf86cd799439014"],
  componentRules: [
    {
      componentKey: "classroom_work",
      contributionMode: "teacher_selected",
      minItems: 2,
      maxItems: 5,
    },
    {
      componentKey: "exam",
      contributionMode: "fixed_required_item",
      requiredAssessmentTypes: ["exam"],
    },
  ] satisfies ComponentRule[],
};

describe("assessment plan service validation", () => {
  it("parses a valid assessment plan payload", () => {
    const parsed = parseAssessmentPlanBody(validPlanBody);
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.data.name, "Primary 3 Term 1 Plan");
      assert.equal(parsed.data.componentRules.length, 2);
    }
  });

  it("rejects payloads without class groups", () => {
    const parsed = parseAssessmentPlanBody({
      ...validPlanBody,
      appliesToClassGroupIds: [],
    });
    assert.equal(parsed.ok, false);
  });

  it("accepts teacher-selected and rule-based contribution modes", () => {
    const validation = validateAssessmentPlan({
      scoreComponents,
      componentRules: validPlanBody.componentRules,
      gradingPolicyStatus: "active",
    });
    assert.equal(validation.valid, true);
  });

  it("rejects component rules that do not map to the grading policy", () => {
    const validation = validateAssessmentPlan({
      scoreComponents,
      componentRules: [
        {
          componentKey: "project_work",
          contributionMode: "average_all",
        } satisfies ComponentRule,
        ...validPlanBody.componentRules,
      ],
      gradingPolicyStatus: "active",
    });
    assert.equal(validation.valid, false);
    assert.ok(
      validation.errors.some((error) => error.includes("project_work"))
    );
  });

  it("rejects archived grading policies", () => {
    const validation = validateAssessmentPlan({
      scoreComponents,
      componentRules: validPlanBody.componentRules,
      gradingPolicyStatus: "archived",
    });
    assert.equal(validation.valid, false);
  });
});
