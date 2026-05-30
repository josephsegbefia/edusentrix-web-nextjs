/**
 * Student Academic Profile DTO — read-only mirror of the assessment/report-card engine.
 * @see STUDENT_ACADEMIC_PROFILE_SPEC.md §7
 *
 * Replaces/evolves `StudentAcademicsDTO` over migration slices; old types remain in
 * `src/types/admin/student-academics.ts` until Slice 21.
 */

import type { SubjectResultStatus } from "@/types/academics/assessment-engine";
import type {
  RiskLevel,
  SchoolLevelForAcademics,
  StudentTermPerformanceTier,
  StudentTermTrend,
} from "@/types/admin/student-academics";

// ---------------------------------------------------------------------------
// Core enums
// ---------------------------------------------------------------------------

/** Who is viewing the profile; drives field filtering in the builder (§17). */
export type AcademicProfileVisibilityMode =
  | "admin"
  | "homeroom_teacher"
  | "subject_teacher"
  | "parent"
  | "student";

/** Overall record lifecycle for the selected period (§7, §4.1). */
export type AcademicRecordStatus =
  | "no_data"
  | "in_progress"
  | "submitted"
  | "compiled"
  | "approved"
  | "released"
  | "legacy";

/** Per-period timeline status shown in the period selector (§7.1, §8). */
export type AcademicPeriodProfileStatus =
  | "no_data"
  | "in_progress"
  | "compiled"
  | "approved"
  | "released"
  | "legacy";

/** Where profile rows were resolved from (priority order in spec §2). */
export type AcademicProfileDataSource =
  | "report_snapshot"
  | "subject_results"
  | "live_gradebook"
  | "legacy"
  | "none";

export type ScoreComponentStatus =
  | "complete"
  | "missing"
  | "not_required"
  | "provisional";

export type AcademicProfileAttendanceSource =
  | "live_homeroom_attendance"
  | "report_snapshot"
  | "none";

/** Term history point provenance (§7.8). */
export type AcademicTermHistorySource =
  | "official_released"
  | "projected_current"
  | "legacy_fallback";

/** Leo insight audience mode (§16.1). */
export type AcademicProfileInsightMode =
  | "admin"
  | "teacher"
  | "parent"
  | "student";

// ---------------------------------------------------------------------------
// §7.1 Period
// ---------------------------------------------------------------------------

export type AcademicProfilePeriodDTO = {
  academicPeriodId: string;
  label: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  status: AcademicPeriodProfileStatus;
  hasReportCard: boolean;
  isOfficial: boolean;
};

export type AcademicProfileSelectedPeriodDTO = {
  academicPeriodId: string | null;
  label: string | null;
};

// ---------------------------------------------------------------------------
// §7.2 Summary
// ---------------------------------------------------------------------------

export type AcademicProfileSubjectHighlightDTO = {
  subjectId: string;
  subjectName: string;
  score: number;
};

export type AcademicProfileSummaryDTO = {
  /** Display average when source is mixed or legacy; prefer final/projected when set. */
  overallAverage: number | null;
  /** Staff-only projected average while report is in progress (§7.2). */
  projectedAverage: number | null;
  /** Official average from released report snapshot (§7.2). */
  finalAverage: number | null;
  classPosition: number | null;
  totalStudents: number | null;
  totalSubjects: number;
  completedSubjects: number;
  missingSubjects: number;
  performanceTier: StudentTermPerformanceTier | null;
  trend: StudentTermTrend;
  trendDelta: number | null;
  riskLevel: RiskLevel | null;
  strongestSubject: AcademicProfileSubjectHighlightDTO | null;
  weakestSubject: AcademicProfileSubjectHighlightDTO | null;
};

// ---------------------------------------------------------------------------
// §7.3 Report status & readiness
// ---------------------------------------------------------------------------

export type AcademicProfileReadinessIssueDTO = {
  code: string;
  message: string;
  severity: "info" | "warning" | "error";
  subjectId?: string | null;
  subjectName?: string | null;
};

export type AcademicProfileReadinessDTO = {
  subjectsExpected: number;
  subjectsSubmitted: number;
  subjectsApproved: number;
  missingSubjects: Array<{
    subjectId: string;
    subjectName: string;
    reason?: string | null;
  }>;
  missingRequiredScores: Array<{
    subjectId: string;
    subjectName: string;
    componentKey?: string | null;
    label?: string | null;
  }>;
  attendanceReady: boolean;
  commentsReady: boolean;
  issues: AcademicProfileReadinessIssueDTO[];
};

