/**
 * Assessment engine calculation utilities — Slice 3.
 *
 * Run: npm test -- tests/assessment-engine.calculation.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { calculateComponent } from "../src/lib/academics/assessment-engine/calculate-component";
import { calculateSubjectResult } from "../src/lib/academics/assessment-engine/calculate-subject-result";
import {
  applyRoundingRule,
  resolveGradeBoundary,
} from "../src/lib/academics/assessment-engine/resolve-grade-boundary";
import {
  validateAssessmentPlan,
  validateGradingPolicy,
} from "../src/lib/academics/assessment-engine/validate-assessment-plan";
import type {
  ComponentRule,
  ScoreComponent,
} from "../src/types/academics/assessment-engine";

const classroomComponent: ScoreComponent = {
  key: "classroom_work",
  label: "Classroom Work",
  weight: 30,
  order: 1,
  required: true,
  allowedAssessmentTypes: ["classwork", "homework", "quiz"],
};

const examComponent: ScoreComponent = {
  key: "exam",
  label: "Exam",
  weight: 70,
  order: 2,
  required: true,
  allowedAssessmentTypes: ["exam"],
};

const gradeBoundaries = [
  {
    minPercentage: 80,
    maxPercentage: 100,
    gradeLabel: "A",
    gradePoint: 4,
    descriptor: "Excellent",
    isPassing: true,
  },
  {
    minPercentage: 70,
    maxPercentage: 79.99,
    gradeLabel: "B",
    gradePoint: 3,
    descriptor: "Very Good",
    isPassing: true,
  },
  {
    minPercentage: 0,
    maxPercentage: 69.99,
    gradeLabel: "C",
    gradePoint: 2,
    descriptor: "Pass",
    isPassing: false,
  },
];

describe("resolve-grade-boundary", () => {
  it("applies rounding rules", () => {
    assert.equal(applyRoundingRule(88.104, "one_decimal"), 88.1);
    assert.equal(applyRoundingRule(88.16, "nearest_integer"), 88);
    assert.equal(applyRoundingRule(88.126, "two_decimals"), 88.13);
  });

  it("resolves grade labels from dynamic boundaries", () => {
    const resolved = resolveGradeBoundary(88.1, gradeBoundaries);
    assert.equal(resolved?.gradeLabel, "A");
    assert.equal(resolved?.gradePoint, 4);
  });
});

describe("calculateComponent — teacher_selected", () => {
  it("averages only teacher-selected contributing items", () => {
    const result = calculateComponent({
      component: classroomComponent,
      rule: {
        componentKey: "classroom_work",
        contributionMode: "teacher_selected",
        minItems: 2,
        maxItems: 3,
      },
      items: [
        {
          id: "cw1",
          componentKey: "classroom_work",
          assessmentType: "classwork",
          title: "Exercise 1",
          maxScore: 10,
          contributesToReport: true,
        },
        {
          id: "cw2",
          componentKey: "classroom_work",
          assessmentType: "classwork",
          title: "Exercise 2",
          maxScore: 20,
          contributesToReport: true,
        },
        {
          id: "cw3",
          componentKey: "classroom_work",
          assessmentType: "classwork",
          title: "Exercise 3",
          maxScore: 10,
          contributesToReport: false,
        },
      ],
      scores: [
        { assessmentItemId: "cw1", score: 8 },
        { assessmentItemId: "cw2", score: 17 },
        { assessmentItemId: "cw3", score: 9 },
      ],
    });

    assert.deepEqual(result.includedAssessmentItemIds, ["cw1", "cw2"]);
    assert.equal(result.rawPercentage, 82.5);
    assert.equal(result.weightedScore, 24.75);
  });
});

describe("calculateComponent — average_all", () => {
  it("averages all eligible scored items equally", () => {
    const result = calculateComponent({
      component: classroomComponent,
      rule: {
        componentKey: "classroom_work",
        contributionMode: "average_all",
      },
      items: [
        {
          id: "hw1",
          componentKey: "classroom_work",
          assessmentType: "homework",
          title: "Homework 1",
          maxScore: 10,
          contributesToReport: false,
        },
        {
          id: "hw2",
          componentKey: "classroom_work",
          assessmentType: "homework",
          title: "Homework 2",
          maxScore: 20,
          contributesToReport: false,
        },
      ],
      scores: [
        { assessmentItemId: "hw1", score: 8 },
        { assessmentItemId: "hw2", score: 16 },
      ],
    });

    assert.equal(result.rawPercentage, 80);
    assert.equal(result.weightedScore, 24);
  });
});

describe("calculateComponent — best_n", () => {
  it("uses the best N item percentages", () => {
    const result = calculateComponent({
      component: classroomComponent,
      rule: {
        componentKey: "classroom_work",
        contributionMode: "best_n",
        bestN: 2,
      },
      items: [
        {
          id: "a",
          componentKey: "classroom_work",
          assessmentType: "classwork",
          title: "A",
          maxScore: 10,
          contributesToReport: false,
        },
        {
          id: "b",
          componentKey: "classroom_work",
          assessmentType: "classwork",
          title: "B",
          maxScore: 10,
          contributesToReport: false,
        },
        {
          id: "c",
          componentKey: "classroom_work",
          assessmentType: "classwork",
          title: "C",
          maxScore: 10,
          contributesToReport: false,
        },
      ],
      scores: [
        { assessmentItemId: "a", score: 6 },
        { assessmentItemId: "b", score: 9 },
        { assessmentItemId: "c", score: 7 },
      ],
    });

    assert.deepEqual(result.includedAssessmentItemIds.sort(), ["b", "c"]);
    assert.equal(result.rawPercentage, 80);
  });

  it("flags insufficient scored items for best_n", () => {
    const result = calculateComponent({
      component: classroomComponent,
      rule: {
        componentKey: "classroom_work",
        contributionMode: "best_n",
        bestN: 3,
      },
      items: [
        {
          id: "a",
          componentKey: "classroom_work",
          assessmentType: "classwork",
          title: "A",
          maxScore: 10,
          contributesToReport: false,
        },
        {
          id: "b",
          componentKey: "classroom_work",
          assessmentType: "classwork",
          title: "B",
          maxScore: 10,
          contributesToReport: false,
        },
      ],
      scores: [
        { assessmentItemId: "a", score: 8 },
        { assessmentItemId: "b", score: 7 },
      ],
    });

    assert.equal(result.blocked, true);
    assert.match(
      result.issues[0]?.message ?? "",
      /Best 3 rule requires at least 3 scored items/
    );
  });
});

describe("calculateComponent — fixed_required_item", () => {
  it("blocks when a required exam item is missing", () => {
    const result = calculateComponent({
      component: examComponent,
      rule: {
        componentKey: "exam",
        contributionMode: "fixed_required_item",
        requiredAssessmentTypes: ["exam"],
      },
      items: [
        {
          id: "exam1",
          componentKey: "exam",
          assessmentType: "exam",
          title: "End of Term Exam",
          maxScore: 100,
          contributesToReport: true,
          missingPolicy: "block_submission",
        },
      ],
      scores: [{ assessmentItemId: "exam1", score: null, status: "missing" }],
    });

    assert.equal(result.blocked, true);
    assert.deepEqual(result.missingRequiredItems, ["exam1"]);
  });
});

describe("calculateComponent — weighted_items", () => {
  it("weights items by max score totals", () => {
    const result = calculateComponent({
      component: classroomComponent,
      rule: {
        componentKey: "classroom_work",
        contributionMode: "weighted_items",
      },
      items: [
        {
          id: "small",
          componentKey: "classroom_work",
          assessmentType: "classwork",
          title: "Small",
          maxScore: 10,
          contributesToReport: false,
        },
        {
          id: "large",
          componentKey: "classroom_work",
          assessmentType: "classwork",
          title: "Large",
          maxScore: 40,
          contributesToReport: false,
        },
      ],
      scores: [
        { assessmentItemId: "small", score: 10 },
        { assessmentItemId: "large", score: 20 },
      ],
    });

    assert.equal(result.rawScore, 30);
    assert.equal(result.rawMaxScore, 50);
    assert.equal(result.rawPercentage, 60);
    assert.equal(result.weightedScore, 18);
  });
});

describe("calculateSubjectResult", () => {
  const componentRules: ComponentRule[] = [
    {
      componentKey: "classroom_work",
      contributionMode: "average_all",
    },
    {
      componentKey: "exam",
      contributionMode: "fixed_required_item",
      requiredAssessmentTypes: ["exam"],
    },
  ];

  it("calculates dynamic multi-component final scores", () => {
    const result = calculateSubjectResult({
      scoreComponents: [classroomComponent, examComponent],
      componentRules,
      items: [
        {
          id: "cw1",
          componentKey: "classroom_work",
          assessmentType: "classwork",
          title: "Class Exercise",
          maxScore: 10,
          contributesToReport: false,
        },
        {
          id: "exam1",
          componentKey: "exam",
          assessmentType: "exam",
          title: "End of Term Exam",
          maxScore: 100,
          contributesToReport: true,
          missingPolicy: "block_submission",
        },
      ],
      scores: [
        { assessmentItemId: "cw1", score: 8.5 },
        { assessmentItemId: "exam1", score: 88 },
      ],
      gradeBoundaries,
      passMark: 50,
      roundingRule: "two_decimals",
    });

    assert.equal(result.components[0]?.weightedScore, 25.5);
    assert.equal(result.components[1]?.weightedScore, 61.6);
    assert.equal(result.finalScore, 87.1);
    assert.equal(result.roundedFinalScore, 87.1);
    assert.equal(result.gradeLabel, "A");
    assert.equal(result.isPassed, true);
    assert.equal(result.blocked, false);
  });

  it("reports missing required items across components", () => {
    const result = calculateSubjectResult({
      scoreComponents: [classroomComponent, examComponent],
      componentRules,
      items: [
        {
          id: "exam1",
          componentKey: "exam",
          assessmentType: "exam",
          title: "End of Term Exam",
          maxScore: 100,
          contributesToReport: true,
          missingPolicy: "block_submission",
        },
      ],
      scores: [{ assessmentItemId: "exam1", score: null, status: "missing" }],
      gradeBoundaries,
      passMark: 50,
      roundingRule: "one_decimal",
    });

    assert.equal(result.blocked, true);
    assert.ok(result.missingRequiredItems.includes("exam1"));
  });
});

describe("validate-assessment-plan", () => {
  it("accepts a valid policy and plan mapping", () => {
    const policy = validateGradingPolicy({
      scoreComponents: [classroomComponent, examComponent],
      gradeBoundaries,
      passMark: 50,
    });
    const plan = validateAssessmentPlan({
      scoreComponents: [classroomComponent, examComponent],
      componentRules: [
        {
          componentKey: "classroom_work",
          contributionMode: "teacher_selected",
          minItems: 2,
        },
        {
          componentKey: "exam",
          contributionMode: "fixed_required_item",
          requiredAssessmentTypes: ["exam"],
        },
      ],
      gradingPolicyStatus: "active",
    });

    assert.equal(policy.valid, true);
    assert.equal(plan.valid, true);
  });

  it("rejects component weights that do not total 100", () => {
    const result = validateGradingPolicy({
      scoreComponents: [
        { ...classroomComponent, weight: 20 },
        { ...examComponent, weight: 60 },
      ],
      gradeBoundaries,
      passMark: 50,
    });

    assert.equal(result.valid, false);
    assert.match(result.errors[0], /must total 100/);
  });

  it("rejects rules that do not map to policy components", () => {
    const result = validateAssessmentPlan({
      scoreComponents: [classroomComponent, examComponent],
      componentRules: [
        {
          componentKey: "project_work",
          contributionMode: "average_all",
        },
        {
          componentKey: "classroom_work",
          contributionMode: "average_all",
        },
        {
          componentKey: "exam",
          contributionMode: "fixed_required_item",
          requiredAssessmentTypes: ["exam"],
        },
      ],
    });

    assert.equal(result.valid, false);
    assert.ok(
      result.errors.some((error) => error.includes("project_work"))
    );
  });
});
