import type {
  ASSESSMENT_ENGINE_ASSESSMENT_TYPES,
  ASSESSMENT_ITEM_STATUSES,
  ASSESSMENT_ITEM_VISIBILITIES,
  ASSESSMENT_PLAN_STATUSES,
  ASSESSMENT_SCORE_STATUSES,
  ASSESSMENT_SOURCE_TYPES,
  CONTRIBUTION_MODES,
  GRADE_LABEL_MODES,
  GRADING_POLICY_STATUSES,
  MISSING_SCORE_POLICIES,
  REPORT_APPROVAL_ACTIONS,
  REPORT_APPROVAL_ENTITY_TYPES,
  REPORT_ATTENDANCE_SNAPSHOT_SOURCES,
  REPORT_CARD_RUN_STATUSES,
  ROUNDING_RULES,
  STUDENT_REPORT_CARD_STATUSES,
  SUBJECT_RESULT_STATUSES,
} from "@/constants/academics/assessment-engine";

export type GradeLabelMode = (typeof GRADE_LABEL_MODES)[number];
export type RoundingRule = (typeof ROUNDING_RULES)[number];
export type GradingPolicyStatus = (typeof GRADING_POLICY_STATUSES)[number];
export type ContributionMode = (typeof CONTRIBUTION_MODES)[number];
export type AssessmentPlanStatus = (typeof ASSESSMENT_PLAN_STATUSES)[number];
export type AssessmentSourceType = (typeof ASSESSMENT_SOURCE_TYPES)[number];
export type AssessmentItemVisibility =
  (typeof ASSESSMENT_ITEM_VISIBILITIES)[number];
export type AssessmentItemStatus = (typeof ASSESSMENT_ITEM_STATUSES)[number];
export type AssessmentScoreStatus = (typeof ASSESSMENT_SCORE_STATUSES)[number];
export type MissingScorePolicy = (typeof MISSING_SCORE_POLICIES)[number];
export type SubjectResultStatus = (typeof SUBJECT_RESULT_STATUSES)[number];
export type ReportCardRunStatus = (typeof REPORT_CARD_RUN_STATUSES)[number];
export type StudentReportCardStatus =
  (typeof STUDENT_REPORT_CARD_STATUSES)[number];
export type ReportAttendanceSnapshotSource =
  (typeof REPORT_ATTENDANCE_SNAPSHOT_SOURCES)[number];
export type ReportApprovalEntityType =
  (typeof REPORT_APPROVAL_ENTITY_TYPES)[number];
export type ReportApprovalAction = (typeof REPORT_APPROVAL_ACTIONS)[number];
export type AssessmentEngineAssessmentType =
  (typeof ASSESSMENT_ENGINE_ASSESSMENT_TYPES)[number];

export type ScoreComponent = {
  key: string;
  label: string;
  weight: number;
  order: number;
  required: boolean;
  allowedAssessmentTypes: string[];
};

export type GradeBoundary = {
  minPercentage: number;
  maxPercentage: number;
  gradeLabel: string;
  gradePoint?: number | null;
  descriptor?: string | null;
  isPassing?: boolean;
  colorToken?: string | null;
};

export type ComponentRule = {
  componentKey: string;
  contributionMode: ContributionMode;
  minItems?: number;
  maxItems?: number;
  bestN?: number;
  latestN?: number;
  dropLowestCount?: number;
  requiredAssessmentTypes?: string[];
  requiredItemLabels?: string[];
  allowManualOverride?: boolean;
  requireHomeroomApproval?: boolean;
  requireAdminApproval?: boolean;
};

export type MinimumCompletionRule = {
  componentKey?: string;
  minItems?: number;
  minPercentageComplete?: number;
  requireSubjectRemark?: boolean;
  blockSubmissionWhenMissing?: boolean;
};

export type SubjectResultComponentSnapshot = {
  componentKey: string;
  label: string;
  weight: number;
  rawScore: number;
  rawMaxScore: number;
  rawPercentage: number;
  weightedScore: number;
  includedAssessmentItemIds: string[];
  excludedAssessmentItemIds: string[];
  calculationMode: ContributionMode;
};

export type ReportCardRunReadinessSnapshot = {
  subjectsExpected: number;
  subjectsSubmitted: number;
  subjectsApproved: number;
  studentsExpected: number;
  studentsComplete: number;
  missingSubjectResults: string[];
  missingExamScores: string[];
  missingRequiredComponents: string[];
  attendanceReady: boolean;
  commentsReady: boolean;
  headteacherCommentReady: boolean;
};

