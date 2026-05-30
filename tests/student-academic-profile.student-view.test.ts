/**
 * Student Academic Profile — Slice 20 student visibility.
 *
 * Run: node --test --import tsx tests/student-academic-profile.student-view.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createEmptyStudentAcademicProfile } from "../src/lib/academics/profile/empty-academic-profile-sections";
import {
  buildLearnerAcademicSummaryCardsFromProfile,
  sanitizeProfileForLearnerView,
} from "../src/lib/academics/profile/learner-academic-profile-utils";
import { resolveAcademicProfilePermissions } from "../src/lib/academics/profile/resolve-academic-profile-permissions";
import { buildReportStatusPanelModel } from "../src/lib/academics/profile/report-status-panel-utils";

describe("student profile sanitization", () => {
  it("removes readiness for student visibility", () => {
    const permissions = resolveAcademicProfilePermissions({
      visibilityMode: "student",
    });
    const profile = createEmptyStudentAcademicProfile({
      studentId: "stu1",
      schoolId: "school1",
      visibilityMode: "student",
      permissions,
      insightMode: "student",
      selectedPeriodId: "period1",
      selectedPeriodLabel: "Term 1",
    });
    profile.reportStatus.readiness = {
      subjectsExpected: 6,
      subjectsSubmitted: 2,
      missingSubjects: [],
      attendanceReady: false,
      issues: [],
    };

    const sanitized = sanitizeProfileForLearnerView(profile);
    assert.equal(sanitized.reportStatus.readiness, null);
    assert.equal(sanitized.visibilityMode, "student");
  });
});

describe("student-friendly summary cards", () => {
  it("uses learner copy without subject submission counts", () => {
    const permissions = resolveAcademicProfilePermissions({
      visibilityMode: "student",
    });
    const profile = createEmptyStudentAcademicProfile({
      studentId: "stu1",
      schoolId: "school1",
      visibilityMode: "student",
      permissions,
      insightMode: "student",
      selectedPeriodId: "period1",
      selectedPeriodLabel: "Term 1",
    });
    profile.recordStatus = "in_progress";
    profile.reportStatus.isReleased = false;
    profile.reportStatus.label = "In progress";
    profile.summary.completedSubjects = 2;
    profile.summary.totalSubjects = 8;

    const cards = buildLearnerAcademicSummaryCardsFromProfile(profile);

    assert.equal(cards.average.title, "Your average so far");
    assert.ok(!cards.reportStatus.subtitle.includes("subjects submitted"));
    assert.ok(cards.reportStatus.subtitle.includes("official report card"));
  });
});

describe("student report status panel", () => {
  it("uses second-person released message", () => {
    const permissions = resolveAcademicProfilePermissions({
      visibilityMode: "student",
    });
    const profile = createEmptyStudentAcademicProfile({
      studentId: "stu1",
      schoolId: "school1",
      visibilityMode: "student",
      permissions,
      insightMode: "student",
      selectedPeriodId: "period1",
      selectedPeriodLabel: "Term 1",
    });
    profile.recordStatus = "released";
    profile.reportStatus.isReleased = true;
    profile.reportStatus.label = "Released";

    const model = buildReportStatusPanelModel(profile);

    assert.ok(model.parentMessage?.includes("Your official report card"));
    assert.equal(model.showStaffDetails, false);
  });
});

describe("student permissions", () => {
  it("denies provisional and readiness by default", () => {
    const student = resolveAcademicProfilePermissions({ visibilityMode: "student" });
    assert.equal(student.canViewProvisionalScores, false);
    assert.equal(student.canViewReadiness, false);
    assert.equal(student.canViewInternalNotes, false);
    assert.equal(student.canGenerateInsights, false);
  });
});
