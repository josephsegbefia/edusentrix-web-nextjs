/**
 * Student Academic Profile — Slice 6 (legacy fallback).
 *
 * Run: node --test --import tsx tests/student-academic-profile.legacy-fallback.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import {
  applyLegacyDataToAcademicProfile,
  mapLegacySubjectGradeToProfileRow,
  shouldApplyLegacyAcademicProfileFallback,
} from "../src/lib/academics/profile/buildLegacyAcademicProfileFallback";
import { createEmptyStudentAcademicProfile } from "../src/lib/academics/profile/empty-academic-profile-sections";
import { resolveAcademicProfilePermissions } from "../src/lib/academics/profile/resolve-academic-profile-permissions";
import type { ISubjectGrade } from "../src/models/SubjectGrade";
import type { ITermResult } from "../src/models/TermResult";

const periodId = new mongoose.Types.ObjectId().toString();

function makeLegacyGrade(overrides: Partial<ISubjectGrade> = {}): ISubjectGrade {
  return {
    _id: new mongoose.Types.ObjectId(),
    schoolId: new mongoose.Types.ObjectId(),
    academicPeriodId: new mongoose.Types.ObjectId(periodId),
    subjectId: new mongoose.Types.ObjectId(),
    studentId: new mongoose.Types.ObjectId(),
    teacherId: new mongoose.Types.ObjectId(),
    caTotal: 28,
    caMaxTotal: 30,
    caPercentage: 93.3,
    examScore: 60,
    examMaxScore: 70,
    examPercentage: 85.7,
    totalScore: 88,
    gradeLetter: "HP",
    gradePoint: 1,
    isPassed: true,
    lastUpdated: new Date(),
    createdAt: new Date(),
    ...overrides,
  } as ISubjectGrade;
}

describe("shouldApplyLegacyAcademicProfileFallback", () => {
  it("skips when report snapshot or subject results exist", () => {
    const base = createEmptyStudentAcademicProfile({
      studentId: "s1",
      schoolId: "sc1",
      visibilityMode: "admin",
      permissions: resolveAcademicProfilePermissions({ visibilityMode: "admin" }),
      insightMode: "admin",
    });

    base.dataSource = "report_snapshot";
    assert.equal(shouldApplyLegacyAcademicProfileFallback(base), false);

    base.dataSource = "none";
    base.subjectResults = [
      {
        subjectId: "sub1",
        subjectName: "Math",
        subjectCode: null,
        teacherId: null,
        teacherName: null,
        status: "submitted",
        components: [],
        finalScore: 80,
        roundedFinalScore: 80,
        gradeLabel: "B",
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
    assert.equal(shouldApplyLegacyAcademicProfileFallback(base), false);

    base.subjectResults = [];
    assert.equal(shouldApplyLegacyAcademicProfileFallback(base), true);
  });
});

describe("mapLegacySubjectGradeToProfileRow", () => {
  it("maps gradeLetter to gradeLabel and builds CA/exam components", () => {
    const row = mapLegacySubjectGradeToProfileRow(makeLegacyGrade(), {
      subjectId: "sub1",
      subjectName: "Mathematics",
      subjectCode: "MATH",
      teacherId: "t1",
      teacherName: "Mr. Owusu",
    });

    assert.equal(row.gradeLabel, "HP");
    assert.equal(row.status, "legacy");
    assert.equal(row.components.length, 2);
    assert.equal(row.components[0]?.componentKey, "ca");
    assert.equal(row.components[1]?.componentKey, "exam");
    assert.equal(row.isOfficial, false);
  });
});

describe("applyLegacyDataToAcademicProfile", () => {
  it("fills profile from SubjectGrade and TermResult", () => {
    const permissions = resolveAcademicProfilePermissions({ visibilityMode: "admin" });
    const profile = createEmptyStudentAcademicProfile({
      studentId: "student1",
      schoolId: "school1",
      visibilityMode: "admin",
      permissions,
      insightMode: "admin",
      selectedPeriodId: periodId,
      selectedPeriodLabel: "2025 • Term 1",
      periods: [
        {
          academicPeriodId: periodId,
          label: "2025 • Term 1",
          startDate: "",
          endDate: "",
          isCurrent: true,
          status: "no_data",
          hasReportCard: false,
          isOfficial: false,
        },
      ],
    });

    const subjectId = new mongoose.Types.ObjectId().toString();
    const grade = makeLegacyGrade({ subjectId: new mongoose.Types.ObjectId(subjectId) });

    const termResult = {
      _id: new mongoose.Types.ObjectId(),
      schoolId: new mongoose.Types.ObjectId(),
      academicPeriodId: new mongoose.Types.ObjectId(periodId),
      studentId: new mongoose.Types.ObjectId(),
      classGroupId: new mongoose.Types.ObjectId(),
      totalSubjects: 1,
      totalScore: 88,
      averageScore: 88,
      classPosition: 4,
      totalStudents: 30,
      performanceTier: "top",
      gpa: null,
      isPromoted: null,
      calculatedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as ITermResult;

    const applied = applyLegacyDataToAcademicProfile(profile, {
      subjectGrades: [
        {
          ...grade,
          subjectId: { _id: subjectId, name: "Mathematics", code: "MATH" },
        },
      ],
      termResult,
      allTermResults: [termResult],
      periodId,
    });

    assert.equal(applied, true);
    assert.equal(profile.dataSource, "legacy");
    assert.equal(profile.recordStatus, "legacy");
    assert.equal(profile.summary.overallAverage, 88);
    assert.equal(profile.summary.classPosition, 4);
    assert.equal(profile.subjectResults[0]?.gradeLabel, "HP");
    assert.equal(profile.trends.termHistory[0]?.source, "legacy_fallback");
    assert.equal(profile.periods[0]?.status, "legacy");
  });
});
