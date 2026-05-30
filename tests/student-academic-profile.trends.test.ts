/**
 * Student Academic Profile — Slice 17 (trends).
 *
 * Run: node --test --import tsx tests/student-academic-profile.trends.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  mapTermHistoryToOverallTrend,
  resolveAcademicTrendsViewData,
  trendSourceLabel,
} from "../src/lib/academics/profile/academic-trends-view-utils";
import { hydrateAcademicProfileTrends } from "../src/lib/academics/profile/hydrate-academic-profile-trends";
import { createEmptyStudentAcademicProfile } from "../src/lib/academics/profile/empty-academic-profile-sections";
import { resolveAcademicProfilePermissions } from "../src/lib/academics/profile/resolve-academic-profile-permissions";
import type { IStudentReportCard } from "../src/models/StudentReportCard";

describe("trendSourceLabel", () => {
  it("labels official and projected sources", () => {
    assert.equal(trendSourceLabel("official_released"), "Official");
    assert.equal(trendSourceLabel("projected_current"), "Projected");
    assert.equal(trendSourceLabel("legacy_fallback"), "Legacy");
  });
});

describe("hydrateAcademicProfileTrends", () => {
  it("merges released report cards into term and subject history", () => {
    const profile = createEmptyStudentAcademicProfile({
      studentId: "s1",
      schoolId: "sc1",
      visibilityMode: "admin",
      permissions: resolveAcademicProfilePermissions({ visibilityMode: "admin" }),
      insightMode: "admin",
      selectedPeriodId: "p2",
      selectedPeriodLabel: "Term 2",
      periods: [
        {
          academicPeriodId: "p1",
          label: "Term 1",
          startDate: "",
          endDate: "",
          isCurrent: false,
          status: "released",
          hasReportCard: true,
          isOfficial: true,
        },
        {
          academicPeriodId: "p2",
          label: "Term 2",
          startDate: "",
          endDate: "",
          isCurrent: true,
          status: "in_progress",
          hasReportCard: false,
          isOfficial: false,
        },
      ],
    });

    profile.summary.projectedAverage = 75;
    profile.permissions.canViewProjectedAverage = true;
    profile.reportStatus.isReleased = false;
    profile.subjectResults = [
      {
        subjectId: "math",
        subjectName: "Mathematics",
        subjectCode: null,
        teacherId: null,
        teacherName: null,
        status: "submitted",
        components: [],
        finalScore: 75,
        roundedFinalScore: 75,
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
      },
    ];

    const releasedCards = [
      {
        academicPeriodId: "p1",
        termSummarySnapshot: { averageFinalScore: 82, classPosition: 2 },
        subjectResultsSnapshot: [
          {
            subjectId: "math",
            roundedFinalScore: 82,
            gradeLabel: "HP",
          },
        ],
      },
    ] as unknown as IStudentReportCard[];

    hydrateAcademicProfileTrends({
      profile,
      releasedCards,
      periodOrder: ["p1", "p2"],
      periodLabelById: new Map([
        ["p1", "Term 1"],
        ["p2", "Term 2"],
      ]),
    });

    assert.equal(profile.trends.termHistory.length, 2);
    assert.equal(profile.trends.termHistory[0]?.source, "official_released");
    assert.equal(profile.trends.termHistory[1]?.source, "projected_current");
    assert.equal(profile.trends.subjectHistory.math?.length, 2);
  });
});

describe("resolveAcademicTrendsViewData", () => {
  it("prefers profile trends over legacy academics history", () => {
    const profile = createEmptyStudentAcademicProfile({
      studentId: "s1",
      schoolId: "sc1",
      visibilityMode: "admin",
      permissions: resolveAcademicProfilePermissions({ visibilityMode: "admin" }),
      insightMode: "admin",
    });

    profile.trends.termHistory = [
      {
        academicPeriodId: "p1",
        label: "Term 1",
        averageScore: 80,
        classPosition: null,
        classAverage: null,
        source: "official_released",
        isOfficial: true,
      },
    ];

    const view = resolveAcademicTrendsViewData({
      profile,
      legacy: {
        multiTermHistory: [
          { termId: "legacy", label: "Legacy Term", averageScore: 50, classAverage: null },
        ],
      },
    });

    assert.equal(view.usesProfileTrends, true);
    assert.equal(view.overallTrend[0]?.source, "official_released");
    assert.equal(view.overallTrend[0]?.sourceLabel, "Official");
  });

  it("maps legacy fallback when profile trends are empty", () => {
    const view = resolveAcademicTrendsViewData({
      profile: null,
      legacy: {
        multiTermHistory: [
          { termId: "t1", label: "2025 • Term 1", averageScore: 68, classAverage: null },
        ],
      },
    });

    assert.equal(view.usesProfileTrends, false);
    assert.equal(view.overallTrend[0]?.source, "legacy_fallback");
  });
});

describe("mapTermHistoryToOverallTrend", () => {
  it("maps chart points with labels", () => {
    const points = mapTermHistoryToOverallTrend([
      {
        academicPeriodId: "p1",
        label: "Term 1",
        averageScore: 90,
        classPosition: null,
        classAverage: null,
        source: "official_released",
        isOfficial: true,
      },
    ]);

    assert.equal(points[0]?.termId, "p1");
    assert.equal(points[0]?.sourceLabel, "Official");
  });
});
