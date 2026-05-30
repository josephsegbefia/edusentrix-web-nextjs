/**
 * Student Academic Profile — Slice 19 parent visibility.
 *
 * Run: node --test --import tsx tests/student-academic-profile.parent-view.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createEmptyStudentAcademicProfile } from "../src/lib/academics/profile/empty-academic-profile-sections";
import { sanitizeProfileForLearnerView } from "../src/lib/academics/profile/learner-academic-profile-utils";
import { resolveAcademicProfilePermissions } from "../src/lib/academics/profile/resolve-academic-profile-permissions";
import { buildReportStatusPanelModel } from "../src/lib/academics/profile/report-status-panel-utils";

describe("sanitizeProfileForLearnerView", () => {
  it("strips staff readiness and internal notes", () => {
    const permissions = resolveAcademicProfilePermissions({
      visibilityMode: "parent",
    });
    const profile = createEmptyStudentAcademicProfile({
      studentId: "ward1",
      schoolId: "school1",
      visibilityMode: "parent",
      permissions,
      insightMode: "parent",
      selectedPeriodId: "period1",
      selectedPeriodLabel: "Term 1",
    });

    profile.reportStatus.readiness = {
      subjectsExpected: 8,
      subjectsSubmitted: 3,
      missingSubjects: [],
      attendanceReady: false,
      issues: [],
    };
    profile.comments.internalNotes = "Do not share with parent";

    const sanitized = sanitizeProfileForLearnerView(profile);

    assert.equal(sanitized.reportStatus.readiness, null);
    assert.equal(
      (sanitized.comments as { internalNotes?: string }).internalNotes,
      undefined
    );
    assert.equal(sanitized.comments.classTeacherComment, null);
  });
});

describe("parent report status panel", () => {
  it("does not expose staff readiness rows", () => {
    const permissions = resolveAcademicProfilePermissions({
      visibilityMode: "parent",
    });
    const profile = createEmptyStudentAcademicProfile({
      studentId: "ward1",
      schoolId: "school1",
      visibilityMode: "parent",
      permissions,
      insightMode: "parent",
      selectedPeriodId: "period1",
      selectedPeriodLabel: "Term 1",
    });

    profile.recordStatus = "released";
    profile.reportStatus.isReleased = true;
    profile.reportStatus.label = "Released";
    profile.reportStatus.studentReportCardId = "card1";

    const model = buildReportStatusPanelModel(profile);

    assert.equal(model.showStaffDetails, false);
    assert.equal(model.rows.length, 0);
    assert.ok(model.parentMessage?.includes("released"));
    assert.equal(model.actions.canView, false);
    assert.equal(model.actions.canDownload, true);
  });

  it("blocks download when report is not released", () => {
    const permissions = resolveAcademicProfilePermissions({
      visibilityMode: "parent",
    });
    const profile = createEmptyStudentAcademicProfile({
      studentId: "ward1",
      schoolId: "school1",
      visibilityMode: "parent",
      permissions,
      insightMode: "parent",
      selectedPeriodId: "period1",
      selectedPeriodLabel: "Term 1",
    });

    profile.recordStatus = "in_progress";
    profile.reportStatus.isReleased = false;

    const model = buildReportStatusPanelModel(profile);

    assert.equal(model.actions.canDownload, false);
    assert.ok(model.parentMessage?.includes("No released report card"));
  });
});

describe("parent permissions", () => {
  it("denies provisional and readiness by default", () => {
    const parent = resolveAcademicProfilePermissions({ visibilityMode: "parent" });
    assert.equal(parent.canViewProvisionalScores, false);
    assert.equal(parent.canViewReadiness, false);
    assert.equal(parent.canViewInternalNotes, false);
    assert.equal(parent.canViewBreakdown, false);
  });
});
