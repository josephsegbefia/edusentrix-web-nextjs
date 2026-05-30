/**
 * Legacy SubjectGrade / TermResult fallback for Student Academic Profile (Slice 6).
 * Used only when no report snapshot or engine subject results exist.
 * @see STUDENT_ACADEMIC_PROFILE_SPEC.md §2, Slice 6
 */

import mongoose from "mongoose";
import { calculateTrend } from "@/lib/academics/calculateGrades";
import { calculateRiskLevel } from "@/lib/academics/calculateRiskLevel";
import { derivePerformanceTier } from "@/lib/academics/compatibility/subject-result-adapters";
import { SubjectGrade, type IAssessmentComponent, type ISubjectGrade } from "@/models/SubjectGrade";
import { TeacherComment, type ITeacherComment } from "@/models/TeacherComment";
import { TermResult, type ITermResult } from "@/models/TermResult";
import { Teacher } from "@/models/Teacher";
import { User } from "@/models/User";
import type {
  AcademicProfileCommentsDTO,
  AcademicProfileScoreComponentDTO,
  AcademicProfileSubjectResultDTO,
  StudentAcademicProfileDTO,
} from "@/types/academics/student-academic-profile";

void Teacher;
void User;

type IdLike = string | mongoose.Types.ObjectId;

function toObjectId(value: IdLike) {
  return value instanceof mongoose.Types.ObjectId
    ? value
    : new mongoose.Types.ObjectId(String(value));
}

function toStringId(id: IdLike | undefined | null): string | null {
  if (!id) return null;
  return id instanceof mongoose.Types.ObjectId ? id.toString() : String(id);
}

function buildTeacherName(user: {
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
} | null | undefined): string | null {
  if (!user) return null;
  const full = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
  return full || user.name || null;
}

function slugComponentKey(label: string, index: number): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return slug || `component_${index + 1}`;
}

export function shouldApplyLegacyAcademicProfileFallback(
  profile: StudentAcademicProfileDTO
): boolean {
  if (profile.dataSource === "report_snapshot") {
    return false;
  }
  if (profile.subjectResults.length > 0) {
    return false;
  }
  return true;
}

export function mapLegacyAssessmentComponent(
  component: IAssessmentComponent,
  index: number
): AcademicProfileScoreComponentDTO {
  return {
    componentKey: slugComponentKey(component.label, index),
    label: component.label,
    weight: component.weight ?? 0,
    rawScore: component.score ?? null,
    rawMaxScore: component.maxScore ?? null,
    rawPercentage: component.percentage ?? null,
    weightedScore: null,
    status:
      (component.maxScore ?? 0) > 0 || (component.score ?? 0) > 0
        ? "complete"
        : "missing",
  };
}

export function mapLegacySubjectGradeToProfileRow(
  grade: ISubjectGrade,
  meta: {
    subjectId: string;
    subjectName: string;
    subjectCode: string | null;
    teacherId: string | null;
    teacherName: string | null;
  }
): AcademicProfileSubjectResultDTO {
  let components: AcademicProfileScoreComponentDTO[] = [];

  if (grade.components?.length) {
    components = grade.components.map((component, index) =>
      mapLegacyAssessmentComponent(component, index)
    );
  } else {
    components = [
      {
        componentKey: "ca",
        label: "CA",
        weight: 0,
        rawScore: grade.caTotal ?? null,
        rawMaxScore: grade.caMaxTotal ?? null,
        rawPercentage: grade.caPercentage ?? null,
        weightedScore: null,
        status:
          (grade.caMaxTotal ?? 0) > 0 || (grade.caPercentage ?? 0) > 0
            ? "complete"
            : "missing",
      },
      {
        componentKey: "exam",
        label: "Exam",
        weight: 0,
        rawScore: grade.examScore ?? null,
        rawMaxScore: grade.examMaxScore ?? null,
        rawPercentage: grade.examPercentage ?? null,
        weightedScore: null,
        status:
          (grade.examMaxScore ?? 0) > 0 || (grade.examPercentage ?? 0) > 0
            ? "complete"
            : "missing",
      },
    ];
  }

  return {
    subjectId: meta.subjectId,
    subjectName: meta.subjectName,
    subjectCode: meta.subjectCode,
    teacherId: meta.teacherId,
    teacherName: meta.teacherName,
    status: "legacy",
    components,
    finalScore: grade.totalScore ?? null,
    roundedFinalScore: grade.totalScore ?? null,
    gradeLabel: grade.gradeLetter ?? null,
    gradePoint: grade.gradePoint ?? null,
    descriptor: grade.descriptorLevel ?? null,
    isPassed: typeof grade.isPassed === "boolean" ? grade.isPassed : null,
    subjectPosition: null,
    totalStudentsForSubject: null,
    remark: null,
    isOfficial: false,
    hasBreakdown: false,
    issueCount: 0,
  };
}

