/**
 * Maps a StudentReportCard snapshot into StudentAcademicProfileDTO sections (Slice 3).
 * @see STUDENT_ACADEMIC_PROFILE_SPEC.md §2, §7
 */

import mongoose from "mongoose";
import { buildStudentReportCardViewData } from "@/lib/academics/reporting/build-student-report-card-view";
import { loadStudentReportCardViewContext } from "@/lib/academics/reporting/load-student-report-card";
import { StudentReportCard } from "@/models/StudentReportCard";
import { derivePerformanceTier } from "@/lib/academics/compatibility/subject-result-adapters";
import {
  asSnapshotRecord,
  readSnapshotNumber,
  readSnapshotString,
  toIsoDateString,
} from "@/lib/academics/profile/snapshot-field-utils";
import type { IStudentReportCard } from "@/models/StudentReportCard";
import type { StudentReportCardStatus } from "@/types/academics/assessment-engine";
import type {
  AcademicProfilePermissionsDTO,
  AcademicProfileScoreComponentDTO,
  AcademicProfileSubjectCommentDTO,
  AcademicProfileSubjectResultDTO,
  AcademicProfileVisibilityMode,
  AcademicRecordStatus,
  StudentAcademicProfileDTO,
} from "@/types/academics/student-academic-profile";
import type { ReportCardViewData } from "@/types/academics/report-card-view";

const STAFF_SNAPSHOT_STATUSES: StudentReportCardStatus[] = [
  "released",
  "approved",
  "compiled",
];

const PUBLIC_SNAPSHOT_STATUSES: StudentReportCardStatus[] = ["released"];

const STATUS_PRIORITY: Record<StudentReportCardStatus, number> = {
  released: 4,
  approved: 3,
  compiled: 2,
  draft: 1,
  revoked: 0,
};

const RECORD_STATUS_LABELS: Record<AcademicRecordStatus, string> = {
  no_data: "No data",
  in_progress: "In progress",
  submitted: "Submitted",
  compiled: "Compiled",
  approved: "Approved",
  released: "Official report",
  legacy: "Legacy",
};

export function resolveReportCardStatusesForViewer(
  visibilityMode: AcademicProfileVisibilityMode
): StudentReportCardStatus[] {
  if (visibilityMode === "parent" || visibilityMode === "student") {
    return PUBLIC_SNAPSHOT_STATUSES;
  }
  return STAFF_SNAPSHOT_STATUSES;
}

export function mapStudentReportCardStatusToRecordStatus(
  status: StudentReportCardStatus
): AcademicRecordStatus {
  switch (status) {
    case "released":
      return "released";
    case "approved":
      return "approved";
    case "compiled":
      return "compiled";
    case "draft":
      return "in_progress";
    default:
      return "no_data";
  }
}

export async function findBestStudentReportCardForProfile(input: {
  schoolId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  academicPeriodId: string | null;
  visibilityMode: AcademicProfileVisibilityMode;
}): Promise<IStudentReportCard | null> {
  if (!input.academicPeriodId) {
    return null;
  }

  const allowed = resolveReportCardStatusesForViewer(input.visibilityMode);
  const periodId = new mongoose.Types.ObjectId(input.academicPeriodId);

  const cards = (await StudentReportCard.find({
    schoolId: input.schoolId,
    studentId: input.studentId,
    academicPeriodId: periodId,
    status: { $in: allowed },
  }).lean()) as IStudentReportCard[];

  if (!cards.length) {
    return null;
  }

  return [...cards].sort(
    (a, b) => (STATUS_PRIORITY[b.status] ?? 0) - (STATUS_PRIORITY[a.status] ?? 0)
  )[0]!;
}

function mapComponentScoresToProfile(
  row: ReportCardViewData["subjects"][number],
  policyComponents: ReportCardViewData["scoreComponents"],
  snapshotComponents: Array<Record<string, unknown>>
): AcademicProfileScoreComponentDTO[] {
  const scoresByKey = new Map(
    row.componentScores.map((component) => [component.componentKey, component])
  );
  const weightsByKey = new Map(
    snapshotComponents.map((component) => [
      readSnapshotString(component.componentKey) ?? "",
      readSnapshotNumber(component.weight, 0) ?? 0,
    ])
  );

  return policyComponents.map((policyComponent) => {
    const scored = scoresByKey.get(policyComponent.key);
    const hasScore =
      scored &&
      (scored.rawMaxScore > 0 ||
        scored.rawScore > 0 ||
        scored.rawPercentage > 0 ||
        scored.weightedScore > 0);

    return {
      componentKey: policyComponent.key,
      label: policyComponent.label,
      weight: weightsByKey.get(policyComponent.key) ?? 0,
      rawScore: scored ? scored.rawScore : null,
      rawMaxScore: scored ? scored.rawMaxScore : null,
      rawPercentage: scored ? scored.rawPercentage : null,
      weightedScore: scored ? scored.weightedScore : null,
      status: hasScore ? "complete" : "missing",
    };
  });
}

