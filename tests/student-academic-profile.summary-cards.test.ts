/**
 * Student Academic Profile — Slice 11 (summary cards).
 *
 * Run: node --test --import tsx tests/student-academic-profile.summary-cards.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildAcademicSummaryCardsFromLegacySummary,
  buildAcademicSummaryCardsFromProfile,
} from "../src/lib/academics/profile/academic-summary-cards-utils";
import { createEmptyStudentAcademicProfile } from "../src/lib/academics/profile/empty-academic-profile-sections";
import { resolveAcademicProfilePermissions } from "../src/lib/academics/profile/resolve-academic-profile-permissions";
import type { StudentAcademicProfileDTO } from "../src/types/academics/student-academic-profile";

function baseProfile(
  overrides: Partial<StudentAcademicProfileDTO> = {}
): StudentAcademicProfileDTO {
  const profile = createEmptyStudentAcademicProfile({
    studentId: "student1",
    schoolId: "school1",
    schoolLevel: "JHS",
    visibilityMode: "admin",
    insightMode: "admin",
    recordStatus: "in_progress",
    permissions: resolveAcademicProfilePermissions({ visibilityMode: "admin" }),
    selectedPeriodId: "p1",
    selectedPeriodLabel: "Term 1",
  });

  return {
    ...profile,
    dataSource: "subject_results",
    summary: {
      ...profile.summary,
      overallAverage: 72,
      projectedAverage: 74.5,
      finalAverage: null,
      classPosition: 5,
      totalStudents: 30,
      totalSubjects: 8,
      completedSubjects: 6,
      missingSubjects: 2,
      performanceTier: "average",
      trend: "up",
      trendDelta: 2.1,
    },
    reportStatus: {
      ...profile.reportStatus,
      status: "in_progress",
      label: "In progress",
      isProvisional: true,
      readiness: {
        subjectsExpected: 8,
        subjectsSubmitted: 6,
        subjectsApproved: 4,
        missingSubjects: [],
        missingRequiredScores: [],
        attendanceReady: true,
        commentsReady: false,
        issues: [],
      },
    },
    attendance: {
      ...profile.attendance,
      source: "live_homeroom_attendance",
      attendancePercentage: 91.2,
      totalSchoolDays: 50,
      daysPresent: 46,
      daysAbsent: 3,
      daysLate: 1,
      daysExcused: 0,
    },
    ...overrides,
  };
}

describe("buildAcademicSummaryCardsFromProfile", () => {
  it("shows projected average for staff in-progress reports", () => {
    const cards = buildAcademicSummaryCardsFromProfile(baseProfile());
    assert.equal(cards.average.title, "Projected average");
    assert.equal(cards.average.value, "74.5%");
    assert.match(cards.average.subtitle, /provisional/i);
    assert.equal(cards.reportStatus.value, "In progress");
    assert.match(cards.reportStatus.subtitle, /6 of 8 subjects/);
    assert.equal(cards.reportStatus.statusTone, "in_progress");
  });

  it("shows final average and official position when released", () => {
    const cards = buildAcademicSummaryCardsFromProfile(
      baseProfile({
        recordStatus: "released",
        summary: {
          ...baseProfile().summary,
          finalAverage: 82,
          overallAverage: 82,
          projectedAverage: 79,
        },
        reportStatus: {
          ...baseProfile().reportStatus,
          status: "released",
          label: "Released",
          isReleased: true,
          isOfficial: true,
          isProvisional: false,
          releasedAt: "2026-05-01T00:00:00.000Z",
        },
      })
    );
    assert.equal(cards.average.title, "Final average");
    assert.equal(cards.average.value, "82.0%");
    assert.equal(cards.position.title, "Official position");
    assert.equal(cards.reportStatus.statusTone, "released");
  });

  it("hides projected average when viewer cannot see provisional scores", () => {
    const cards = buildAcademicSummaryCardsFromProfile(
      baseProfile({
        visibilityMode: "parent",
        permissions: resolveAcademicProfilePermissions({
          visibilityMode: "parent",
        }),
      })
    );
    assert.equal(cards.average.title, "Overall average");
    assert.equal(cards.average.value, "72.0%");
    assert.notEqual(cards.average.title, "Projected average");
  });

  it("includes attendance rate from profile attendance", () => {
    const cards = buildAcademicSummaryCardsFromProfile(baseProfile());
    assert.equal(cards.attendance.value, "91.2%");
    assert.match(cards.attendance.subtitle, /homeroom/i);
  });
});

describe("buildAcademicSummaryCardsFromLegacySummary", () => {
  it("provides four legacy fallback cards including placeholder attendance", () => {
    const cards = buildAcademicSummaryCardsFromLegacySummary({
      periodLabel: "2025 • Term 1",
      summary: {
        overallAverage: 68,
        classPosition: 2,
        totalStudents: 25,
        performanceTier: "top",
        trend: "stable",
        trendDelta: null,
      },
    });
    assert.equal(cards.average.value, "68.0%");
    assert.equal(cards.position.value, "#2");
    assert.equal(cards.attendance.value, "--");
    assert.equal(cards.reportStatus.value, "Legacy data");
  });
});