export type ReportCardRunIssueSummary = {
  code: string;
  message: string;
  severity: "info" | "warning" | "error";
  entityType?: ReportApprovalEntityType;
  entityId?: string;
};

/** Base fields shared by tenant-owned assessment engine documents. */
export type AssessmentEngineTenantFields = {
  schoolId: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
};

/** DTO shape for grading policy list/detail surfaces. */
export type AcademicGradingPolicyDTO = AssessmentEngineTenantFields & {
  _id: string;
  name: string;
  description?: string | null;
  curriculumCode?: string | null;
  gradeLabelMode: GradeLabelMode;
  appliesToGradeIds: string[];
  appliesToGradeBandCodes: string[];
  isDefault: boolean;
  status: GradingPolicyStatus;
  scoreComponents: ScoreComponent[];
  gradeBoundaries: GradeBoundary[];
  passMark: number;
  roundingRule: RoundingRule;
  showClassPosition: boolean;
  showSubjectPosition: boolean;
  showGradeKey: boolean;
  allowTeacherContributionSelection: boolean;
  requireAdminApprovalForPolicyChanges: boolean;
  createdBy?: string | null;
  updatedBy?: string | null;
};

/** DTO shape for assessment plan list/detail surfaces. */
export type AssessmentPlanDTO = AssessmentEngineTenantFields & {
  _id: string;
  name: string;
  academicPeriodId: string;
  gradingPolicyId: string;
  appliesToGradeId: string;
  appliesToClassGroupIds: string[];
  curriculumCode?: string | null;
  status: AssessmentPlanStatus;
  componentRules: ComponentRule[];
  teacherCanCreateReportItems: boolean;
  teacherCanMarkItemsAsReportContributing: boolean;
  allowOfflineMarks: boolean;
  allowAppAssignmentImport: boolean;
  allowCsvImport: boolean;
  minimumCompletionRules?: MinimumCompletionRule[];
  createdBy?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | Date | null;
  lockedAt?: string | Date | null;
};

/** DTO shape for assessment item columns in gradebook v2. */
export type AssessmentItemDTO = AssessmentEngineTenantFields & {
  _id: string;
  academicPeriodId: string;
  assessmentPlanId: string;
  classGroupId: string;
  gradeId: string;
  subjectId: string;
  subjectOfferingId?: string | null;
  teacherId: string;
  title: string;
  description?: string | null;
  assessmentType: AssessmentEngineAssessmentType | string;
  sourceType: AssessmentSourceType;
  sourceRefType?: string | null;
  sourceRefId?: string | null;
  maxScore: number;
  dateAssigned?: string | Date | null;
  dateDue?: string | Date | null;
  assessedAt?: string | Date | null;
  componentKey?: string | null;
  contributesToReport: boolean;
  contributionLockedByRule: boolean;
  missingPolicy?: MissingScorePolicy;
  visibility: AssessmentItemVisibility;
  status: AssessmentItemStatus;
  createdBy?: string | null;
  updatedBy?: string | null;
};

/** DTO shape for per-student assessment scores. */
export type AssessmentScoreDTO = AssessmentEngineTenantFields & {
  _id: string;
  academicPeriodId: string;
  assessmentItemId: string;
  assessmentPlanId: string;
  classGroupId: string;
  subjectId: string;
  studentId: string;
  teacherId: string;
  score: number | null;
  maxScoreSnapshot: number;
  percentage: number | null;
  status: AssessmentScoreStatus;
  remarks?: string | null;
  gradedAt?: string | Date | null;
  recordedBy?: string | null;
  updatedBy?: string | null;
  sourceSubmissionId?: string | null;
};

/** DTO shape for calculated subject results. */
export type SubjectResultDTO = AssessmentEngineTenantFields & {
  _id: string;
  academicPeriodId: string;
  assessmentPlanId: string;
  gradingPolicyId: string;
  classGroupId: string;
  gradeId: string;
  subjectId: string;
  studentId: string;
  teacherId: string;
  components: SubjectResultComponentSnapshot[];
  finalScore: number;
  roundedFinalScore: number;
  gradeLabel: string;
  gradePoint?: number | null;
  descriptor?: string | null;
  isPassed: boolean;
  subjectPosition?: number | null;
  totalStudentsForSubject?: number | null;
  subjectRemark?: string | null;
  missingRequiredItems: string[];
  sourceAssessmentItemIds: string[];
  calculationSnapshot?: Record<string, unknown>;
  status: SubjectResultStatus;
  submittedBy?: string | null;
  submittedAt?: string | Date | null;
  returnedBy?: string | null;
  returnedAt?: string | Date | null;
  returnReason?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | Date | null;
  lockedAt?: string | Date | null;
};