function mapSubjectCommentsFromSnapshot(
  card: IStudentReportCard,
  subjectNamesById: Map<string, string>
): AcademicProfileSubjectCommentDTO[] {
  const commentsSnapshot = asSnapshotRecord(card.commentsSnapshot);
  const remarks = Array.isArray(commentsSnapshot?.subjectRemarks)
    ? (commentsSnapshot.subjectRemarks as Array<Record<string, unknown>>)
    : [];

  return remarks
    .map((entry) => {
      const subjectId = readSnapshotString(entry.subjectId);
      const comment =
        readSnapshotString(entry.remark) ?? readSnapshotString(entry.comment);
      if (!subjectId || !comment) return null;

      return {
        subjectId,
        subjectName: subjectNamesById.get(subjectId) ?? "Subject",
        teacherId: null,
        teacherName: null,
        comment,
      };
    })
    .filter((row): row is AcademicProfileSubjectCommentDTO => row !== null);
}

function mapSubjectResultsFromView(
  view: ReportCardViewData,
  input: {
    card: IStudentReportCard;
    isOfficial: boolean;
    canViewBreakdown: boolean;
    viewerCanOpenReleasedBreakdown: boolean;
    visibleSubjectIds: string[] | null;
  }
): AcademicProfileSubjectResultDTO[] {
  const snapshotRows = input.card.subjectResultsSnapshot as Array<Record<string, unknown>>;

  return view.subjects
    .filter((row) => {
      if (!input.visibleSubjectIds?.length) return true;
      if (!row.subjectId) return false;
      return input.visibleSubjectIds.includes(row.subjectId);
    })
    .map((row, index) => {
      const snapshotRow = snapshotRows[index] ?? {};
      const subjectId =
        row.subjectId ?? readSnapshotString(snapshotRow.subjectId) ?? `unknown-${index}`;

      return {
        subjectId,
        subjectName: row.subjectName,
        subjectCode: null,
        teacherId: readSnapshotString(snapshotRow.teacherId),
        teacherName: null,
        status: "snapshot",
        components: mapComponentScoresToProfile(
          row,
          view.scoreComponents,
          Array.isArray(snapshotRow.components)
            ? (snapshotRow.components as Array<Record<string, unknown>>)
            : []
        ),
        finalScore: row.finalScore,
        roundedFinalScore: row.roundedFinalScore,
        gradeLabel: row.gradeLabel,
        gradePoint: row.gradePoint ?? null,
        descriptor: row.descriptor ?? null,
        isPassed: row.isPassed,
        subjectPosition: row.subjectPosition ?? null,
        totalStudentsForSubject: readSnapshotNumber(snapshotRow.totalStudentsForSubject),
        remark: row.subjectRemark ?? null,
        isOfficial: input.isOfficial,
        hasBreakdown:
          input.canViewBreakdown || input.viewerCanOpenReleasedBreakdown,
        issueCount: 0,
      };
    });
}

