/**
 * Student Academic Profile — Slice 14 (breakdown modal view utils).
 *
 * Run: node --test --import tsx tests/student-academic-profile.assessment-breakdown-view.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatEvidenceScore,
  groupBreakdownItemsByComponent,
  partitionBreakdownEvidence,
  shouldUseLegacyAssessmentBreakdown,
} from "../src/lib/academics/profile/assessment-breakdown-view-utils";
import type { AcademicProfileSubjectBreakdownDTO } from "../src/types/academics/student-academic-profile";

const breakdown: AcademicProfileSubjectBreakdownDTO = {
  studentId: "s1",
  academicPeriodId: "p1",
  subjectId: "sub1",
  subjectName: "Mathematics",
  dataSource: "subject_results",
  isOfficial: false,
  components: [
    {
      componentKey: "classwork",
      label: "Classroom Work",
      weight: 30,
      rawScore: 26,
      rawMaxScore: 30,
      rawPercentage: 86.67,
      weightedScore: 26,
      status: "complete",
    },
    {
      componentKey: "exam",
      label: "Exam",
      weight: 70,
      rawScore: 61.6,
      rawMaxScore: 70,
      rawPercentage: 88,
      weightedScore: 61.6,
      status: "complete",
    },
  ],
  items: [
    {
      assessmentItemId: "item1",
      title: "Quiz 1",
      assessmentType: "quiz",
      componentKey: "classwork",
      componentLabel: "Classroom Work",
      rawScore: 18,
      rawMaxScore: 20,
      rawPercentage: 90,
      isCounted: true,
      isMissing: false,
      contributionMode: "teacher_selected",
      exclusionReason: null,
    },
    {
      assessmentItemId: "item2",
      title: "Practice",
      assessmentType: "homework",
      componentKey: "classwork",
      componentLabel: "Classroom Work",
      rawScore: 8,
      rawMaxScore: 10,
      rawPercentage: 80,
      isCounted: false,
      isMissing: false,
      contributionMode: "teacher_selected",
      exclusionReason: "Not selected by the teacher for this component.",
    },
    {
      assessmentItemId: "missing:exam",
      title: "End of term exam",
      assessmentType: "required",
      componentKey: "exam",
      componentLabel: "Exam",
      rawScore: null,
      rawMaxScore: null,
      rawPercentage: null,
      isCounted: false,
      isMissing: true,
      contributionMode: null,
      exclusionReason: "Required score missing.",
    },
  ],
  calculationExplanation: "Grading policy: JHS Policy.",
};

describe("partitionBreakdownEvidence", () => {
  it("splits counted, non-counted, and missing items", () => {
    const partition = partitionBreakdownEvidence(breakdown.items);
    assert.equal(partition.counted.length, 1);
    assert.equal(partition.nonCounted.length, 1);
    assert.equal(partition.missing.length, 1);
  });
});

describe("groupBreakdownItemsByComponent", () => {
  it("groups evidence under component keys", () => {
    const groups = groupBreakdownItemsByComponent(breakdown.items, breakdown.components);
    assert.equal(groups.length, 2);
    assert.equal(groups[0]?.component.componentKey, "classwork");
    assert.equal(groups[0]?.items.length, 2);
  });
});

describe("formatEvidenceScore", () => {
  it("formats raw score pairs and percentages", () => {
    assert.equal(formatEvidenceScore(breakdown.items[0]!), "18/20");
    const percentageOnly = {
      ...breakdown.items[0]!,
      rawScore: null,
      rawMaxScore: null,
      rawPercentage: 82.5,
    };
    assert.equal(formatEvidenceScore(percentageOnly), "82.5%");
  });
});

describe("shouldUseLegacyAssessmentBreakdown", () => {
  it("falls back when profile breakdown fails", () => {
    assert.equal(
      shouldUseLegacyAssessmentBreakdown({ profileError: true, breakdown: null }),
      true
    );
    assert.equal(
      shouldUseLegacyAssessmentBreakdown({ profileError: false, breakdown }),
      false
    );
  });
});
