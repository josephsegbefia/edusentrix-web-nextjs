import type {
  EXAM_CONFLICT_SEVERITIES,
  EXAM_CONFLICT_SNAPSHOT_STATUSES,
  EXAM_CONFLICT_TYPES,
  EXAM_EXPORT_MODES,
  EXAM_EXPORT_PDF_TYPES,
  EXAM_INCIDENT_SEVERITIES,
  EXAM_INCIDENT_STATUSES,
  EXAM_INCIDENT_TYPES,
  EXAM_INVIGILATOR_ROLES,
  EXAM_INVIGILATOR_STATUSES,
  EXAM_SESSION_STATUSES,
  EXAM_STUDENT_SITTING_STATUSES,
  EXAM_TIMETABLE_ENTRY_STATUSES,
  EXAM_TIMETABLE_VERSION_STATUSES,
  EXAM_TYPES,
  EXAM_VENUE_TYPES,
} from "@/constants/academics/exam-scheduling-engine";

export type ExamSessionStatus = (typeof EXAM_SESSION_STATUSES)[number];
export type ExamType = (typeof EXAM_TYPES)[number];
export type ExamTimetableEntryStatus = (typeof EXAM_TIMETABLE_ENTRY_STATUSES)[number];
export type ExamInvigilatorRole = (typeof EXAM_INVIGILATOR_ROLES)[number];
export type ExamInvigilatorStatus = (typeof EXAM_INVIGILATOR_STATUSES)[number];
export type ExamVenueType = (typeof EXAM_VENUE_TYPES)[number];
export type ExamConflictType = (typeof EXAM_CONFLICT_TYPES)[number];
export type ExamConflictSeverity = (typeof EXAM_CONFLICT_SEVERITIES)[number];
export type ExamConflictSnapshotStatus = (typeof EXAM_CONFLICT_SNAPSHOT_STATUSES)[number];
export type ExamTimetableVersionStatus = (typeof EXAM_TIMETABLE_VERSION_STATUSES)[number];
export type ExamIncidentType = (typeof EXAM_INCIDENT_TYPES)[number];
export type ExamIncidentSeverity = (typeof EXAM_INCIDENT_SEVERITIES)[number];
export type ExamIncidentStatus = (typeof EXAM_INCIDENT_STATUSES)[number];
export type ExamStudentSittingStatusValue = (typeof EXAM_STUDENT_SITTING_STATUSES)[number];
export type ExamExportMode = (typeof EXAM_EXPORT_MODES)[number];
export type ExamExportPdfType = (typeof EXAM_EXPORT_PDF_TYPES)[number];

export type ExamConflictDTO = {
  key: string;
  type: ExamConflictType;
  severity: ExamConflictSeverity;
  message: string;
  affectedEntryIds: string[];
  affectedTeacherIds: string[];
  affectedClassGroupIds: string[];
  affectedVenueIds: string[];
  suggestion: string | null;
  canOverride: boolean;
  isOverridden?: boolean;
  overriddenBy?: string | null;
  overrideReason?: string | null;
  overriddenAt?: string | null;
};

export type ExamConflictPolicyDTO = {
  allowConflictOverride: boolean;
  requireOverrideReason: boolean;
};

export type ExamConflictSnapshotDTO = {
  id: string;
  examSessionId: string;
  status: ExamConflictSnapshotStatus;
  generatedAt: string;
  generatedBy: string | null;
};

export type ExamConflictCheckResultDTO = {
  examSessionId: string;
  checkedAt: string;
  snapshot: ExamConflictSnapshotDTO | null;
  policy: ExamConflictPolicyDTO;
  summary: {
    total: number;
    errors: number;
    warnings: number;
    info: number;
    overridden: number;
    readinessScore: number;
    entryCount: number;
  };
  grouped: {
    errors: ExamConflictDTO[];
    warnings: ExamConflictDTO[];
    info: ExamConflictDTO[];
  };
  conflicts: ExamConflictDTO[];
};

