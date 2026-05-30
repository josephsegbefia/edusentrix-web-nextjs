/**
 * Student Academic Profile — Slice 3 (report card snapshot mapping).
 *
 * Run: node --test --import tsx tests/student-academic-profile.from-report-card.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { buildStudentReportCardViewData } from "../src/lib/academics/reporting/build-student-report-card-view";
import {
  applyReportCardViewToAcademicProfile,
  mapStudentReportCardStatusToRecordStatus,
  resolveReportCardStatusesForViewer,
} from "../src/lib/academics/profile/buildProfileFromReportCard";
import { createEmptyStudentAcademicProfile } from "../src/lib/academics/profile/empty-academic-profile-sections";
import { resolveAcademicProfilePermissions } from "../src/lib/academics/profile/resolve-academic-profile-permissions";
import type { IStudentReportCard } from "../src/models/StudentReportCard";

const subjectId = "507f1f77bcf86cd799439011";

const card = {
  _id: new mongoose.Types.ObjectId(),
  schoolId: new mongoose.Types.ObjectId(),
  academicPeriodId: new mongoose.Types.ObjectId(),
  reportCardRunId: new mongoose.Types.ObjectId(),
  studentId: new mongoose.Types.ObjectId(),
  classGroupId: new mongoose.Types.ObjectId(),
  gradeId: new mongoose.Types.ObjectId(),
  gradingPolicySnapshot: {
    name: "JHS Policy",
    scoreComponents: [
      { key: "classwork", label: "Classroom Work", weight: 30, order: 0, required: true },
      { key: "exam", label: "Exam", weight: 70, order: 1, required: true },
    ],
    gradeBoundaries: [],
  },
  assessmentPlanSnapshot: {},
  reportTemplateSnapshot: { name: "Term report card", sections: [] },
  studentSnapshot: { name: "Ama Mensah" },
  schoolSnapshot: { name: "Demo School" },
  attendanceSnapshot: {
    ready: true,
    totalSchoolDays: 60,
    daysPresent: 54,
    daysAbsent: 4,
    daysLate: 1,
    daysExcused: 1,
    attendancePercentage: 90,
  },
  subjectResultsSnapshot: [
    {
      subjectId,
      finalScore: 88.1,
      roundedFinalScore: 88.1,
      gradeLabel: "HP",
      isPassed: true,
      components: [
        {
          componentKey: "classwork",
          label: "Classroom Work",
          weight: 30,
          rawScore: 26.5,
          rawMaxScore: 30,
          rawPercentage: 88.33,
          weightedScore: 26.5,
        },
        {
          componentKey: "exam",
          label: "Exam",
          weight: 70,
          rawScore: 61.6,
          rawMaxScore: 70,
          rawPercentage: 88,
          weightedScore: 61.6,
        },
      ],
      subjectRemark: "Excellent effort",
    },
  ],
  termSummarySnapshot: {
    subjectCount: 1,
    passedSubjectCount: 1,
    averageFinalScore: 88.1,
    classPosition: 3,
    totalStudents: 28,
  },
  commentsSnapshot: {
    ready: true,
    homeroomComment: "A focused learner.",
    headteacherComment: "Keep it up.",
    subjectRemarks: [{ subjectId, remark: "Excellent effort" }],
  },
  conductSnapshot: { conduct: "Good", interest: "Sports", attitude: "Positive" },
  status: "released",
  releasedAt: new Date("2026-05-01T12:00:00.000Z"),
  compiledAt: new Date("2026-04-28T12:00:00.000Z"),
  createdAt: new Date(),
  updatedAt: new Date(),
} as unknown as IStudentReportCard;

describe("resolveReportCardStatusesForViewer", () => {
  it("limits parent/student to released snapshots", () => {
    assert.deepEqual(resolveReportCardStatusesForViewer("parent"), ["released"]);
    assert.deepEqual(resolveReportCardStatusesForViewer("admin"), [
      "released",
      "approved",
      "compiled",
    ]);
  });
});

describe("mapStudentReportCardStatusToRecordStatus", () => {
  it("maps engine statuses to profile record statuses", () => {
    assert.equal(mapStudentReportCardStatusToRecordStatus("released"), "released");
    assert.equal(mapStudentReportCardStatusToRecordStatus("compiled"), "compiled");
  });
});

describe("applyReportCardViewToAcademicProfile", () => {
  it("maps snapshot view data into profile sections", () => {
    const permissions = resolveAcademicProfilePermissions({ visibilityMode: "admin" });
    const profile = createEmptyStudentAcademicProfile({
      studentId: "student1",
      schoolId: "school1",
      visibilityMode: "admin",
      permissions,
      insightMode: "admin",
      selectedPeriodId: String(card.academicPeriodId),
      selectedPeriodLabel: "2025/2026 • Term 1",
      periods: [
        {
          academicPeriodId: String(card.academicPeriodId),
          label: "2025/2026 • Term 1",
          startDate: "",
          endDate: "",
          isCurrent: true,
          status: "in_progress",
          hasReportCard: false,
          isOfficial: false,
        },
      ],
    });

    const view = buildStudentReportCardViewData(card, {
      subjectNamesById: new Map([[subjectId, "Mathematics"]]),
      period: { yearLabel: "2025/2026", term: "Term 1" },
      gradeName: "JHS 1",
      classGroupName: "A",
      classGroupLabel: "JHS 1 A",
      verificationId: "RC-VERIFY",
    });

    applyReportCardViewToAcademicProfile(profile, card, view, {
      subjectNamesById: new Map([[subjectId, "Mathematics"]]),
      permissions,
    });

    assert.equal(profile.dataSource, "report_snapshot");
    assert.equal(profile.recordStatus, "released");
    assert.equal(profile.summary.finalAverage, 88.1);
    assert.equal(profile.summary.classPosition, 3);
    assert.equal(profile.subjectResults.length, 1);
    assert.equal(profile.subjectResults[0]?.gradeLabel, "HP");
    assert.equal(profile.subjectResults[0]?.components.length, 2);
    assert.equal(profile.subjectResults[0]?.components[0]?.weight, 30);
    assert.equal(profile.attendance.source, "report_snapshot");
    assert.equal(profile.attendance.daysPresent, 54);
    assert.equal(profile.comments.classTeacherComment, "A focused learner.");
    assert.equal(profile.comments.subjectComments[0]?.subjectName, "Mathematics");
    assert.equal(profile.comments.conduct, "Good");
    assert.equal(profile.reportCard.canDownload, true);
    assert.equal(profile.reportCard.verificationId, "RC-VERIFY");
    assert.equal(profile.trends.termHistory[0]?.source, "official_released");
  });
});
