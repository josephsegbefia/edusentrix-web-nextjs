/**
 * Slice 21 — legacy DTO deprecation helpers.
 *
 * Run: node --test --import tsx tests/student-academic-profile.legacy-dto-deprecation.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createEmptyStudentAcademicProfile } from "../src/lib/academics/profile/empty-academic-profile-sections";
import { resolveAcademicProfilePermissions } from "../src/lib/academics/profile/resolve-academic-profile-permissions";
import {
  mapStudentAcademicProfileToLegacyDTO,
  shouldFetchLegacyStudentAcademics,
} from "../src/lib/academics/compatibility/academic-profile-to-legacy-dto";
import {
  LEGACY_STUDENT_ACADEMICS_CONSUMERS,
  legacyStudentAcademicsDeprecationHeaders,
} from "../src/lib/academics/legacy-student-academics-deprecation";

function emptyProfile(visibilityMode: "admin" | "parent" | "student") {
  const permissions = resolveAcademicProfilePermissions({ visibilityMode });
  return createEmptyStudentAcademicProfile({
    studentId: "stu1",
    schoolId: "school1",
    visibilityMode,
    permissions,
    insightMode: visibilityMode === "admin" ? "admin" : visibilityMode,
    selectedPeriodId: "period1",
    selectedPeriodLabel: "2025 • Term 1",
  });
}

describe("mapStudentAcademicProfileToLegacyDTO", () => {
  it("maps summary and subject rows without readiness", () => {
    const profile = emptyProfile("parent");
    profile.dataSource = "report_snapshot";
    profile.summary.finalAverage = 72.5;
    profile.summary.classPosition = 4;
    profile.summary.totalStudents = 30;
    profile.subjectResults = [
      {
        subjectId: "sub1",
        subjectName: "Mathematics",
        subjectCode: "MATH",
        teacherId: null,
        teacherName: "Mr. A",
        status: "snapshot",
        components: [
          {
            componentKey: "ca",
            label: "Class assessment",
            weight: 40,
            rawScore: 32,
            rawMaxScore: 40,
            rawPercentage: 80,
            weightedScore: 32,
            status: "official",
          },
          {
            componentKey: "exam",
            label: "Exam",
            weight: 60,
            rawScore: 45,
            rawMaxScore: 60,
            rawPercentage: 75,
            weightedScore: 45,
            status: "official",
          },
        ],
        finalScore: 73,
        roundedFinalScore: 73,
        gradeLabel: "B",
        gradePoint: 2,
        descriptor: null,
        isPassed: true,
        subjectPosition: 2,
        totalStudentsForSubject: 30,
        remark: null,
        isOfficial: true,
        hasBreakdown: true,
        issueCount: 0,
      },
    ];

    const legacy = mapStudentAcademicProfileToLegacyDTO(profile);

    assert.equal(legacy.studentId, "stu1");
    assert.equal(legacy.summary.overallAverage, 72.5);
    assert.equal(legacy.dataSource, "assessment_engine");
    assert.equal(legacy.subjects.length, 1);
    assert.equal(legacy.subjects[0]?.caPercentage, 80);
    assert.equal(legacy.subjects[0]?.examPercentage, 75);
    assert.equal(legacy.subjects[0]?.gradeLetter, "B");
    assert.ok(
      legacy.dataSourceNotes?.some((note) => note.includes("compatibility"))
    );
  });
});

describe("shouldFetchLegacyStudentAcademics", () => {
  it("skips legacy fetch when profile has trends and engine data", () => {
    const profile = emptyProfile("admin");
    profile.dataSource = "report_snapshot";
    profile.trends.termHistory = [
      {
        academicPeriodId: "period1",
        label: "Term 1",
        averageScore: 70,
        classPosition: 5,
        classAverage: 68,
        source: "official",
        isOfficial: true,
      },
    ];
    profile.subjectResults = [
      {
        subjectId: "sub1",
        subjectName: "English",
        subjectCode: null,
        teacherId: null,
        teacherName: null,
        status: "snapshot",
        components: [],
        finalScore: 80,
        roundedFinalScore: 80,
        gradeLabel: "A",
        gradePoint: 1,
        descriptor: null,
        isPassed: true,
        subjectPosition: null,
        totalStudentsForSubject: null,
        remark: null,
        isOfficial: true,
        hasBreakdown: false,
        issueCount: 0,
      },
    ];

    assert.equal(shouldFetchLegacyStudentAcademics(profile), false);
  });

  it("requests legacy fetch for legacy or empty profile sources", () => {
    const legacy = emptyProfile("admin");
    legacy.dataSource = "legacy";
    assert.equal(shouldFetchLegacyStudentAcademics(legacy), true);

    const none = emptyProfile("admin");
    none.dataSource = "none";
    assert.equal(shouldFetchLegacyStudentAcademics(none), true);
  });
});

describe("legacyStudentAcademicsDeprecationHeaders", () => {
  it("marks responses as deprecated with successor link", () => {
    const headers = legacyStudentAcademicsDeprecationHeaders("/api/student/academic-profile");
    assert.equal(headers.Deprecation, "true");
    assert.equal(headers["X-Legacy-DTO"], "StudentAcademicsDTO");
    assert.ok(headers.Link.includes("successor-version"));
  });
});

describe("LEGACY_STUDENT_ACADEMICS_CONSUMERS", () => {
  it("documents parent ward route as profile-first", () => {
    assert.equal(
      LEGACY_STUDENT_ACADEMICS_CONSUMERS["api.parent.wards.academics"].status,
      "profile_first"
    );
    assert.equal(
      LEGACY_STUDENT_ACADEMICS_CONSUMERS["api.parent.reports.download.legacy_pdf"].status,
      "profile_first"
    );
  });
});
