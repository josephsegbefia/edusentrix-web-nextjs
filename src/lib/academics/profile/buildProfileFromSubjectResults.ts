/**
 * Builds Student Academic Profile sections from live SubjectResult rows (Slice 4).
 * Staff-only by default; parent/student require allowProgressVisibility.
 * @see STUDENT_ACADEMIC_PROFILE_SPEC.md §7.2, §7.4, Slice 4
 */

import mongoose from "mongoose";
import {
  COMPLETE_SUBJECT_RESULT_STATUSES,
  derivePerformanceTier,
  isCompleteSubjectResult,
  type SubjectResultLike,
} from "@/lib/academics/compatibility/subject-result-adapters";
import { buildAcademicProfileReadinessFromSections } from "@/lib/academics/profile/build-academic-profile-readiness";
import { calculateRiskLevel } from "@/lib/academics/calculateRiskLevel";
import { SubjectResult, type ISubjectResult } from "@/models/SubjectResult";
import { Subject } from "@/models/Subject";
import { Teacher } from "@/models/Teacher";
import { User } from "@/models/User";
import type { SubjectResultComponentSnapshot, SubjectResultStatus } from "@/types/academics/assessment-engine";
import type {
  AcademicProfileAssessmentEvidenceSummaryDTO,
  AcademicProfilePermissionsDTO,
  AcademicProfileScoreComponentDTO,
  AcademicProfileSubjectResultDTO,
  AcademicProfileVisibilityMode,
  AcademicRecordStatus,
  ScoreComponentStatus,
  StudentAcademicProfileDTO,
} from "@/types/academics/student-academic-profile";

void Teacher;
void User;

const STAFF_SUBJECT_RESULT_STATUSES: SubjectResultStatus[] = [
  "draft",
  "ready",
  "submitted",
  "returned",
  "approved",
  "locked",
];

const PROGRESS_VISIBILITY_STATUSES: SubjectResultStatus[] = [
  "submitted",
  "approved",
  "locked",
];

const PROVISIONAL_SUBJECT_RESULT_STATUSES = new Set<SubjectResultStatus>([
  "draft",
  "ready",
  "returned",
]);

type IdLike = string | mongoose.Types.ObjectId;

function toObjectId(value: IdLike) {
  return value instanceof mongoose.Types.ObjectId
    ? value
    : new mongoose.Types.ObjectId(String(value));
}

