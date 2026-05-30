import type {
  AcademicProfileAIInsightsDTO,
  AcademicProfileAssessmentEvidenceSummaryDTO,
  AcademicProfileAttendanceDTO,
  AcademicProfileCommentsDTO,
  AcademicProfileInsightMode,
  AcademicProfilePermissionsDTO,
  AcademicProfileReportCardDTO,
  AcademicProfileReportStatusDTO,
  AcademicProfileSummaryDTO,
  AcademicProfileTrendsDTO,
  AcademicRecordStatus,
  StudentAcademicProfileDTO,
} from "@/types/academics/student-academic-profile";
import type { SchoolLevelForAcademics } from "@/types/admin/student-academics";

export function emptyAcademicProfileSummary(): AcademicProfileSummaryDTO {
  return {
    overallAverage: null,
    projectedAverage: null,
    finalAverage: null,
    classPosition: null,
    totalStudents: null,
    totalSubjects: 0,
    completedSubjects: 0,
    missingSubjects: 0,
    performanceTier: null,
    trend: "stable",
    trendDelta: null,
    riskLevel: null,
    strongestSubject: null,
    weakestSubject: null,
  };
}

export function emptyAcademicProfileReportStatus(
  status: AcademicRecordStatus = "no_data"
): AcademicProfileReportStatusDTO {
  return {
    status,
    label: status === "no_data" ? "No data" : status,
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
}

export function emptyAcademicProfileAttendance(): AcademicProfileAttendanceDTO {
  return {
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
  };
}

export function emptyAcademicProfileEvidenceSummary(): AcademicProfileAssessmentEvidenceSummaryDTO {
  return {
    countedItemsTotal: 0,
    nonCountedItemsTotal: 0,
    missingItemsTotal: 0,
    subjectsWithMissingEvidence: [],
  };
}

export function emptyAcademicProfileComments(): AcademicProfileCommentsDTO {
  return {
    subjectComments: [],
    classTeacherComment: null,
    headteacherComment: null,
    conduct: null,
    interest: null,
    attitude: null,
  };
}

export function emptyAcademicProfileTrends(): AcademicProfileTrendsDTO {
  return {
    termHistory: [],
    subjectHistory: {},
    attendanceHistory: [],
  };
}

export function emptyAcademicProfileReportCard(
  status: AcademicRecordStatus = "no_data"
): AcademicProfileReportCardDTO {
  return {
    status,
    canView: false,
    canDownload: false,
    downloadUrl: null,
    verificationId: null,
    releasedAt: null,
    templateName: null,
  };
}

export function emptyAcademicProfileAIInsights(
  mode: AcademicProfileInsightMode
): AcademicProfileAIInsightsDTO {
  return {
    mode,
    available: false,
    isStale: false,
    generatedAt: null,
    dataFingerprint: null,
  };
}

export function createEmptyStudentAcademicProfile(input: {
  studentId: string;
  schoolId: string;
  classGroupId?: string | null;
  gradeId?: string | null;
  schoolLevel?: SchoolLevelForAcademics | null;
  visibilityMode: StudentAcademicProfileDTO["visibilityMode"];
  permissions: AcademicProfilePermissionsDTO;
  insightMode: AcademicProfileInsightMode;
  selectedPeriodId?: string | null;
  selectedPeriodLabel?: string | null;
  periods?: StudentAcademicProfileDTO["periods"];
  recordStatus?: AcademicRecordStatus;
  dataSourceNotes?: string[];
}): StudentAcademicProfileDTO {
  const recordStatus = input.recordStatus ?? "no_data";

  return {
    studentId: input.studentId,
    schoolId: input.schoolId,
    classGroupId: input.classGroupId ?? null,
    gradeId: input.gradeId ?? null,
    schoolLevel: input.schoolLevel ?? null,
    selectedPeriod: {
      academicPeriodId: input.selectedPeriodId ?? null,
      label: input.selectedPeriodLabel ?? null,
    },
    periods: input.periods ?? [],
    visibilityMode: input.visibilityMode,
    recordStatus,
    dataSource: "none",
    dataSourceNotes: input.dataSourceNotes,
    summary: emptyAcademicProfileSummary(),
    reportStatus: emptyAcademicProfileReportStatus(recordStatus),
    subjectResults: [],
    attendance: emptyAcademicProfileAttendance(),
    assessmentEvidenceSummary: emptyAcademicProfileEvidenceSummary(),
    comments: emptyAcademicProfileComments(),
    trends: emptyAcademicProfileTrends(),
    aiInsights: emptyAcademicProfileAIInsights(input.insightMode),
    reportCard: emptyAcademicProfileReportCard(recordStatus),
    permissions: input.permissions,
  };
}
