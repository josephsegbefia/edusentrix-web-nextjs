/**
 * Student report card view builder — Slice 21.
 *
 * Run: node --test --import tsx tests/assessment-engine.build-student-report-card-view.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { buildStudentReportCardViewData } from "../src/lib/academics/reporting/build-student-report-card-view";
import type { IStudentReportCard } from "../src/models/StudentReportCard";

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
    showGradeKey: true,
    scoreComponents: [
      { key: "classwork", label: "Classroom Work", weight: 30, order: 0, required: true },
      { key: "exam", label: "Exam", weight: 70, order: 1, required: true },
    ],
    gradeBoundaries: [
      { gradeLabel: "HP", minPercentage: 80, maxPercentage: 100, gradePoint: 1 },
    ],
  },
  assessmentPlanSnapshot: {},
  reportTemplateSnapshot: {
    name: "Term report card",
    sections: [
      { type: "header", label: "Header", enabled: true, order: 0 },
      { type: "subject_grades", label: "Subject Results", enabled: true, order: 1 },
      { type: "attendance", label: "Attendance", enabled: true, order: 2 },
    ],
    showAttendance: true,
    showGradingKey: true,
    showClassPosition: false,
    showConduct: false,
  },
  studentSnapshot: {
    name: "Ama Mensah",
    admissionNo: "ADM-001",
  },
  schoolSnapshot: {
    name: "Demo School",
  },
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
      subjectId: "507f1f77bcf86cd799439011",
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
  },
  commentsSnapshot: {
    ready: false,
    homeroomComment: null,
    headteacherComment: null,
  },
  status: "released",
  createdAt: new Date(),
  updatedAt: new Date(),
} as unknown as IStudentReportCard;

describe("buildStudentReportCardViewData", () => {
  it("builds dynamic component columns and grade labels from snapshots", () => {
    const view = buildStudentReportCardViewData(card, {
      subjectNamesById: new Map([["507f1f77bcf86cd799439011", "Mathematics"]]),
      period: { yearLabel: "2025/2026", term: "Term 1" },
      gradeName: "JHS 1",
      classGroupName: "A",
      classGroupLabel: "JHS 1 A",
      verificationId: "RC-20260529-ABCDEF",
    });

    assert.equal(view.source, "snapshot");
    assert.equal(view.scoreComponents.length, 2);
    assert.equal(view.scoreComponents[0]?.label, "Classroom Work");
    assert.equal(view.subjects[0]?.subjectName, "Mathematics");
    assert.equal(view.subjects[0]?.gradeLabel, "HP");
    assert.equal(view.subjects[0]?.componentScores[0]?.componentKey, "classwork");
    assert.equal(view.attendance?.ready, true);
    assert.equal(view.attendance?.daysPresent, 54);
    assert.equal(view.verificationId, "RC-20260529-ABCDEF");
  });
});
