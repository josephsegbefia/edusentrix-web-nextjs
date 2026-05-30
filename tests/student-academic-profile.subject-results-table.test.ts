/**
 * Student Academic Profile — Slice 13 (dynamic subject results table).
 *
 * Run: node --test --import tsx tests/student-academic-profile.subject-results-table.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_SUBJECT_TABLE_COMPONENT_COLUMNS,
  formatComponentCellValue,
  resolveSubjectResultStatusBadge,
  resolveSubjectResultsTableLayout,
} from "../src/lib/academics/profile/subject-results-table-utils";
import type { AcademicProfileSubjectResultDTO } from "../src/types/academics/student-academic-profile";

function component(
  key: string,
  label: string,
  weight: number,
  weightedScore: number | null = 10
) {
  return {
    componentKey: key,
    label,
    weight,
    rawScore: null,
    rawMaxScore: null,
    rawPercentage: null,
    weightedScore,
    status: "complete" as const,
  };
}

function subjectRow(
  overrides: Partial<AcademicProfileSubjectResultDTO> = {}
): AcademicProfileSubjectResultDTO {
  return {
    subjectId: "sub1",
    subjectName: "Mathematics",
    subjectCode: "MATH",
    teacherId: null,
    teacherName: "Ms. Ama",
    status: "submitted",
    components: [component("classwork", "Classroom Work", 30), component("exam", "Exam", 70)],
    finalScore: 88,
    roundedFinalScore: 88,
    gradeLabel: "HP",
    gradePoint: null,
    descriptor: null,
    isPassed: true,
    subjectPosition: null,
    totalStudentsForSubject: null,
    remark: null,
    isOfficial: false,
    hasBreakdown: true,
    issueCount: 0,
    ...overrides,
  };
}

describe("resolveSubjectResultsTableLayout", () => {
  it("uses column layout when component count is within limit", () => {
    const layout = resolveSubjectResultsTableLayout([subjectRow()]);
    assert.equal(layout.mode, "columns");
    if (layout.mode === "columns") {
      assert.equal(layout.columns.length, 2);
      assert.equal(layout.columns[0]?.componentKey, "exam");
      assert.equal(layout.columns[1]?.componentKey, "classwork");
    }
  });

  it("switches to compact chips when too many components", () => {
    const manyComponents = Array.from({ length: MAX_SUBJECT_TABLE_COMPONENT_COLUMNS + 1 }, (_, index) =>
      component(`c${index}`, `Component ${index}`, 10 - index)
    );
    const layout = resolveSubjectResultsTableLayout([
      subjectRow({ components: manyComponents }),
    ]);
    assert.equal(layout.mode, "compact");
  });
});

describe("formatComponentCellValue", () => {
  it("prefers weighted score then percentage", () => {
    assert.equal(formatComponentCellValue(component("exam", "Exam", 70, 61.6)), "61.6");
    assert.equal(
      formatComponentCellValue({
        ...component("hw", "Homework", 10, null),
        weightedScore: null,
        rawPercentage: 82.5,
      }),
      "82.5%"
    );
  });
});

describe("resolveSubjectResultStatusBadge", () => {
  it("marks released snapshot rows as official", () => {
    const badge = resolveSubjectResultStatusBadge({
      row: subjectRow({ status: "snapshot", isOfficial: true }),
      periodIsReleased: true,
    });
    assert.equal(badge.label, "Official");
    assert.equal(badge.variant, "official");
  });

  it("marks draft subject results as provisional", () => {
    const badge = resolveSubjectResultStatusBadge({
      row: subjectRow({ status: "draft", isOfficial: false }),
    });
    assert.equal(badge.label, "Provisional");
    assert.equal(badge.variant, "provisional");
  });
});