/** DTO shape for class-level report card workflow runs. */
export type ReportCardRunDTO = AssessmentEngineTenantFields & {
  _id: string;
  academicPeriodId: string;
  classGroupId: string;
  gradeId: string;
  homeroomTeacherId: string;
  gradingPolicyId: string;
  assessmentPlanId: string;
  reportTemplateId?: string | null;
  status: ReportCardRunStatus;
  openedBy?: string | null;
  openedAt?: string | Date | null;
  compiledBy?: string | null;
  compiledAt?: string | Date | null;
  submittedBy?: string | null;
  submittedAt?: string | Date | null;
  approvedBy?: string | null;
  approvedAt?: string | Date | null;
  releasedBy?: string | null;
  releasedAt?: string | Date | null;
  releaseVisibility?: Record<string, unknown> | null;
  readinessSnapshot?: ReportCardRunReadinessSnapshot | null;
  issueSummary?: ReportCardRunIssueSummary[] | null;
};

/** DTO shape for frozen student report card snapshots. */
export type StudentReportCardDTO = AssessmentEngineTenantFields & {
  _id: string;
  academicPeriodId: string;
  reportCardRunId: string;
  studentId: string;
  classGroupId: string;
  gradeId: string;
  gradingPolicySnapshot: Record<string, unknown>;
  assessmentPlanSnapshot: Record<string, unknown>;
  reportTemplateSnapshot: Record<string, unknown>;
  studentSnapshot: Record<string, unknown>;
  schoolSnapshot: Record<string, unknown>;
  attendanceSnapshot: Record<string, unknown>;
  subjectResultsSnapshot: Record<string, unknown>[];
  termSummarySnapshot: Record<string, unknown>;
  commentsSnapshot: Record<string, unknown>;
  conductSnapshot?: Record<string, unknown> | null;
  promotionSnapshot?: Record<string, unknown> | null;
  verificationId?: string | null;
  pdfUrl?: string | null;
  status: StudentReportCardStatus;
  compiledAt?: string | Date | null;
  approvedAt?: string | Date | null;
  releasedAt?: string | Date | null;
};

/** DTO shape for report attendance snapshots sourced from homeroom records. */
export type ReportAttendanceSnapshotDTO = AssessmentEngineTenantFields & {
  _id: string;
  academicPeriodId: string;
  reportCardRunId: string;
  studentId: string;
  classGroupId: string;
  source: ReportAttendanceSnapshotSource;
  totalSchoolDays: number;
  daysPresent: number;
  daysAbsent: number;
  daysLate: number;
  daysExcused: number;
  attendancePercentage: number;
  calculatedFromDate: string | Date;
  calculatedToDate: string | Date;
  calculatedAt: string | Date;
};

/** DTO shape for report workflow audit entries. */
export type ReportApprovalLogDTO = AssessmentEngineTenantFields & {
  _id: string;
  reportCardRunId: string;
  studentReportCardId?: string | null;
  entityType: ReportApprovalEntityType;
  entityId: string;
  action: ReportApprovalAction | string;
  actorId: string;
  actorRole: string;
  note?: string | null;
  beforeStatus?: string | null;
  afterStatus?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string | Date;
};

export type TeacherGradebookClassGroupRef = {
  _id: string;
  name: string;
  label: string;
  gradeId: string;
  gradeName: string;
};

export type TeacherGradebookSubjectRef = {
  _id: string;
  name: string;
};

export type TeacherGradebookAcademicPeriodRef = {
  _id: string;
  yearLabel: string;
  term: string;
  isCurrent: boolean;
};

export type TeacherGradebookComponentItemSummary = {
  assessmentItemId: string;
  title: string;
  assessmentType: string;
  maxScore: number;
  contributesToReport: boolean;
  contributionLockedByRule: boolean;
  status: AssessmentItemStatus;
  scoredStudentCount: number;
  missingStudentCount: number;
  includedByRule: boolean;
};

export type TeacherGradebookComponentSummary = {
  componentKey: string;
  label: string;
  weight: number;
  required: boolean;
  contributionMode: ContributionMode;
  rule: ComponentRule;
  eligibleItemCount: number;
  contributingItemCount: number;
  items: TeacherGradebookComponentItemSummary[];
  studentsExpected: number;
  studentsFullyScored: number;
  ready: boolean;
  issues: Array<{
    code: string;
    message: string;
    severity: "info" | "warning" | "error";
  }>;
};