export type AcademicProfileReportStatusDTO = {
  status: AcademicRecordStatus;
  label: string;
  isOfficial: boolean;
  isReleased: boolean;
  isProvisional: boolean;
  reportCardRunId: string | null;
  studentReportCardId: string | null;
  releasedAt: string | null;
  approvedAt: string | null;
  compiledAt: string | null;
  readiness: AcademicProfileReadinessDTO | null;
};

// ---------------------------------------------------------------------------
// §7.4 Subject results (dynamic components — no gradeLetter)
// ---------------------------------------------------------------------------

export type AcademicProfileScoreComponentDTO = {
  componentKey: string;
  label: string;
  weight: number;
  rawScore: number | null;
  rawMaxScore: number | null;
  rawPercentage: number | null;
  weightedScore: number | null;
  status: ScoreComponentStatus;
};

export type AcademicProfileSubjectResultDTO = {
  subjectId: string;
  subjectName: string;
  subjectCode: string | null;
  teacherId: string | null;
  teacherName: string | null;
  status: SubjectResultStatus | "snapshot" | "legacy" | string;
  components: AcademicProfileScoreComponentDTO[];
  finalScore: number | null;
  roundedFinalScore: number | null;
  gradeLabel: string | null;
  gradePoint: number | null;
  descriptor: string | null;
  isPassed: boolean | null;
  subjectPosition: number | null;
  totalStudentsForSubject: number | null;
  remark: string | null;
  isOfficial: boolean;
  hasBreakdown: boolean;
  issueCount: number;
};

// ---------------------------------------------------------------------------
// §7.5 Attendance
// ---------------------------------------------------------------------------

export type AcademicProfileAttendanceDTO = {
  source: AcademicProfileAttendanceSource;
  isSnapshot: boolean;
  totalSchoolDays: number | null;
  daysPresent: number | null;
  daysAbsent: number | null;
  daysLate: number | null;
  daysExcused: number | null;
  attendancePercentage: number | null;
  calculatedAt: string | null;
  note: string | null;
};

// ---------------------------------------------------------------------------
// §7.6 Assessment evidence (summary; detail on breakdown endpoint)
// ---------------------------------------------------------------------------

export type AcademicProfileEvidenceSubjectGapDTO = {
  subjectId: string;
  subjectName: string;
  missingCount: number;
};

export type AcademicProfileAssessmentEvidenceSummaryDTO = {
  countedItemsTotal: number;
  nonCountedItemsTotal: number;
  missingItemsTotal: number;
  subjectsWithMissingEvidence: AcademicProfileEvidenceSubjectGapDTO[];
};

/** Subject-level breakdown (Slice 8 API). */
export type AcademicProfileAssessmentEvidenceItemDTO = {
  assessmentItemId: string;
  title: string;
  assessmentType: string;
  componentKey: string;
  componentLabel: string;
  rawScore: number | null;
  rawMaxScore: number | null;
  rawPercentage: number | null;
  isCounted: boolean;
  isMissing: boolean;
  contributionMode: string | null;
  exclusionReason: string | null;
};

export type AcademicProfileSubjectBreakdownDTO = {
  studentId: string;
  academicPeriodId: string;
  subjectId: string;
  subjectName: string;
  dataSource: AcademicProfileDataSource;
  isOfficial: boolean;
  components: AcademicProfileScoreComponentDTO[];
  items: AcademicProfileAssessmentEvidenceItemDTO[];
  calculationExplanation: string | null;
};

// ---------------------------------------------------------------------------
// §7.7 Comments
// ---------------------------------------------------------------------------

export type AcademicProfileSubjectCommentDTO = {
  subjectId: string;
  subjectName: string;
  teacherId: string | null;
  teacherName: string | null;
  comment: string;
};

export type AcademicProfileCommentsDTO = {
  subjectComments: AcademicProfileSubjectCommentDTO[];
  classTeacherComment: string | null;
  headteacherComment: string | null;
  conduct: string | null;
  interest: string | null;
  attitude: string | null;
  /** Admin-only; omitted for parent/student builders (§7.7, §17). */
  internalNotes?: string | null;
};

// ---------------------------------------------------------------------------
// §7.8 Trends
// ---------------------------------------------------------------------------

export type AcademicProfileTermHistoryPointDTO = {
  academicPeriodId: string;
  label: string;
  averageScore: number | null;
  classPosition: number | null;
  classAverage: number | null;
  source: AcademicTermHistorySource;
  isOfficial: boolean;
};