export type ExamSessionDTO = {
  id: string;
  schoolId: string;
  academicYearId: string | null;
  academicPeriodId: string;
  name: string;
  code: string | null;
  examType: ExamType;
  startDate: string;
  endDate: string;
  appliesToGradeIds: string[];
  appliesToClassGroupIds: string[];
  appliesToSubjectIds: string[];
  status: ExamSessionStatus;
  policyId: string | null;
  assessmentPlanId: string | null;
  gradingPolicyId: string | null;
  allowParentStudentVisibility: boolean;
  publishedAt: string | null;
  publishedBy: string | null;
  lockedAt: string | null;
  lockedBy: string | null;
  notes: string | null;
  createdBy: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ExamVenueDTO = {
  id: string;
  schoolId: string;
  name: string;
  code: string | null;
  type: ExamVenueType;
  capacity: number | null;
  locationNote: string | null;
  isActive: boolean;
  createdBy: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ExamTimetableEntryDTO = {
  id: string;
  schoolId: string;
  examSessionId: string;
  academicPeriodId: string;
  title: string | null;
  subjectId: string;
  gradeId: string | null;
  classGroupIds: string[];
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  venueId: string | null;
  roomLabel: string | null;
  capacityRequired: number | null;
  assessmentItemId: string | null;
  contributesToReport: boolean;
  assessmentComponentKey: string | null;
  maxScore: number | null;
  instructionsForInvigilators: string | null;
  instructionsForStudents: string | null;
  materialsAllowed: string[];
  specialNotes: string | null;
  status: ExamTimetableEntryStatus;
  isUnscheduled: boolean;
  createdBy: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ExamInvigilatorAssignmentDTO = {
  id: string;
  schoolId: string;
  examSessionId: string;
  examTimetableEntryId: string;
  teacherId: string;
  role: ExamInvigilatorRole;
  status: ExamInvigilatorStatus;
  assignedBy: string;
  assignedAt: string;
  acknowledgedAt: string | null;
  declinedAt: string | null;
  replacedByTeacherId: string | null;
  replacementReason: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ExamAssessmentLinkClassGroupRowDTO = {
  classGroupId: string;
  classGroupName: string | null;
  linkedAssessmentItemId: string | null;
  status: "linked" | "missing" | "not_required";
  validationErrors: string[];
};

export type ExamAssessmentLinkStatusDTO = {
  entryId: string;
  contributesToReport: boolean;
  required: boolean;
  isComplete: boolean;
  assessmentComponentKey: string | null;
  maxScore: number | null;
  classGroups: ExamAssessmentLinkClassGroupRowDTO[];
  validationErrors: string[];
};

export type ExamEntryMissingAssessmentLinkDTO = {
  entryId: string;
  title: string | null;
  subjectId: string;
  classGroupIds: string[];
  missingClassGroupIds: string[];
  contributesToReport: boolean;
  assessmentComponentKey: string | null;
};

export type ExamLinkableAssessmentItemDTO = {
  id: string;
  title: string;
  assessmentType: string;
  maxScore: number;
  componentKey: string | null;
  contributesToReport: boolean;
  status: string;
  isLinkedToEntry: boolean;
  isEligible: boolean;
  ineligibilityReason: string | null;
};

export type ExamPublishReadinessIssueDTO = {
  key: string;
  type: string;
  severity: "error" | "warning" | "info";
  message: string;
  affectedEntryIds: string[];
  canOverride: boolean;
  isOverridden: boolean;
  suggestion: string | null;
};

export type ExamPublishReadinessDTO = {
  examSessionId: string;
  checkedAt: string;
  canPublish: boolean;
  sessionStatus: ExamSessionStatus;
  currentVersionNumber: number | null;
  summary: {
    entryCount: number;
    scheduledEntryCount: number;
    unscheduledEntryCount: number;
    blockingCount: number;
    warningCount: number;
    infoCount: number;
    missingAssessmentLinkCount: number;
    readinessScore: number;
  };
  blockingIssues: ExamPublishReadinessIssueDTO[];
  warnings: ExamPublishReadinessIssueDTO[];
  infoNotices: ExamPublishReadinessIssueDTO[];
  assessmentLinks: {
    requiredEntryCount: number;
    completeEntryCount: number;
    missing: ExamEntryMissingAssessmentLinkDTO[];
  };
  conflictSummary: {
    total: number;
    errors: number;
    warnings: number;
    info: number;
    overridden: number;
  };
};

export type ExamTimetableVersionSnapshotDTO = {
  session: Record<string, unknown>;
  entries: Record<string, unknown>[];
  invigilators: Record<string, unknown>[];
  venues: Record<string, unknown>[];
};

export type ExamTimetableVersionDTO = {
  id: string;
  schoolId: string;
  examSessionId: string;
  versionNumber: number;
  status: ExamTimetableVersionStatus;
  changeSummary: string;
  snapshot: ExamTimetableVersionSnapshotDTO;
  publishedBy: string;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type ExamPublishResultDTO = {
  session: ExamSessionDTO;
  version: ExamTimetableVersionDTO;
  readiness: ExamPublishReadinessDTO;
};

export type TeacherExamInvigilationDutyDTO = {
  assignment: ExamInvigilatorAssignmentDTO;
  examSessionId: string;
  examSessionName: string;
  examSessionStatus: ExamSessionStatus;
  entryId: string;
  entryTitle: string | null;
  subjectId: string;
  subjectName: string | null;
  classGroupIds: string[];
  classGroupNames: string[];
  date: string;
  startTime: string;
  endTime: string;
  venueId: string | null;
  venueName: string | null;
  roomLabel: string | null;
  instructionsForInvigilators: string | null;
  canAcknowledge: boolean;
  entryStatus: ExamTimetableEntryStatus;
  dayOps: TeacherExamDayOpsDTO;
};

export type TeacherExamTimetableEntryDTO = {
  entryId: string;
  examSessionId: string;
  examSessionName: string;
  examType: ExamType;
  title: string | null;
  subjectId: string;
  subjectName: string | null;
  classGroupIds: string[];
  classGroupNames: string[];
  date: string;
  startTime: string;
  endTime: string;
  venueId: string | null;
  venueName: string | null;
  roomLabel: string | null;
  instructionsForStudents: string | null;
  status: ExamTimetableEntryStatus;
};

export type TeacherExamMarksPendingDTO = {
  assessmentItemId: string;
  assessmentItemTitle: string;
  assessmentItemStatus: string;
  maxScore: number;
  classGroupId: string;
  classGroupName: string | null;
  subjectId: string;
  subjectName: string | null;
  examEntryId: string;
  examSessionId: string;
  examSessionName: string;
  examDate: string;
  examStartTime: string;
  studentCount: number;
  missingScoreCount: number;
  gradebookPath: string;
};

export type TeacherExamSummaryDTO = {
  upcomingTimetableCount: number;
  pendingAcknowledgementCount: number;
  marksPendingCount: number;
};

export type ExamIncidentReportDTO = {
  id: string;
  schoolId: string;
  examSessionId: string;
  examTimetableEntryId: string;
  reportedBy: string;
  type: ExamIncidentType;
  severity: ExamIncidentSeverity;
  description: string;
  actionTaken: string | null;
  status: ExamIncidentStatus;
  createdAt: string;
  updatedAt: string;
};

export type ExamStudentSittingStatusDTO = {
  id: string;
  schoolId: string;
  examSessionId: string;
  examTimetableEntryId: string;
  studentId: string;
  status: ExamStudentSittingStatusValue;
  recordedBy: string;
  recordedAt: string;
  note: string | null;
};

export type TeacherExamDayOpsDTO = {
  entryId: string;
  entryStatus: ExamTimetableEntryStatus;
  canMarkStarted: boolean;
  canMarkCompleted: boolean;
  canReportIncident: boolean;
};

export type PublishedExamTimetableVersionInfoDTO = {
  versionNumber: number;
  publishedAt: string;
  changeSummary: string;
};

export type PublishedExamTimetableEntryDTO = {
  entryId: string;
  examSessionId: string;
  examSessionName: string;
  examType: ExamType;
  title: string | null;
  subjectId: string;
  subjectName: string | null;
  classGroupNames: string[];
  date: string;
  startTime: string;
  endTime: string;
  venueName: string | null;
  roomLabel: string | null;
  instructionsForStudents: string | null;
  materialsAllowed: string[];
  status: ExamTimetableEntryStatus;
  version: PublishedExamTimetableVersionInfoDTO | null;
};

export type PublishedExamTimetableDTO = {
  studentId: string;
  classGroupId: string;
  classGroupName: string | null;
  academicPeriodId: string;
  entries: PublishedExamTimetableEntryDTO[];
  lastUpdatedAt: string | null;
  latestVersionNumber: number | null;
};

export type ExamCalendarSyncResultDTO = {
  examSessionId: string;
  calendarId: string;
  versionNumber: number;
  createdCount: number;
  updatedCount: number;
  cancelledCount: number;
  linkedEventIds: string[];
};

export type ExamTimetableExportRowDTO = {
  date: string;
  startTime: string;
  endTime: string;
  classGroups: string;
  subject: string;
  venue: string;
  invigilators: string;
  status: string;
  instructions: string;
};

export type ExamSmartScheduleDraftItemDTO = {
  entryId: string;
  subjectId: string;
  subjectName: string | null;
  classGroupIds: string[];
  classGroupNames: string[];
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  venueId: string | null;
  venueName: string | null;
  suggestedInvigilatorTeacherId: string | null;
  suggestedInvigilatorName: string | null;
  explanation: string;
};

export type ExamSmartScheduleUnscheduledItemDTO = {
  entryId: string;
  subjectId: string;
  subjectName: string | null;
  classGroupIds: string[];
  classGroupNames: string[];
  reason: string;
};

export type ExamSmartScheduleProposalDTO = {
  examSessionId: string;
  generatedAt: string;
  confidenceScore: number;
  explanationSummary: string;
  warnings: string[];
  scheduledDrafts: ExamSmartScheduleDraftItemDTO[];
  unscheduledItems: ExamSmartScheduleUnscheduledItemDTO[];
  suggestedInvigilators: Array<{
    entryId: string;
    teacherId: string;
    teacherName: string | null;
    role: ExamInvigilatorRole;
    reason: string;
  }>;
};

export type ExamSmartScheduleApplyResultDTO = {
  updatedEntryCount: number;
  invigilatorSuggestionsCount: number;
  proposal: ExamSmartScheduleProposalDTO;
};

export type ExamPolicyDTO = {
  id: string;
  schoolId: string;
  name: string;
  isDefault: boolean;
  requireVenue: boolean;
  requireInvigilator: boolean;
  requireTeacherAcknowledgement: boolean;
  allowSubjectTeacherInvigilation: boolean;
  maxInvigilationSessionsPerTeacherPerDay: number | null;
  maxInvigilationSessionsPerTeacherPerSession: number | null;
  maxExamsPerClassPerDay: number | null;
  minBreakMinutesBetweenExams: number | null;
  preventRoomDoubleBooking: boolean;
  preventClassExamOverlap: boolean;
  preventTeacherInvigilationOverlap: boolean;
  preventHolidayScheduling: boolean;
  coreSubjectsMorningPreference: boolean;
  allowConflictOverride: boolean;
  requireOverrideReason: boolean;
  createdBy: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ExamSchedulingAnalyticsSessionHighlightDTO = {
  sessionId: string;
  sessionName: string;
  status: ExamSessionStatus;
  totalPapers: number;
  publishedPapers: number;
  conflictErrors: number;
  conflictWarnings: number;
  marksPendingPapers: number;
};

export type ExamSchedulingAnalyticsDTO = {
  generatedAt: string;
  academicPeriodId: string | null;
  summary: {
    activeSessionCount: number;
    totalPapers: number;
    publishedPapers: number;
    unscheduledPapers: number;
    openConflictErrors: number;
    openConflictWarnings: number;
    marksPendingPapers: number;
  };
  invigilationWorkload: Array<{
    teacherId: string;
    teacherName: string | null;
    assignmentCount: number;
  }>;
  sessionHighlights: ExamSchedulingAnalyticsSessionHighlightDTO[];
};

export type ExamLeoConflictExplainDTO = {
  disclaimer: string;
  explanation: string;
  likelyCauses: string[];
  suggestedFixes: string[];
};

export type ExamLeoScheduleImprovementsDTO = {
  disclaimer: string;
  summary: string;
  proposals: Array<{
    title: string;
    description: string;
    rationale: string;
    affectedEntryIds: string[];
  }>;
};

export type ExamLeoParentMessageDraftDTO = {
  disclaimer: string;
  subject: string;
  body: string;
};

export type ExamLeoInvigilatorSuggestionsDTO = {
  disclaimer: string;
  summary: string;
  candidates: Array<{
    teacherId: string;
    teacherName: string | null;
    rationale: string;
    workloadNote: string;
  }>;
};