function roundScore(value: number) {
  return Math.round(value * 10) / 10;
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return roundScore(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function buildTeacherName(user: {
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
} | null | undefined) {
  if (!user) return null;
  const full = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
  return full || user.name || null;
}

export function shouldApplySubjectResultsProfile(input: {
  visibilityMode: AcademicProfileVisibilityMode;
  allowProgressVisibility?: boolean;
}): boolean {
  if (input.visibilityMode === "parent" || input.visibilityMode === "student") {
    return !!input.allowProgressVisibility;
  }
  return true;
}

export function resolveSubjectResultStatusesForViewer(
  visibilityMode: AcademicProfileVisibilityMode,
  allowProgressVisibility?: boolean
): SubjectResultStatus[] {
  if (visibilityMode === "parent" || visibilityMode === "student") {
    return allowProgressVisibility ? PROGRESS_VISIBILITY_STATUSES : [];
  }
  return STAFF_SUBJECT_RESULT_STATUSES;
}

function componentHasScore(component: SubjectResultComponentSnapshot): boolean {
  return (
    (typeof component.rawScore === "number" && component.rawScore > 0) ||
    (typeof component.rawPercentage === "number" && component.rawPercentage > 0) ||
    (typeof component.weightedScore === "number" && component.weightedScore > 0)
  );
}

export function mapSubjectResultComponentToProfile(
  component: SubjectResultComponentSnapshot,
  resultStatus: SubjectResultStatus
): AcademicProfileScoreComponentDTO {
  const hasScore = componentHasScore(component);
  let status: ScoreComponentStatus = "missing";

  if (PROVISIONAL_SUBJECT_RESULT_STATUSES.has(resultStatus)) {
    status = hasScore ? "provisional" : "missing";
  } else if (hasScore) {
    status = "complete";
  }

  return {
    componentKey: component.componentKey,
    label: component.label,
    weight: component.weight ?? 0,
    rawScore: typeof component.rawScore === "number" ? component.rawScore : null,
    rawMaxScore: typeof component.rawMaxScore === "number" ? component.rawMaxScore : null,
    rawPercentage:
      typeof component.rawPercentage === "number" ? component.rawPercentage : null,
    weightedScore:
      typeof component.weightedScore === "number" ? component.weightedScore : null,
    status,
  };
}

export function mapSubjectResultToProfileRow(
  result: ISubjectResult,
  meta: {
    subjectName: string;
    subjectCode: string | null;
    teacherName: string | null;
  },
  input: {
    canViewBreakdown: boolean;
    includeProvisional: boolean;
  }
): AcademicProfileSubjectResultDTO | null {
  const status = result.status as SubjectResultStatus;
  const isComplete = isCompleteSubjectResult(result);
  const isProvisional = PROVISIONAL_SUBJECT_RESULT_STATUSES.has(status);

  if (!input.includeProvisional && !isComplete) {
    return null;
  }

  if (!input.includeProvisional && isProvisional) {
    return null;
  }

  const finalScore =
    typeof result.roundedFinalScore === "number"
      ? result.roundedFinalScore
      : typeof result.finalScore === "number"
        ? result.finalScore
        : null;

  if (!input.includeProvisional && finalScore == null && !isComplete) {
    return null;
  }

  return {
    subjectId: String(result.subjectId),
    subjectName: meta.subjectName,
    subjectCode: meta.subjectCode,
    teacherId: result.teacherId ? String(result.teacherId) : null,
    teacherName: meta.teacherName,
    status,
    components: (result.components ?? []).map((component) =>
      mapSubjectResultComponentToProfile(component, status)
    ),
    finalScore: typeof result.finalScore === "number" ? result.finalScore : null,
    roundedFinalScore: finalScore,
    gradeLabel: result.gradeLabel ?? null,
    gradePoint: result.gradePoint ?? null,
    descriptor: result.descriptor ?? null,
    isPassed: typeof result.isPassed === "boolean" ? result.isPassed : null,
    subjectPosition: result.subjectPosition ?? null,
    totalStudentsForSubject: result.totalStudentsForSubject ?? null,
    remark: result.subjectRemark ?? null,
    isOfficial: isComplete && (status === "approved" || status === "locked"),
    hasBreakdown: input.canViewBreakdown,
    issueCount: result.missingRequiredItems?.length ?? 0,
  };
}

export function deriveRecordStatusFromSubjectResults(
  results: SubjectResultLike[]
): AcademicRecordStatus {
  if (results.length === 0) {
    return "no_data";
  }

  const statuses = results.map((result) => result.status as SubjectResultStatus);
  const hasApproved = statuses.some((status) => status === "approved" || status === "locked");
  const hasSubmitted = statuses.some((status) => status === "submitted");
  const hasOnlyProvisional = statuses.every((status) =>
    PROVISIONAL_SUBJECT_RESULT_STATUSES.has(status)
  );

  if (hasApproved && !hasOnlyProvisional) {
    return "submitted";
  }
  if (hasSubmitted) {
    return "submitted";
  }
  if (hasOnlyProvisional) {
    return "in_progress";
  }
  return "in_progress";
}

export function buildAssessmentEvidenceSummaryFromResults(
  subjectResults: AcademicProfileSubjectResultDTO[]
): AcademicProfileAssessmentEvidenceSummaryDTO {
  let missingItemsTotal = 0;
  const subjectsWithMissingEvidence: AcademicProfileAssessmentEvidenceSummaryDTO["subjectsWithMissingEvidence"] =
    [];

  for (const row of subjectResults) {
    if (row.issueCount > 0) {
      missingItemsTotal += row.issueCount;
      subjectsWithMissingEvidence.push({
        subjectId: row.subjectId,
        subjectName: row.subjectName,
        missingCount: row.issueCount,
      });
    }
  }

  return {
    countedItemsTotal: 0,
    nonCountedItemsTotal: 0,
    missingItemsTotal,
    subjectsWithMissingEvidence,
  };
}

function pickStrongestWeakest(subjectResults: AcademicProfileSubjectResultDTO[]) {
  const scored = subjectResults.filter((row) => row.roundedFinalScore != null);
  if (scored.length === 0) {
    return { strongest: null, weakest: null };
  }

  const sorted = [...scored].sort(
    (a, b) => (b.roundedFinalScore ?? 0) - (a.roundedFinalScore ?? 0)
  );
  const strongest = sorted[0]!;
  const weakest = sorted[sorted.length - 1]!;

  return {
    strongest: {
      subjectId: strongest.subjectId,
      subjectName: strongest.subjectName,
      score: strongest.roundedFinalScore!,
    },
    weakest: {
      subjectId: weakest.subjectId,
      subjectName: weakest.subjectName,
      score: weakest.roundedFinalScore!,
    },
  };
}

export async function loadSubjectResultsForProfilePeriod(input: {
  schoolId: IdLike;
  studentId: IdLike;
  academicPeriodId: string;
  visibilityMode: AcademicProfileVisibilityMode;
  allowProgressVisibility?: boolean;
}) {
  const statuses = resolveSubjectResultStatusesForViewer(
    input.visibilityMode,
    input.allowProgressVisibility
  );

  if (statuses.length === 0) {
    return [];
  }

  return (await SubjectResult.find({
    schoolId: toObjectId(input.schoolId),
    studentId: toObjectId(input.studentId),
    academicPeriodId: toObjectId(input.academicPeriodId),
    status: { $in: statuses },
  })
    .sort({ updatedAt: -1, createdAt: -1 })
    .lean()) as unknown as ISubjectResult[];
}

async function hydrateSubjectResultMeta(
  schoolId: IdLike,
  results: ISubjectResult[]
) {
  const subjectIds = [...new Set(results.map((result) => String(result.subjectId)))];
  const teacherIds = [
    ...new Set(results.map((result) => String(result.teacherId)).filter(Boolean)),
  ];

  const [subjects, teachers] = await Promise.all([
    subjectIds.length
      ? Subject.find({
          _id: { $in: subjectIds.map((id) => toObjectId(id)) },
          schoolId: toObjectId(schoolId),
        })
          .select("_id name code")
          .lean()
      : Promise.resolve([]),
    teacherIds.length
      ? Teacher.find({ _id: { $in: teacherIds.map((id) => toObjectId(id)) } })
          .select("_id userId")
          .lean()
      : Promise.resolve([]),
  ]);

  const users = teachers.length
    ? await User.find({
        _id: { $in: teachers.map((teacher) => teacher.userId).filter(Boolean) },
      })
        .select("_id firstName lastName name")
        .lean()
    : [];

  const subjectById = new Map(subjects.map((subject) => [String(subject._id), subject]));
  const userById = new Map(users.map((user) => [String(user._id), user]));
  const teacherNameById = new Map<string, string | null>();

  for (const teacher of teachers) {
    const user = userById.get(String(teacher.userId));
    teacherNameById.set(String(teacher._id), buildTeacherName(user));
  }

  return { subjectById, teacherNameById };
}

export function applySubjectResultsToAcademicProfile(
  profile: StudentAcademicProfileDTO,
  input: {
    results: ISubjectResult[];
    subjectById: Map<string, { name?: string; code?: string | null }>;
    teacherNameById: Map<string, string | null>;
    permissions: AcademicProfilePermissionsDTO;
    includeProvisional: boolean;
    periodId: string;
  }
): boolean {
  const { permissions, includeProvisional } = input;

  const rowsBySubject = new Map<string, AcademicProfileSubjectResultDTO>();

  const sortedResults = [...input.results].sort((a, b) => {
    const aComplete = isCompleteSubjectResult(a) ? 1 : 0;
    const bComplete = isCompleteSubjectResult(b) ? 1 : 0;
    if (aComplete !== bComplete) return bComplete - aComplete;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  for (const result of sortedResults) {
    const subjectId = String(result.subjectId);
    const existing = rowsBySubject.get(subjectId);
    if (existing && isCompleteSubjectResult(existing)) continue;

    if (
      permissions.visibleSubjectIds?.length &&
      !permissions.visibleSubjectIds.includes(subjectId)
    ) {
      continue;
    }

    const subject = input.subjectById.get(subjectId);
    const row = mapSubjectResultToProfileRow(
      result,
      {
        subjectName: subject?.name ?? "Unknown subject",
        subjectCode: subject?.code ?? null,
        teacherName: result.teacherId
          ? input.teacherNameById.get(String(result.teacherId)) ?? null
          : null,
      },
      {
        canViewBreakdown: permissions.canViewBreakdown,
        includeProvisional,
      }
    );

    if (row) {
      rowsBySubject.set(subjectId, row);
    }
  }

  const subjectResults = Array.from(rowsBySubject.values()).sort((a, b) =>
    a.subjectName.localeCompare(b.subjectName)
  );

  if (subjectResults.length === 0) {
    return false;
  }

  const completeResults = input.results.filter((result) =>
    COMPLETE_SUBJECT_RESULT_STATUSES.has(result.status as SubjectResultStatus)
  );

  const completeScores = completeResults
    .map((result) =>
      typeof result.roundedFinalScore === "number"
        ? result.roundedFinalScore
        : typeof result.finalScore === "number"
          ? result.finalScore
          : null
    )
    .filter((score): score is number => score != null);

  const projectedScores = subjectResults
    .map((row) => row.roundedFinalScore)
    .filter((score): score is number => score != null);

  const summaryAverage = average(completeScores);
  const projectedAverage = includeProvisional ? average(projectedScores) : null;

  const recordStatus = deriveRecordStatusFromSubjectResults(input.results);
  const isProvisional =
    recordStatus === "in_progress" ||
    subjectResults.some((row) => PROVISIONAL_SUBJECT_RESULT_STATUSES.has(row.status as SubjectResultStatus));

  const weakSubjectsCount = subjectResults.filter(
    (row) => row.roundedFinalScore != null && row.roundedFinalScore < 60
  ).length;

  const { strongest, weakest } = pickStrongestWeakest(subjectResults);

  profile.recordStatus = recordStatus;
  profile.dataSource = "subject_results";
  profile.dataSourceNotes = isProvisional
    ? ["Provisional subject results from the assessment engine. Not an official report card."]
    : ["Subject results from the assessment engine."];

  profile.summary = {
    overallAverage: permissions.canViewProjectedAverage
      ? (projectedAverage ?? summaryAverage)
      : summaryAverage,
    projectedAverage: permissions.canViewProjectedAverage ? projectedAverage : null,
    finalAverage: null,
    classPosition: null,
    totalStudents: null,
    totalSubjects: subjectResults.length,
    completedSubjects: completeResults.length,
    missingSubjects: Math.max(0, subjectResults.length - completeResults.length),
    performanceTier: derivePerformanceTier(summaryAverage ?? projectedAverage),
    trend: profile.summary.trend,
    trendDelta: profile.summary.trendDelta,
    riskLevel: calculateRiskLevel({
      overallAverage: summaryAverage ?? projectedAverage,
      performanceTier: derivePerformanceTier(summaryAverage ?? projectedAverage),
      trend: profile.summary.trend,
      weakSubjectsCount,
      consecutiveDeclines: 0,
    }),
    strongestSubject: strongest,
    weakestSubject: weakest,
  };

  profile.reportStatus = {
    status: recordStatus,
    label: isProvisional ? "In progress (provisional)" : "Subject results submitted",
    isOfficial: false,
    isReleased: false,
    isProvisional,
    reportCardRunId: null,
    studentReportCardId: null,
    releasedAt: null,
    approvedAt: null,
    compiledAt: null,
    readiness: null,
  };

  profile.subjectResults = subjectResults;
  profile.assessmentEvidenceSummary =
    buildAssessmentEvidenceSummaryFromResults(subjectResults);

  profile.comments = {
    ...profile.comments,
    subjectComments: subjectResults
      .filter((row) => row.remark)
      .map((row) => ({
        subjectId: row.subjectId,
        subjectName: row.subjectName,
        teacherId: row.teacherId,
        teacherName: row.teacherName,
        comment: row.remark!,
      })),
  };

  if (permissions.canViewReadiness) {
    profile.reportStatus.readiness = buildAcademicProfileReadinessFromSections({
      subjectResults,
      comments: profile.comments,
      attendance: profile.attendance,
      recordStatus,
    });
  }

  profile.reportCard = {
    ...profile.reportCard,
    status: recordStatus,
    canView: false,
    canDownload: false,
  };

  profile.periods = profile.periods.map((period) => {
    if (period.academicPeriodId !== input.periodId) return period;
    return {
      ...period,
      status: isProvisional ? "in_progress" : period.status,
      isOfficial: false,
    };
  });

  if (projectedAverage != null && permissions.canViewProjectedAverage) {
    profile.trends.termHistory = [
      {
        academicPeriodId: input.periodId,
        label: profile.selectedPeriod.label ?? input.periodId,
        averageScore: projectedAverage,
        classPosition: null,
        classAverage: null,
        source: "projected_current",
        isOfficial: false,
      },
    ];
  }

  return true;
}

/**
 * Loads SubjectResult rows for the period and merges them into the profile.
 * @returns true when subject result data was applied.
 */
export async function tryApplyProfileFromSubjectResults(
  profile: StudentAcademicProfileDTO,
  input: {
    schoolId: mongoose.Types.ObjectId;
    studentId: mongoose.Types.ObjectId;
    academicPeriodId: string | null;
    visibilityMode: AcademicProfileVisibilityMode;
    permissions: AcademicProfilePermissionsDTO;
    allowProgressVisibility?: boolean;
  }
): Promise<boolean> {
  if (!input.academicPeriodId) {
    return false;
  }

  if (
    !shouldApplySubjectResultsProfile({
      visibilityMode: input.visibilityMode,
      allowProgressVisibility: input.allowProgressVisibility,
    })
  ) {
    return false;
  }

  const results = await loadSubjectResultsForProfilePeriod({
    schoolId: input.schoolId,
    studentId: input.studentId,
    academicPeriodId: input.academicPeriodId,
    visibilityMode: input.visibilityMode,
    allowProgressVisibility: input.allowProgressVisibility,
  });

  if (results.length === 0) {
    return false;
  }

  const { subjectById, teacherNameById } = await hydrateSubjectResultMeta(
    input.schoolId,
    results
  );

  const includeProvisional =
    input.permissions.canViewProvisionalScores &&
    (input.visibilityMode === "admin" ||
      input.visibilityMode === "homeroom_teacher" ||
      input.visibilityMode === "subject_teacher" ||
      !!input.allowProgressVisibility);

  return applySubjectResultsToAcademicProfile(profile, {
    results,
    subjectById,
    teacherNameById,
    permissions: input.permissions,
    includeProvisional,
    periodId: input.academicPeriodId,
  });
}
