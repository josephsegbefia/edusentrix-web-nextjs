export type SchemeStatus =
  | "draft"
  | "submitted"
  | "needs_revision"
  | "approved"
  | "active"
  | "archived"
  | "rejected";

export interface SchemeRow {
  id: string;
  title: string;
  description: string | null;
  status: SchemeStatus;
  academicYearLabel: string | null;
  termLabel: string | null;
  academicPeriodId: string | null;
  academicYearId: string | null;
  termId: string | null;
  curriculumId: string | null;
  curriculumSubjectId: string | null;
  gradeId: string | null;
  classGroupId: string | null;
  subjectId: string | null;
  ownerTeacherId: string | null;
  sourceType: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  /** Set when the API enriches list/detail rows (class / subject / period labels). */
  gradeName?: string | null;
  subjectName?: string | null;
  academicPeriodLabel?: string | null;
}

export type SchemeItemCoverageStatus =
  | "not_started"
  | "in_progress"
  | "covered"
  | "skipped"
  | "moved"
  | "needs_review";

export interface SchemeItemRow {
  id: string;
  schemeId: string;
  weekNumber: number | null;
  lessonOrder: number | null;
  sequence: number;
  topic: string | null;
  subtopic: string | null;
  title: string | null;
  strand: string | null;
  subStrand: string | null;
  contentStandard: string | null;
  indicator: string | null;
  learningObjectives: string[];
  learningObjective: string | null;
  coreCompetencies: string[];
  teachingResources: string[];
  assessmentIdeas: string[];
  notes: string | null;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  curriculumNodeIds: string[];
  suggestedLessonTemplateType: string | null;
  suggestedDurationMinutes: number | null;
  status:
    | "not_started"
    | "in_progress"
    | "covered"
    | "skipped"
    | "moved"
    | "needs_review"
    | "draft"
    | "ready"
    | "dropped";
  coverageStatus: SchemeItemCoverageStatus;
  coverageNote: string | null;
  coverageUpdatedAt: string | null;
  lessonNoteCount?: number;
  createdAt: string;
  updatedAt: string;
}

/** Aggregate counts for a scheme’s planned rows (non-dropped items). */
export interface CoverageSummaryRow {
  totalItems: number;
  notStarted: number;
  inProgress: number;
  covered: number;
  skipped: number;
  moved: number;
  needsReview: number;
  coveragePercentage: number;
}

export type SchemeReviewDecisionType =
  | "submitted"
  | "approved"
  | "needs_revision"
  | "rejected"
  | "activated"
  | "archived";

export interface SchemeReviewRow {
  id: string;
  schemeId: string;
  decision: SchemeReviewDecisionType;
  note: string | null;
  actorUserId: string;
  actorTeacherId: string | null;
  actorRole?: string | null;
  createdAt: string;
}

/** Admin review desk queue row (GET /api/admin/schemes). */
export type AdminSchemeQueueRow = {
  id: string;
  title: string;
  status: SchemeStatus;
  subject?: { id: string; name: string };
  grade?: { id: string; name: string };
  classGroup?: { id: string; name: string } | null;
  academicYear?: { id: string; name: string };
  term?: { id: string; name: string };
  academicPeriodLabel?: string | null;
  ownerTeacher?: { id: string; name: string; email?: string } | null;
  itemCount: number;
  submittedAt?: string;
  updatedAt: string;
  sourceType?: string;
  description?: string | null;
};

export type AdminSchemeDetailPayload = {
  scheme: {
    id: string;
    title: string;
    description?: string;
    status: SchemeStatus;
    sourceType?: string;
    createdAt: string;
    updatedAt: string;
    submittedAt?: string;
    approvedAt?: string;
    activatedAt?: string;
    version: number;
  };
  academicContext: {
    curriculum?: { id: string; name: string } | null;
    academicYear?: { id: string; name: string } | null;
    term?: { id: string; name: string } | null;
    grade?: { id: string; name: string } | null;
    classGroup?: { id: string; name: string } | null;
    subject?: { id: string; name: string } | null;
  };
  ownerTeacher?: { id: string; name: string; email?: string } | null;
  items: Array<{
    id: string;
    weekNumber: number;
    lessonOrder?: number;
    topic: string;
    subtopic?: string;
    strand?: string;
    subStrand?: string;
    contentStandard?: string;
    indicator?: string;
    learningObjectives: string[];
    coreCompetencies?: string[];
    teachingResources?: string[];
    assessmentIdeas?: string[];
    plannedStartDate?: string;
    plannedEndDate?: string;
    coverageStatus?: string;
    status?: string;
  }>;
  reviews: Array<{
    id: string;
    decision: SchemeReviewDecisionType;
    note?: string;
    actor?: { id: string; name: string; role?: string };
    createdAt: string;
  }>;
};
