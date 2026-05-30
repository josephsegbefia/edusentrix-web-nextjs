/**
 * Subject result compatibility adapters — Slice 22.
 *
 * Run: node --test --import tsx tests/assessment-engine.subject-result-adapters.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeTermOverviewFromSubjectResults,
  deriveLegacyComponentPercentages,
  legacyGradeToPerformanceRow,
  mergeSubjectPerformanceRows,
  mergeTermOverview,
  resolveAcademicsDataSource,
  subjectResultToPerformanceRow,
} from "../src/lib/academics/compatibility/subject-result-adapters";

describe("deriveLegacyComponentPercentages", () => {
  it("maps classwork and exam components to CA/exam percentages", () => {
    const result = deriveLegacyComponentPercentages([
      {
        componentKey: "classwork",
        label: "Classwork",
        weight: 30,
        rawScore: 24,
        rawMaxScore: 30,
        rawPercentage: 80,
        weightedScore: 24,
      },
      {
        componentKey: "exam",
        label: "Exam",
        weight: 70,
        rawScore: 63,
        rawMaxScore: 70,
        rawPercentage: 90,
        weightedScore: 63,
      },
    ]);

    assert.equal(result.caPercentage, 80);
    assert.equal(result.examPercentage, 90);
  });
});

describe("subjectResultToPerformanceRow", () => {
  it("maps gradeLabel to gradeLetter for legacy table compatibility", () => {
    const row = subjectResultToPerformanceRow(
      {
        subjectId: "507f1f77bcf86cd799439011",
        roundedFinalScore: 88.1,
        gradeLabel: "HP",
        gradePoint: 1,
        isPassed: true,
        status: "approved",
        components: [],
      },
      {
        subjectId: "507f1f77bcf86cd799439011",
        subjectName: "Mathematics",
        shortCode: "MATH",
        teacherName: "Jane Doe",
      }
    );

    assert.equal(row.subjectName, "Mathematics");
    assert.equal(row.totalScore, 88.1);
    assert.equal(row.gradeLetter, "HP");
    assert.equal(row.isPassed, true);
  });
});

describe("mergeSubjectPerformanceRows", () => {
  it("prefers engine rows and fills missing subjects from legacy", () => {
    const merged = mergeSubjectPerformanceRows(
      [
        {
          subjectId: "a",
          subjectName: "Math",
          shortCode: "MATH",
          teacherName: null,
          caPercentage: 80,
          examPercentage: 90,
          totalScore: 87,
          gradeLetter: "HP",
          gradePoint: 1,
          isPassed: true,
        },
      ],
      [
        {
          subjectId: "a",
          subjectName: "Math Legacy",
          shortCode: null,
          teacherName: null,
          caPercentage: 70,
          examPercentage: 70,
          totalScore: 70,
          gradeLetter: "P",
          gradePoint: 2,
          isPassed: true,
        },
        {
          subjectId: "b",
          subjectName: "English",
          shortCode: "ENG",
          teacherName: null,
          caPercentage: 60,
          examPercentage: 65,
          totalScore: 63,
          gradeLetter: "AP",
          gradePoint: 3,
          isPassed: true,
        },
      ]
    );

    assert.equal(merged.rows.length, 2);
    assert.equal(merged.rows[0]?.subjectName, "English");
    assert.equal(merged.rows[1]?.totalScore, 87);
    assert.equal(merged.subjectRowsFromEngine, 1);
    assert.equal(merged.subjectRowsFromLegacy, 1);
  });
});

describe("computeTermOverviewFromSubjectResults", () => {
  it("computes average from complete subject results only", () => {
    const overview = computeTermOverviewFromSubjectResults({
      termId: "term-1",
      label: "2025 • Term 1",
      results: [
        {
          subjectId: "a",
          roundedFinalScore: 80,
          status: "approved",
        },
        {
          subjectId: "b",
          roundedFinalScore: 60,
          status: "draft",
        },
      ],
    });

    assert.ok(overview);
    assert.equal(overview?.averageScore, 80);
    assert.equal(overview?.totalSubjects, 1);
    assert.equal(overview?.performanceTier, "top");
  });
});

describe("mergeTermOverview", () => {
  it("keeps legacy class position while preferring engine averages", () => {
    const merged = mergeTermOverview(
      {
        termId: "term-1",
        label: "2025 • Term 1",
        averageScore: 82,
        classPosition: null,
        totalSubjects: 6,
        performanceTier: "top",
      },
      {
        termId: "term-1",
        label: "2025 • Term 1",
        averageScore: 70,
        classPosition: 4,
        totalSubjects: 5,
        performanceTier: "above_average",
      }
    );

    assert.equal(merged.averageScore, 82);
    assert.equal(merged.classPosition, 4);
    assert.equal(merged.totalSubjects, 6);
  });
});

describe("resolveAcademicsDataSource", () => {
  it("returns mixed when both engine and legacy rows are present", () => {
    const resolved = resolveAcademicsDataSource({
      subjectRowsFromEngine: 2,
      subjectRowsFromLegacy: 1,
      summaryFromEngine: true,
      summaryFromLegacy: false,
    });

    assert.equal(resolved.dataSource, "mixed");
    assert.match(resolved.dataSourceNotes[0] ?? "", /legacy gradebook/i);
  });

  it("returns legacy when only legacy data is available", () => {
    const resolved = resolveAcademicsDataSource({
      subjectRowsFromEngine: 0,
      subjectRowsFromLegacy: 4,
      summaryFromEngine: false,
      summaryFromLegacy: true,
    });

    assert.equal(resolved.dataSource, "legacy");
  });
});

describe("legacyGradeToPerformanceRow", () => {
  it("maps legacy SubjectGrade fields into table row shape", () => {
    const row = legacyGradeToPerformanceRow({
      subjectId: "507f1f77bcf86cd799439011",
      subjectName: "Science",
      shortCode: "SCI",
      totalScore: 72,
      gradeLetter: "P",
      isPassed: true,
    });

    assert.equal(row.subjectName, "Science");
    assert.equal(row.totalScore, 72);
    assert.equal(row.gradeLetter, "P");
  });
});
