/**
 * Student Academic Profile — Slice 18 (Leo AI context).
 *
 * Run: node --test --import tsx tests/student-academic-profile.ai-insights-context.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildAcademicAIInsightsContext,
  buildAcademicAIInsightsSystemPrompt,
  profileHasAcademicInsightData,
} from "../src/lib/academics/profile/build-academic-ai-insights-context";
import { createEmptyStudentAcademicProfile } from "../src/lib/academics/profile/empty-academic-profile-sections";
import { resolveAcademicProfilePermissions } from "../src/lib/academics/profile/resolve-academic-profile-permissions";

function baseProfile() {
  const profile = createEmptyStudentAcademicProfile({
    studentId: "s1",
    schoolId: "sc1",
    visibilityMode: "admin",
    insightMode: "admin",
    permissions: resolveAcademicProfilePermissions({ visibilityMode: "admin" }),
    selectedPeriodId: "p1",
    selectedPeriodLabel: "Term 1",
  });

  profile.dataSource = "subject_results";
  profile.recordStatus = "in_progress";
  profile.reportStatus.label = "In progress";
  profile.summary.projectedAverage = 74;
  profile.summary.overallAverage = 74;
  profile.permissions.canViewProjectedAverage = true;
  profile.subjectResults = [
    {
      subjectId: "math",
      subjectName: "Mathematics",
      subjectCode: null,
      teacherId: null,
      teacherName: null,
      status: "submitted",
      components: [
        {
          componentKey: "classwork",
          label: "Classroom Work",
          weight: 30,
          rawScore: 26,
          rawMaxScore: 30,
          rawPercentage: 86.7,
          weightedScore: 26,
          status: "complete",
        },
        {
          componentKey: "exam",
          label: "Exam",
          weight: 70,
          rawScore: 48,
          rawMaxScore: 70,
          rawPercentage: 68.6,
          weightedScore: 48,
          status: "complete",
        },
      ],
      finalScore: 74,
      roundedFinalScore: 74,
      gradeLabel: "HP",
      gradePoint: null,
      descriptor: null,
      isPassed: true,
      subjectPosition: null,
      totalStudentsForSubject: null,
      remark: "Strong class participation",
      isOfficial: false,
      hasBreakdown: true,
      issueCount: 0,
    },
  ];
  profile.assessmentEvidenceSummary = {
    countedItemsTotal: 4,
    nonCountedItemsTotal: 1,
    missingItemsTotal: 1,
    subjectsWithMissingEvidence: [
      { subjectId: "sci", subjectName: "Science", missingCount: 1 },
    ],
  };
  profile.attendance = {
    source: "live_homeroom_attendance",
    isSnapshot: false,
    totalSchoolDays: 40,
    daysPresent: 36,
    daysAbsent: 3,
    daysLate: 1,
    daysExcused: 0,
    attendancePercentage: 90,
    calculatedAt: null,
    note: null,
  };
  profile.reportStatus.readiness = {
    subjectsExpected: 2,
    subjectsSubmitted: 1,
    subjectsApproved: 0,
    missingSubjects: [{ subjectId: "sci", subjectName: "Science", reason: "Not submitted" }],
    missingRequiredScores: [],
    attendanceReady: true,
    commentsReady: false,
    issues: [],
  };

  return profile;
}

describe("profileHasAcademicInsightData", () => {
  it("requires scored subject or summary data", () => {
    assert.equal(profileHasAcademicInsightData(baseProfile()), true);
    const empty = baseProfile();
    empty.subjectResults = [];
    empty.summary.projectedAverage = null;
    empty.summary.overallAverage = null;
    assert.equal(profileHasAcademicInsightData(empty), false);
  });
});

describe("buildAcademicAIInsightsContext", () => {
  it("includes components, evidence, attendance, and readiness", () => {
    const context = buildAcademicAIInsightsContext(baseProfile(), "Ama Mensah");

    assert.match(context, /Ama Mensah/);
    assert.match(context, /Insight mode: admin/);
    assert.match(context, /Classroom Work \(30%\)/);
    assert.match(context, /Counted assessment items: 4/);
    assert.match(context, /Missing subjects: Science/);
    assert.match(context, /Attendance rate: 90\.0%/);
    assert.match(context, /Do not invent/);
  });

  it("labels projected averages for in-progress periods", () => {
    const context = buildAcademicAIInsightsContext(baseProfile(), "Student");
    assert.match(context, /Projected average: 74\.0%/);
    assert.doesNotMatch(context, /Final average/);
  });

  it("uses final average when report is released", () => {
    const profile = baseProfile();
    profile.reportStatus.isReleased = true;
    profile.summary.finalAverage = 82;
    const context = buildAcademicAIInsightsContext(profile, "Student");
    assert.match(context, /Final average: 82\.0%/);
  });
});

describe("buildAcademicAIInsightsSystemPrompt", () => {
  it("scopes guidance by insight mode", () => {
    assert.match(buildAcademicAIInsightsSystemPrompt("admin"), /readiness blockers/i);
    assert.match(buildAcademicAIInsightsSystemPrompt("parent"), /parent-friendly/i);
    assert.match(buildAcademicAIInsightsSystemPrompt("student"), /student-friendly/i);
  });
});
