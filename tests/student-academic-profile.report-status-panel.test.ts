/**
 * Student Academic Profile — Slice 12 (report status panel).
 *
 * Run: node --test --import tsx tests/student-academic-profile.report-status-panel.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildAcademicProfileReadinessFromSections } from "../src/lib/academics/profile/build-academic-profile-readiness";
import {
  buildAdminReportCardViewHref,
  buildReportStatusPanelModel,
} from "../src/lib/academics/profile/report-status-panel-utils";
import { createEmptyStudentAcademicProfile } from "../src/lib/academics/profile/empty-academic-profile-sections";
import { resolveAcademicProfilePermissions } from "../src/lib/academics/profile/resolve-academic-profile-permissions";
import type { StudentAcademicProfileDTO } from "../src/types/academics/student-academic-profile";

function baseProfile(
  overrides: Partial<StudentAcademicProfileDTO> = {}
): StudentAcademicProfileDTO {
  const profile = createEmptyStudentAcademicProfile({
    studentId: "507f1f77bcf86cd799439011",
    schoolId: "507f1f77bcf86cd799439012",
    visibilityMode: "admin",
    insightMode: "admin",
    recordStatus: "in_progress",
    permissions: resolveAcademicProfilePermissions({ visibilityMode: "admin" }),
    selectedPeriodId: "507f1f77bcf86cd799439013",
    selectedPeriodLabel: "Term 1",
  });

  return {
    ...profile,
    dataSource: "subject_results",
    reportStatus: {
      ...profile.reportStatus,
      status: "in_progress",
      label: "In progress",
      isProvisional: true,
      readiness: {
        subjectsExpected: 2,
        subjectsSubmitted: 1,
        subjectsApproved: 0,
        missingSubjects: [
          {
            subjectId: "sub2",
            subjectName: "French",
            reason: "Not yet submitted",
          },
        ],
        missingRequiredScores: [],
        attendanceReady: false,
        commentsReady: false,
        issues: [],
      },
    },
    subjectResults: [
      {
        subjectId: "sub1",
        subjectName: "Mathematics",
        subjectCode: null,
        teacherId: null,
        teacherName: null,
        status: "submitted",
        components: [],
        finalScore: 80,
        roundedFinalScore: 80,
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
      {
        subjectId: "sub2",
        subjectName: "French",
        subjectCode: null,
        teacherId: null,
        teacherName: null,
        status: "draft",
        components: [],
        finalScore: null,
        roundedFinalScore: null,
        gradeLabel: null,
        gradePoint: null,
        descriptor: null,
        isPassed: null,
        subjectPosition: null,
        totalStudentsForSubject: null,
        remark: null,
        isOfficial: false,
        hasBreakdown: false,
        issueCount: 1,
      },
    ],
    summary: {
      ...profile.summary,
      totalSubjects: 2,
      completedSubjects: 1,
      missingSubjects: 1,
    },
    ...overrides,
  };
}

describe("buildAcademicProfileReadinessFromSections", () => {
  it("flags missing subjects and pending attendance", () => {
    const readiness = buildAcademicProfileReadinessFromSections({
      subjectResults: baseProfile().subjectResults,
      comments: { subjectComments: [], classTeacherComment: null, headteacherComment: null, conduct: null, interest: null, attitude: null },
      attendance: {
        source: "none",
        isSnapshot: false,
        totalSchoolDays: null,
        daysPresent: null,
        daysAbsent: null,
        daysLate: null,
        daysExcused: null,
        attendancePercentage: null,
        calculatedAt: null,
        note: null,
      },
      recordStatus: "in_progress",
    });

    assert.equal(readiness.subjectsSubmitted, 1);
    assert.equal(readiness.missingSubjects.length, 1);
    assert.equal(readiness.attendanceReady, false);
  });
});

describe("buildReportStatusPanelModel", () => {
  it("shows staff readiness rows for admin in-progress reports", () => {
    const model = buildReportStatusPanelModel(baseProfile());
    assert.equal(model.showStaffDetails, true);
    assert.ok(model.rows.some((row) => row.label === "Subjects submitted"));
    assert.ok(model.rows.some((row) => row.label === "Missing subjects"));
    assert.equal(model.parentMessage, null);
    assert.equal(model.actions.canDownload, false);
  });

  it("shows released details and download only when available", () => {
    const model = buildReportStatusPanelModel(
      baseProfile({
        recordStatus: "released",
        reportStatus: {
          ...baseProfile().reportStatus,
          status: "released",
          label: "Released",
          isReleased: true,
          isOfficial: true,
          isProvisional: false,
          releasedAt: "2026-08-14T00:00:00.000Z",
          readiness: null,
        },
        reportCard: {
          status: "released",
          canView: true,
          canDownload: true,
          downloadUrl: "https://cdn.example.com/report.pdf",
          verificationId: "EDU-1234",
          releasedAt: "2026-08-14T00:00:00.000Z",
          templateName: "Term report",
        },
      })
    );

    assert.ok(model.rows.some((row) => row.label === "Verification ID"));
    assert.equal(model.actions.canDownload, true);
    assert.equal(model.actions.downloadUrl, "https://cdn.example.com/report.pdf");
    assert.ok(model.actions.viewHref?.includes("academicPeriodId="));
  });

  it("shows a simple pending message for parents without download", () => {
    const model = buildReportStatusPanelModel(
      baseProfile({
        visibilityMode: "parent",
        permissions: resolveAcademicProfilePermissions({ visibilityMode: "parent" }),
      })
    );

    assert.equal(model.showStaffDetails, false);
    assert.match(model.parentMessage ?? "", /no released report/i);
    assert.equal(model.actions.canDownload, false);
    assert.equal(model.rows.length, 0);
  });

  it("allows parent download when report is released", () => {
    const model = buildReportStatusPanelModel(
      baseProfile({
        visibilityMode: "parent",
        permissions: resolveAcademicProfilePermissions({ visibilityMode: "parent" }),
        reportStatus: {
          ...baseProfile().reportStatus,
          isReleased: true,
          status: "released",
          label: "Released",
        },
        reportCard: {
          status: "released",
          canView: false,
          canDownload: true,
          downloadUrl: "https://cdn.example.com/report.pdf",
          verificationId: null,
          releasedAt: "2026-08-14T00:00:00.000Z",
          templateName: null,
        },
      })
    );

    assert.equal(model.actions.canDownload, true);
    assert.equal(model.actions.canView, false);
  });
});

describe("buildAdminReportCardViewHref", () => {
  it("builds admin preview link with required query params", () => {
    const href = buildAdminReportCardViewHref({
      studentId: "student1",
      academicPeriodId: "period1",
    });
    assert.equal(
      href,
      "/admin/reports/cards/view?studentId=student1&academicPeriodId=period1"
    );
  });
});