export type AcademicProfileSubjectHistoryPointDTO = {
  academicPeriodId: string;
  periodLabel: string;
  roundedFinalScore: number | null;
  gradeLabel: string | null;
  source: AcademicTermHistorySource;
};

export type AcademicProfileComponentHistoryPointDTO = {
  academicPeriodId: string;
  periodLabel: string;
  subjectId: string;
  componentKey: string;
  rawPercentage: number | null;
};

export type AcademicProfileAttendanceHistoryPointDTO = {
  academicPeriodId: string;
  periodLabel: string;
  attendancePercentage: number | null;
  source: AcademicProfileAttendanceSource;
};

export type AcademicProfileTrendsDTO = {
  termHistory: AcademicProfileTermHistoryPointDTO[];
  subjectHistory: Record<string, AcademicProfileSubjectHistoryPointDTO[]>;
  componentHistory?: Record<string, AcademicProfileComponentHistoryPointDTO[]>;
  attendanceHistory: AcademicProfileAttendanceHistoryPointDTO[];
};

// ---------------------------------------------------------------------------
// §7.9 Report card actions
// ---------------------------------------------------------------------------

export type AcademicProfileReportCardDTO = {
  status: AcademicRecordStatus;
  canView: boolean;
  canDownload: boolean;
  downloadUrl: string | null;
  verificationId: string | null;
  releasedAt: string | null;
  templateName: string | null;
};

// ---------------------------------------------------------------------------
// §16 AI insights slot (loaded via separate route; metadata on profile)
// ---------------------------------------------------------------------------

export type AcademicProfileAIInsightsDTO = {
  mode: AcademicProfileInsightMode;
  available: boolean;
  isStale: boolean;
  generatedAt: string | null;
  dataFingerprint: string | null;
};

// ---------------------------------------------------------------------------
// Role permissions (§17)
// ---------------------------------------------------------------------------

export type AcademicProfilePermissionsDTO = {
  canViewProvisionalScores: boolean;
  canViewProjectedAverage: boolean;
  canViewReadiness: boolean;
  canViewMissingMarks: boolean;
  canViewInternalNotes: boolean;
  canViewBreakdown: boolean;
  canDownloadReport: boolean;
  canViewReportCard: boolean;
  canGenerateInsights: boolean;
  /** Subject IDs the viewer may see in full (subject teachers may be scoped). */
  visibleSubjectIds: string[] | null;
};

// ---------------------------------------------------------------------------
// Root DTO
// ---------------------------------------------------------------------------

export type StudentAcademicProfileDTO = {
  studentId: string;
  schoolId: string;
  classGroupId: string | null;
  gradeId: string | null;
  schoolLevel: SchoolLevelForAcademics | null;
  selectedPeriod: AcademicProfileSelectedPeriodDTO;
  periods: AcademicProfilePeriodDTO[];
  visibilityMode: AcademicProfileVisibilityMode;
  recordStatus: AcademicRecordStatus;
  dataSource: AcademicProfileDataSource;
  dataSourceNotes?: string[];
  summary: AcademicProfileSummaryDTO;
  reportStatus: AcademicProfileReportStatusDTO;
  subjectResults: AcademicProfileSubjectResultDTO[];
  attendance: AcademicProfileAttendanceDTO;
  assessmentEvidenceSummary: AcademicProfileAssessmentEvidenceSummaryDTO;
  comments: AcademicProfileCommentsDTO;
  trends: AcademicProfileTrendsDTO;
  aiInsights: AcademicProfileAIInsightsDTO;
  reportCard: AcademicProfileReportCardDTO;
  permissions: AcademicProfilePermissionsDTO;
};

export type StudentAcademicProfileResponse = {
  success: boolean;
  data: StudentAcademicProfileDTO;
};

export type StudentAcademicProfileBreakdownResponse = {
  success: boolean;
  data: AcademicProfileSubjectBreakdownDTO;
};

// ---------------------------------------------------------------------------
// Builder input (Slice 2+)
// ---------------------------------------------------------------------------

export type BuildStudentAcademicProfileParams = {
  schoolId: string;
  studentId: string;
  academicPeriodId?: string | null;
  visibilityMode: AcademicProfileVisibilityMode;
  /** When set, subject-teacher views may be limited to these subjects. */
  allowedSubjectIds?: string[] | null;
  /** School setting: parent/student may see in-progress progress (§7.2, §19). */
  allowProgressVisibility?: boolean;
};