export function applyReportCardViewToAcademicProfile(
  profile: StudentAcademicProfileDTO,
  card: IStudentReportCard,
  view: ReportCardViewData,
  context: {
    subjectNamesById: Map<string, string>;
    permissions: AcademicProfilePermissionsDTO;
  }
): void {
  const recordStatus = mapStudentReportCardStatusToRecordStatus(card.status);
  const isReleased = card.status === "released";
  const isOfficial = card.status === "released" || card.status === "approved";
  const isProvisional = card.status === "compiled" || card.status === "approved";
  const isParentOrStudent =
    profile.visibilityMode === "parent" || profile.visibilityMode === "student";

  const termSummary = asSnapshotRecord(card.termSummarySnapshot) ?? {};
  const conductSnapshot = asSnapshotRecord(card.conductSnapshot);

  const subjectResults = mapSubjectResultsFromView(view, {
    card,
    isOfficial,
    canViewBreakdown: context.permissions.canViewBreakdown,
    viewerCanOpenReleasedBreakdown: isParentOrStudent && isReleased,
    visibleSubjectIds: context.permissions.visibleSubjectIds,
  });

  const averageFinalScore = readSnapshotNumber(
    termSummary.averageFinalScore,
    view.summary?.averageFinalScore ?? null
  );
  const subjectCount = readSnapshotNumber(
    termSummary.subjectCount,
    view.summary?.subjectCount ?? subjectResults.length
  );

  profile.recordStatus = recordStatus;
  profile.dataSource = "report_snapshot";
  profile.dataSourceNotes = ["Official report card snapshot."];

  profile.summary = {
    overallAverage: averageFinalScore,
    projectedAverage: null,
    finalAverage: isReleased ? averageFinalScore : null,
    classPosition: readSnapshotNumber(termSummary.classPosition, view.summary?.classPosition ?? null),
    totalStudents: readSnapshotNumber(termSummary.totalStudents, view.summary?.totalStudents ?? null),
    totalSubjects: subjectCount ?? subjectResults.length,
    completedSubjects: subjectResults.length,
    missingSubjects: Math.max(0, (subjectCount ?? subjectResults.length) - subjectResults.length),
    performanceTier: derivePerformanceTier(averageFinalScore),
    trend: profile.summary.trend,
    trendDelta: profile.summary.trendDelta,
    riskLevel: profile.summary.riskLevel,
    strongestSubject: profile.summary.strongestSubject,
    weakestSubject: profile.summary.weakestSubject,
  };

  profile.reportStatus = {
    status: recordStatus,
    label: RECORD_STATUS_LABELS[recordStatus],
    isOfficial,
    isReleased,
    isProvisional,
    reportCardRunId: String(card.reportCardRunId),
    studentReportCardId: String(card._id),
    releasedAt: toIsoDateString(card.releasedAt),
    approvedAt: toIsoDateString(card.approvedAt),
    compiledAt: toIsoDateString(card.compiledAt),
    readiness: null,
  };

  profile.subjectResults = subjectResults;

  if (view.attendance?.ready) {
    profile.attendance = {
      source: "report_snapshot",
      isSnapshot: true,
      totalSchoolDays: view.attendance.totalSchoolDays ?? null,
      daysPresent: view.attendance.daysPresent ?? null,
      daysAbsent: view.attendance.daysAbsent ?? null,
      daysLate: view.attendance.daysLate ?? null,
      daysExcused: view.attendance.daysExcused ?? null,
      attendancePercentage: view.attendance.attendancePercentage ?? null,
      calculatedAt: toIsoDateString(card.compiledAt ?? card.updatedAt),
      note: view.attendance.message ?? null,
    };
  }

  profile.comments = {
    subjectComments: mapSubjectCommentsFromSnapshot(card, context.subjectNamesById),
    classTeacherComment: view.comments?.homeroomComment ?? null,
    headteacherComment: view.comments?.headteacherComment ?? null,
    conduct: readSnapshotString(conductSnapshot?.conduct),
    interest: readSnapshotString(conductSnapshot?.interest),
    attitude: readSnapshotString(conductSnapshot?.attitude),
    ...(context.permissions.canViewInternalNotes
      ? {
          internalNotes: readSnapshotString(
            asSnapshotRecord(card.commentsSnapshot)?.internalNotes
          ),
        }
      : {}),
  };

  profile.reportCard = {
    status: recordStatus,
    canView: context.permissions.canViewReportCard,
    canDownload: isReleased && context.permissions.canDownloadReport,
    downloadUrl: isReleased && card.pdfUrl ? String(card.pdfUrl) : null,
    verificationId: view.verificationId ?? null,
    releasedAt: toIsoDateString(card.releasedAt),
    templateName: view.template.name,
  };

  const periodId = String(card.academicPeriodId);
  profile.periods = profile.periods.map((period) => {
    if (period.academicPeriodId !== periodId) return period;
    return {
      ...period,
      status: isReleased ? "released" : recordStatus === "approved" ? "approved" : period.status,
      hasReportCard: true,
      isOfficial: isOfficial,
    };
  });

  if (isReleased && averageFinalScore != null) {
    profile.trends.termHistory = [
      {
        academicPeriodId: periodId,
        label: profile.selectedPeriod.label ?? periodId,
        averageScore: averageFinalScore,
        classPosition: profile.summary.classPosition,
        classAverage: null,
        source: "official_released",
        isOfficial: true,
      },
    ];
  }
}

/**
 * Loads the best available report card snapshot for the period and merges it into the profile.
 * @returns true when snapshot data was applied.
 */
export async function tryApplyProfileFromReportCard(
  profile: StudentAcademicProfileDTO,
  input: {
    schoolId: mongoose.Types.ObjectId;
    studentId: mongoose.Types.ObjectId;
    academicPeriodId: string | null;
    visibilityMode: AcademicProfileVisibilityMode;
    permissions: AcademicProfilePermissionsDTO;
  }
): Promise<boolean> {
  const card = await findBestStudentReportCardForProfile(input);
  if (!card) {
    return false;
  }

  const [viewContext] = await Promise.all([loadStudentReportCardViewContext(card)]);
  const view = buildStudentReportCardViewData(card, viewContext);

  applyReportCardViewToAcademicProfile(profile, card, view, {
    subjectNamesById: viewContext.subjectNamesById,
    permissions: input.permissions,
  });

  return true;
}
