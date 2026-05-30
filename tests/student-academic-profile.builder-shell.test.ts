/**
 * Student Academic Profile — Slice 2 shell (permissions + empty profile).
 *
 * Run: node --test --import tsx tests/student-academic-profile.builder-shell.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createEmptyStudentAcademicProfile } from "../src/lib/academics/profile/empty-academic-profile-sections";
import {
  resolveAcademicProfileInsightMode,
  resolveAcademicProfilePermissions,
} from "../src/lib/academics/profile/resolve-academic-profile-permissions";
import { formatAcademicPeriodLabel } from "../src/lib/academics/profile/academic-profile-periods";

describe("resolveAcademicProfilePermissions", () => {
  it("grants staff provisional and readiness access", () => {
    const admin = resolveAcademicProfilePermissions({ visibilityMode: "admin" });
    assert.equal(admin.canViewProvisionalScores, true);
    assert.equal(admin.canViewReadiness, true);
    assert.equal(admin.canViewInternalNotes, true);

    const homeroom = resolveAcademicProfilePermissions({
      visibilityMode: "homeroom_teacher",
    });
    assert.equal(homeroom.canViewReadiness, true);
    assert.equal(homeroom.canViewInternalNotes, false);
  });

  it("restricts parent/student unless progress visibility is enabled", () => {
    const parent = resolveAcademicProfilePermissions({ visibilityMode: "parent" });
    assert.equal(parent.canViewProvisionalScores, false);
    assert.equal(parent.canViewProjectedAverage, false);
    assert.equal(parent.canViewReadiness, false);

    const parentProgress = resolveAcademicProfilePermissions({
      visibilityMode: "parent",
      allowProgressVisibility: true,
    });
    assert.equal(parentProgress.canViewProvisionalScores, true);
    assert.equal(parentProgress.canViewBreakdown, true);
  });

  it("scopes subject teacher visible subjects", () => {
    const teacher = resolveAcademicProfilePermissions({
      visibilityMode: "subject_teacher",
      allowedSubjectIds: ["sub1", "sub2"],
    });
    assert.deepEqual(teacher.visibleSubjectIds, ["sub1", "sub2"]);
  });
});

describe("resolveAcademicProfileInsightMode", () => {
  it("maps staff roles to teacher insight mode", () => {
    assert.equal(
      resolveAcademicProfileInsightMode("homeroom_teacher"),
      "teacher"
    );
    assert.equal(resolveAcademicProfileInsightMode("admin"), "admin");
  });
});

describe("createEmptyStudentAcademicProfile", () => {
  it("returns a complete safe empty profile", () => {
    const profile = createEmptyStudentAcademicProfile({
      studentId: "student1",
      schoolId: "school1",
      visibilityMode: "admin",
      permissions: resolveAcademicProfilePermissions({ visibilityMode: "admin" }),
      insightMode: "admin",
      selectedPeriodId: "period1",
      selectedPeriodLabel: "2025 • Term 1",
    });

    assert.equal(profile.studentId, "student1");
    assert.equal(profile.dataSource, "none");
    assert.equal(profile.recordStatus, "no_data");
    assert.equal(profile.subjectResults.length, 0);
    assert.equal(profile.selectedPeriod.academicPeriodId, "period1");
    assert.equal(profile.attendance.source, "none");
    assert.equal(profile.reportCard.canDownload, false);
  });
});

describe("formatAcademicPeriodLabel", () => {
  it("formats year and term", () => {
    assert.equal(
      formatAcademicPeriodLabel({ yearLabel: "2025/2026", term: "Term 1" }),
      "2025/2026 • Term 1"
    );
  });
});