export type TeacherGradebookStudentScoreCell = {
  assessmentItemId: string;
  score: number | null;
  maxScore: number;
  percentage: number | null;
  status: AssessmentScoreStatus;
};

export type TeacherGradebookStudentPreview = {
  finalScore: number;
  roundedFinalScore: number;
  gradeLabel: string;
  gradePoint: number | null;
  isPassed: boolean;
  blocked: boolean;
  issueCount: number;
  missingRequiredItems: string[];
};

export type TeacherGradebookStudentRow = {
  _id: string;
  name: string;
  admissionNo?: string | null;
  scores: TeacherGradebookStudentScoreCell[];
  preview: TeacherGradebookStudentPreview | null;
  subjectResultId?: string | null;
  subjectResultStatus?: SubjectResultStatus | null;
};

export type TeacherGradebookReadinessChecklistItem = {
  key: string;
  label: string;
  complete: boolean;
};

export type TeacherGradebookReadiness = {
  assessmentPlanActive: boolean;
  hasAssessmentPlan: boolean;
  hasGradingPolicy: boolean;
  studentsExpected: number;
  assessmentItemCount: number;
  draftAssessmentItemCount: number;
  missingScoreCount: number;
  invalidScoreCount: number;
  blockedSubmission: boolean;
  canSubmit: boolean;
  checklist: TeacherGradebookReadinessChecklistItem[];
  issues: Array<{
    code: string;
    message: string;
    severity: "info" | "warning" | "error";
  }>;
};

/** Read payload for teacher marks gradebook v2 (Slice 8). */
export type TeacherGradebookV2DTO = {
  classGroup: TeacherGradebookClassGroupRef;
  subject: TeacherGradebookSubjectRef;
  academicPeriod: TeacherGradebookAcademicPeriodRef | null;
  assessmentPlan: AssessmentPlanDTO | null;
  gradingPolicy: AcademicGradingPolicyDTO | null;
  students: TeacherGradebookStudentRow[];
  assessmentItems: AssessmentItemDTO[];
  assessmentScores: AssessmentScoreDTO[];
  componentSummary: TeacherGradebookComponentSummary[];
  readiness: TeacherGradebookReadiness;
};

export type ReportCardRunSubjectReadinessRow = {
  subjectId: string;
  subjectName: string;
  teacherId?: string | null;
  teacherName?: string | null;
  submittedCount: number;
  approvedCount: number;
  studentsExpected: number;
  status: "missing" | "partial" | "submitted" | "approved";
  issues: string[];
};

export type ReportCardRunDetailDTO = ReportCardRunDTO & {
  classGroup: TeacherGradebookClassGroupRef;
  academicPeriod: TeacherGradebookAcademicPeriodRef;
  subjectReadiness: ReportCardRunSubjectReadinessRow[];
  studentReportCardCount: number;
};

export type ReportCardRunListItemDTO = ReportCardRunDTO & {
  classGroup: Pick<TeacherGradebookClassGroupRef, "_id" | "name" | "label">;
  academicPeriod: Pick<TeacherGradebookAcademicPeriodRef, "_id" | "yearLabel" | "term">;
};

export type SubjectResultPreviewStudentDTO = {
  studentId: string;
  name: string;
  admissionNo?: string | null;
  components: SubjectResultComponentSnapshot[];
  finalScore: number;
  roundedFinalScore: number;
  gradeLabel: string;
  gradePoint: number | null;
  descriptor: string | null;
  isPassed: boolean;
  blocked: boolean;
  issues: Array<{
    code: string;
    message: string;
    severity: "info" | "warning" | "error";
  }>;
  missingRequiredItems: string[];
  subjectResultId?: string | null;
  subjectResultStatus?: SubjectResultStatus | null;
  locked: boolean;
  subjectPosition?: number | null;
};

export type SubjectResultPreviewDTO = {
  classGroup: TeacherGradebookClassGroupRef;
  subject: TeacherGradebookSubjectRef;
  academicPeriod: TeacherGradebookAcademicPeriodRef;
  readiness: TeacherGradebookReadiness;
  students: SubjectResultPreviewStudentDTO[];
  summary: {
    totalStudents: number;
    calculableStudents: number;
    blockedStudents: number;
    lockedStudents: number;
  };
};

export type SubjectResultSubmitSummaryDTO = {
  submittedCount: number;
  skippedLockedCount: number;
  subjectResultIds: string[];
  status: Extract<SubjectResultStatus, "submitted">;
};
