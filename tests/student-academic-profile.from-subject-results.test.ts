/**
 * Student Academic Profile — Slice 4 (SubjectResult mapping).
 *
 * Run: node --test --import tsx tests/student-academic-profile.from-subject-results.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import {
  applySubjectResultsToAcademicProfile,
  deriveRecordStatusFromSubjectResults,
  mapSubjectResultComponentToProfile,
  shouldApplySubjectResultsProfile,
} from "../src/lib/academics/profile/buildProfileFromSubjectResults";
import { createEmptyStudentAcademicProfile } from "../src/lib/academics/profile/empty-academic-profile-sections";
import { resolveAcademicProfilePermissions } from "../src/lib/academics/profile/resolve-academic-profile-permissions";
import type { ISubjectResult } from "../src/models/SubjectResult";

const periodId = new mongoose.Types.ObjectId().toString();

function makeResult(overrides: Partial<ISubjectResult>): ISubjectResult {
  return {
    _id: new mongoose.Types.ObjectId(),
    schoolId: new mongoose.Types.ObjectId(),
    academicPeriodId: new mongoose.Types.ObjectId(periodId),
    assessmentPlanId: new mongoose.Types.ObjectId(),
    gradingPolicyId: new mongoose.Types.ObjectId(),
    classGroupId: new mongoose.Types.ObjectId(),
    gradeId: new mongoose.Types.ObjectId(),
    subjectId: new mongoose.Types.ObjectId(),
    studentId: new mongoose.Types.ObjectId(),
    teacherId: new mongoose.Types.ObjectId(),
    components: [
      {
        componentKey: "classwork",
        label: "Classroom Work",
        weight: 30,
        rawScore: 24,
        rawMaxScore: 30,
        rawPercentage: 80,
        weightedScore: 24,
        includedAssessmentItemIds: [],
        excludedAssessmentItemIds: [],
        calculationMode: "rule_based",
      },
      {
        componentKey: "exam",
        label: "Exam",
        weight: 70,
        rawScore: 0,
        rawMaxScore: 70,
        rawPercentage: 0,
        weightedScore: 0,
        includedAssessmentItemIds: [],
        excludedAssessmentItemIds: [],
        calculationMode: "rule_based",
      },
    ],
    finalScore: 24,
    roundedFinalScore: 24,
    gradeLabel: "D",
    gradePoint: 4,
    descriptor: null,
    isPassed: false,
    missingRequiredItems: ["exam"],
    sourceAssessmentItemIds: [],
    status: "draft",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as ISubjectResult;
}

describe("shouldApplySubjectResultsProfile", () => {
  it("allows staff by default and blocks parent/student", () => {
    assert.equal(shouldApplySubjectResultsProfile({ visibilityMode: "admin" }), true);
    assert.equal(shouldApplySubjectResultsProfile({ visibilityMode: "parent" }), false);
    assert.equal(
      shouldApplySubjectResultsProfile({
        visibilityMode: "parent",
        allowProgressVisibility: true,
      }),
      true
    );
  });
});

describe("mapSubjectResultComponentToProfile", () => {
  it("marks draft components as provisional when scored", () => {
    const component = makeResult({}).components[0]!;
    const mapped = mapSubjectResultComponentToProfile(component, "draft");
    assert.equal(mapped.status, "provisional");
    assert.equal(mapped.componentKey, "classwork");
  });

  it("marks missing exam component on draft result", () => {
    const component = makeResult({}).components[1]!;
    const mapped = mapSubjectResultComponentToProfile(component, "draft");
    assert.equal(mapped.status, "missing");
  });
});

describe("deriveRecordStatusFromSubjectResults", () => {
  it("returns in_progress for draft-only sets", () => {
    assert.equal(
      deriveRecordStatusFromSubjectResults([makeResult({ status: "draft" })]),
      "in_progress"
    );
  });

  it("returns submitted when approved results exist", () => {
    assert.equal(
      deriveRecordStatusFromSubjectResults([
        makeResult({ status: "approved", roundedFinalScore: 72 }),
      ]),
      "submitted"
    );
  });
});

describe("applySubjectResultsToAcademicProfile", () => {
  it("maps dynamic components and provisional summary for staff", () => {
    const permissions = resolveAcademicProfilePermissions({ visibilityMode: "admin" });
    const profile = createEmptyStudentAcademicProfile({
      studentId: "student1",
      schoolId: "school1",
      visibilityMode: "admin",
      permissions,
      insightMode: "admin",
      selectedPeriodId: periodId,
      selectedPeriodLabel: "2025 • Term 1",
    });

    const subjectId = new mongoose.Types.ObjectId().toString();
    const result = makeResult({
      subjectId: new mongoose.Types.ObjectId(subjectId),
      status: "draft",
    });

    const applied = applySubjectResultsToAcademicProfile(profile, {
      results: [result],
      subjectById: new Map([[subjectId, { name: "Mathematics", code: "MATH" }]]),
      teacherNameById: new Map([[String(result.teacherId), "Mr. Owusu"]]),
      permissions,
      includeProvisional: true,
      periodId,
    });

    assert.equal(applied, true);
    assert.equal(profile.dataSource, "subject_results");
    assert.equal(profile.recordStatus, "in_progress");
    assert.equal(profile.reportStatus.isProvisional, true);
    assert.equal(profile.subjectResults.length, 1);
    assert.equal(profile.subjectResults[0]?.components.length, 2);
    assert.equal(profile.summary.projectedAverage, 24);
    assert.equal(profile.summary.completedSubjects, 0);
    assert.equal(profile.assessmentEvidenceSummary.missingItemsTotal, 1);
    assert.equal(profile.trends.termHistory[0]?.source, "projected_current");
  });

  it("uses only complete results for parent progress visibility summary", () => {
    const permissions = resolveAcademicProfilePermissions({
      visibilityMode: "parent",
      allowProgressVisibility: true,
    });
    const profile = createEmptyStudentAcademicProfile({
      studentId: "student1",
      schoolId: "school1",
      visibilityMode: "parent",
      permissions,
      insightMode: "parent",
      selectedPeriodId: periodId,
      selectedPeriodLabel: "2025 • Term 1",
    });

    const subjectId = new mongoose.Types.ObjectId().toString();
    const draft = makeResult({
      subjectId: new mongoose.Types.ObjectId(subjectId),
      status: "draft",
      roundedFinalScore: 40,
    });
    const approved = makeResult({
      subjectId: new mongoose.Types.ObjectId(subjectId),
      status: "approved",
      roundedFinalScore: 75,
      gradeLabel: "B",
      missingRequiredItems: [],
    });

    const applied = applySubjectResultsToAcademicProfile(profile, {
      results: [draft, approved],
      subjectById: new Map([[subjectId, { name: "English", code: "ENG" }]]),
      teacherNameById: new Map(),
      permissions,
      includeProvisional: false,
      periodId,
    });

    assert.equal(applied, true);
    assert.equal(profile.subjectResults[0]?.roundedFinalScore, 75);
    assert.equal(profile.summary.overallAverage, 75);
    assert.equal(profile.summary.projectedAverage, null);
  });
});
