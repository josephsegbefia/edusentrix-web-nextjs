/**
 * Student Academic Profile — Slice 8 (breakdown builder).
 *
 * Run: node --test --import tsx tests/student-academic-profile.breakdown.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildCalculationExplanation,
  buildExclusionReason,
  describeContributionMode,
  mapEngineItemsToEvidence,
} from "../src/lib/academics/profile/buildSubjectAcademicProfileBreakdown";
import type { SubjectResultComponentSnapshot } from "../src/types/academics/assessment-engine";

const components: SubjectResultComponentSnapshot[] = [
  {
    componentKey: "classwork",
    label: "Classroom Work",
    weight: 30,
    rawScore: 26,
    rawMaxScore: 30,
    rawPercentage: 86.67,
    weightedScore: 26,
    includedAssessmentItemIds: ["item1"],
    excludedAssessmentItemIds: ["item2"],
    calculationMode: "teacher_selected",
  },
];

describe("describeContributionMode", () => {
  it("explains teacher-selected contribution", () => {
    assert.match(
      describeContributionMode("teacher_selected", "Classroom Work"),
      /teacher selection/i
    );
  });
});

describe("buildExclusionReason", () => {
  it("returns null when counted", () => {
    assert.equal(
      buildExclusionReason({
        isCounted: true,
        isMissing: false,
        contributesToReport: true,
        calculationMode: "teacher_selected",
        componentLabel: "Classroom Work",
      }),
      null
    );
  });

  it("explains missing scores", () => {
    assert.match(
      buildExclusionReason({
        isCounted: false,
        isMissing: true,
        contributesToReport: true,
        calculationMode: "teacher_selected",
        componentLabel: "Classroom Work",
      }) ?? "",
      /not recorded/i
    );
  });
});

describe("mapEngineItemsToEvidence", () => {
  it("marks included and excluded items with contribution modes", () => {
    const evidence = mapEngineItemsToEvidence({
      items: [
        {
          _id: "item1",
          title: "Quiz 1",
          assessmentType: "quiz",
          componentKey: "classwork",
          contributesToReport: true,
          maxScore: 20,
        },
        {
          _id: "item2",
          title: "Practice Set",
          assessmentType: "homework",
          componentKey: "classwork",
          contributesToReport: true,
          maxScore: 10,
        },
      ],
      scoresByItemId: new Map([
        [
          "item1",
          { score: 18, maxScoreSnapshot: 20, percentage: 90, status: "graded" },
        ],
      ]),
      components,
      componentLabelByKey: new Map([["classwork", "Classroom Work"]]),
      missingRequiredLabels: ["End of term exam"],
    });

    const counted = evidence.find((row) => row.assessmentItemId === "item1");
    const excluded = evidence.find((row) => row.assessmentItemId === "item2");
    const missing = evidence.find((row) => row.title === "End of term exam");

    assert.equal(counted?.isCounted, true);
    assert.equal(counted?.isMissing, false);
    assert.equal(excluded?.isCounted, false);
    assert.equal(excluded?.contributionMode, "teacher_selected");
    assert.equal(missing?.isMissing, true);
  });
});

describe("buildCalculationExplanation", () => {
  it("includes policy and contribution notes", () => {
    const explanation = buildCalculationExplanation({
      dataSource: "subject_results",
      components,
      policyName: "JHS Policy",
      assessmentPlanName: "Term 1 Plan",
      isOfficial: false,
    });

    assert.match(explanation, /JHS Policy/);
    assert.match(explanation, /Term 1 Plan/);
    assert.match(explanation, /teacher selection/i);
  });
});