export function mapLegacyTeacherComments(
  commentDocs: (ITeacherComment & { subjectId?: unknown; teacherId?: unknown })[]
): AcademicProfileCommentsDTO {
  const subjectComments: AcademicProfileCommentsDTO["subjectComments"] = [];
  let classTeacherComment: string | null = null;

  for (const doc of commentDocs) {
    const subject: { _id?: IdLike; name?: string } | null =
      doc.subjectId && typeof doc.subjectId === "object"
        ? (doc.subjectId as { _id?: IdLike; name?: string })
        : null;
    const teacher: { userId?: { firstName?: string; lastName?: string; name?: string } } | null =
      doc.teacherId && typeof doc.teacherId === "object"
        ? (doc.teacherId as {
            userId?: { firstName?: string; lastName?: string; name?: string };
          })
        : null;

    if (doc.commentType === "subject" && subject?._id) {
      subjectComments.push({
        subjectId: toStringId(subject._id) ?? "",
        subjectName: subject.name ?? "Subject",
        teacherId: toStringId(doc.teacherId as IdLike),
        teacherName: buildTeacherName(teacher?.userId ?? null),
        comment: doc.comment,
      });
      continue;
    }

    if (doc.commentType === "general" && !classTeacherComment) {
      classTeacherComment = doc.comment;
    }
  }

  return {
    subjectComments,
    classTeacherComment,
    headteacherComment: null,
    conduct: null,
    interest: null,
    attitude: null,
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

async function loadLegacySubjectGrades(input: {
  schoolId: IdLike;
  studentId: IdLike;
  academicPeriodId: string;
}) {
  const canPopulateTeacher = !!mongoose.models.Teacher;
  const query = SubjectGrade.find({
    schoolId: toObjectId(input.schoolId),
    studentId: toObjectId(input.studentId),
    academicPeriodId: toObjectId(input.academicPeriodId),
  })
    .sort({ updatedAt: -1, createdAt: -1, _id: -1 })
    .populate("subjectId", "name code");

  if (canPopulateTeacher) {
    try {
      query.populate({
        path: "teacherId",
        populate: { path: "userId", select: "firstName lastName name" },
        strictPopulate: false,
      });
    } catch {
      // continue without teacher populate
    }
  }

  return (await query.lean()) as unknown as (ISubjectGrade & {
    subjectId?: { _id?: IdLike; name?: string; code?: string | null };
    teacherId?: { _id?: IdLike; userId?: { firstName?: string; lastName?: string; name?: string } };
  })[];
}

async function loadLegacyTeacherComments(input: {
  schoolId: IdLike;
  studentId: IdLike;
  academicPeriodId: string;
}) {
  const canPopulateTeacher = !!mongoose.models.Teacher;
  const query = TeacherComment.find({
    schoolId: toObjectId(input.schoolId),
    studentId: toObjectId(input.studentId),
    academicPeriodId: toObjectId(input.academicPeriodId),
  }).populate("subjectId", "name code");

  if (canPopulateTeacher) {
    try {
      query.populate({
        path: "teacherId",
        populate: { path: "userId", select: "firstName lastName name" },
        strictPopulate: false,
      });
    } catch {
      // continue
    }
  }

  return (await query.sort({ createdAt: -1 }).lean()) as unknown as (ITeacherComment & {
    subjectId?: unknown;
    teacherId?: unknown;
  })[];
}

export function applyLegacyDataToAcademicProfile(
  profile: StudentAcademicProfileDTO,
  input: {
    subjectGrades: (ISubjectGrade & {
      subjectId?: { _id?: IdLike; name?: string; code?: string | null };
      teacherId?: { _id?: IdLike; userId?: { firstName?: string; lastName?: string; name?: string } };
    })[];
    termResult: ITermResult | null;
    allTermResults: ITermResult[];
    periodId: string;
  }
): boolean {
  const rowsBySubject = new Map<string, AcademicProfileSubjectResultDTO>();

  for (const grade of input.subjectGrades) {
    const subject = grade.subjectId;
    const subjectId = subject?._id
      ? toStringId(subject._id)
      : toStringId(grade.subjectId as IdLike);
    if (!subjectId || rowsBySubject.has(subjectId)) continue;

    const teacher = grade.teacherId;
    rowsBySubject.set(
      subjectId,
      mapLegacySubjectGradeToProfileRow(grade, {
        subjectId,
        subjectName: subject?.name ?? "Unknown subject",
        subjectCode: subject?.code ?? null,
        teacherId: teacher?._id ? toStringId(teacher._id) : toStringId(grade.teacherId as IdLike),
        teacherName: buildTeacherName(teacher?.userId ?? null),
      })
    );
  }

  const subjectResults = Array.from(rowsBySubject.values()).sort((a, b) =>
    a.subjectName.localeCompare(b.subjectName)
  );

  if (subjectResults.length === 0 && !input.termResult) {
    return false;
  }

  const overallAverage = input.termResult?.averageScore ?? null;
  const weakSubjectsCount = subjectResults.filter(
    (row) => row.roundedFinalScore != null && row.roundedFinalScore < 60
  ).length;

  let trend = profile.summary.trend;
  let trendDelta: number | null = null;

  const periodIndex = profile.periods.findIndex(
    (period) => period.academicPeriodId === input.periodId
  );

  if (periodIndex > 0 && overallAverage != null) {
    const previousPeriodId = profile.periods[periodIndex - 1]?.academicPeriodId;
    const previousTerm = input.allTermResults.find(
      (row) => toStringId(row.academicPeriodId) === previousPeriodId
    );
    if (previousTerm?.averageScore != null) {
      trendDelta = Number((overallAverage - previousTerm.averageScore).toFixed(2));
      trend = calculateTrend(overallAverage, previousTerm.averageScore);
    }
  }

  const { strongest, weakest } = pickStrongestWeakest(subjectResults);
  const performanceTier =
    input.termResult?.performanceTier ?? derivePerformanceTier(overallAverage);

  profile.recordStatus = "legacy";
  profile.dataSource = "legacy";
  profile.dataSourceNotes = [
    "Showing legacy SubjectGrade and TermResult data until the assessment engine fully replaces this period.",
  ];

  profile.summary = {
    overallAverage,
    projectedAverage: null,
    finalAverage: null,
    classPosition: input.termResult?.classPosition ?? null,
    totalStudents: input.termResult?.totalStudents ?? null,
    totalSubjects: subjectResults.length || input.termResult?.totalSubjects || 0,
    completedSubjects: subjectResults.length,
    missingSubjects: 0,
    performanceTier,
    trend,
    trendDelta,
    riskLevel: calculateRiskLevel({
      overallAverage,
      performanceTier,
      trend,
      weakSubjectsCount,
      consecutiveDeclines: 0,
    }),
    strongestSubject: strongest,
    weakestSubject: weakest,
  };

  profile.reportStatus = {
    status: "legacy",
    label: "Legacy gradebook",
    isOfficial: false,
    isReleased: false,
    isProvisional: false,
    reportCardRunId: null,
    studentReportCardId: null,
    releasedAt: null,
    approvedAt: null,
    compiledAt: null,
    readiness: null,
  };

  profile.subjectResults = subjectResults;

  profile.reportCard = {
    ...profile.reportCard,
    status: "legacy",
    canView: false,
    canDownload: false,
  };

  profile.periods = profile.periods.map((period) => {
    if (period.academicPeriodId !== input.periodId) return period;
    return {
      ...period,
      status: "legacy",
      isOfficial: false,
    };
  });

  profile.trends.termHistory = profile.periods
    .map((period) => {
      const term = input.allTermResults.find(
        (row) => toStringId(row.academicPeriodId) === period.academicPeriodId
      );
      if (term?.averageScore == null) return null;
      return {
        academicPeriodId: period.academicPeriodId,
        label: period.label,
        averageScore: term.averageScore,
        classPosition: term.classPosition ?? null,
        classAverage: null,
        source: "legacy_fallback" as const,
        isOfficial: false,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (overallAverage != null) {
    const existingSubjectHistory = profile.trends.subjectHistory;
    for (const row of subjectResults) {
      const history = existingSubjectHistory[row.subjectId] ?? [];
      if (history.some((point) => point.academicPeriodId === input.periodId)) {
        continue;
      }
      history.push({
        academicPeriodId: input.periodId,
        periodLabel: profile.selectedPeriod.label ?? input.periodId,
        roundedFinalScore: row.roundedFinalScore,
        gradeLabel: row.gradeLabel,
        source: "legacy_fallback",
      });
      existingSubjectHistory[row.subjectId] = history;
    }
    profile.trends.subjectHistory = existingSubjectHistory;
  }

  return true;
}

/**
 * Loads legacy gradebook rows when no engine snapshot/results are present.
 */
export async function tryApplyLegacyAcademicProfileFallback(
  profile: StudentAcademicProfileDTO,
  input: {
    schoolId: mongoose.Types.ObjectId;
    studentId: mongoose.Types.ObjectId;
    academicPeriodId: string | null;
  }
): Promise<boolean> {
  if (!input.academicPeriodId || !shouldApplyLegacyAcademicProfileFallback(profile)) {
    return false;
  }

  const schoolKey = input.schoolId;
  const studentKey = input.studentId;
  const periodId = input.academicPeriodId;

  const [subjectGrades, termResult, allTermResults, commentDocs] = await Promise.all([
    loadLegacySubjectGrades({
      schoolId: schoolKey,
      studentId: studentKey,
      academicPeriodId: periodId,
    }),
    TermResult.findOne({
      schoolId: schoolKey,
      studentId: studentKey,
      academicPeriodId: toObjectId(periodId),
    }).lean() as Promise<ITermResult | null>,
    TermResult.find({
      schoolId: schoolKey,
      studentId: studentKey,
    })
      .sort({ createdAt: 1 })
      .lean() as Promise<ITermResult[]>,
    loadLegacyTeacherComments({
      schoolId: schoolKey,
      studentId: studentKey,
      academicPeriodId: periodId,
    }),
  ]);

  const applied = applyLegacyDataToAcademicProfile(profile, {
    subjectGrades,
    termResult,
    allTermResults,
    periodId,
  });

  if (!applied) {
    return false;
  }

  const legacyComments = mapLegacyTeacherComments(commentDocs);
  profile.comments = {
    ...profile.comments,
    ...legacyComments,
    subjectComments:
      legacyComments.subjectComments.length > 0
        ? legacyComments.subjectComments
        : profile.comments.subjectComments,
    classTeacherComment:
      legacyComments.classTeacherComment ?? profile.comments.classTeacherComment,
  };

  return true;
}
