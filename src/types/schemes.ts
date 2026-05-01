export type SchemeStatus = "draft" | "in_review" | "approved" | "active" | "archived";

export interface SchemeRow {
  id: string;
  title: string;
  description: string | null;
  status: SchemeStatus;
  academicYearLabel: string | null;
  termLabel: string | null;
  gradeId: string | null;
  subjectId: string | null;
  ownerTeacherId: string | null;
  createdAt: string;
  updatedAt: string;
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
  sequence: number;
  title: string;
  learningObjective: string | null;
  notes: string | null;
  curriculumNodeIds: string[];
  suggestedLessonTemplateType: string | null;
  suggestedDurationMinutes: number | null;
  status: "draft" | "ready" | "dropped";
  coverageStatus: SchemeItemCoverageStatus;
  coverageNote: string | null;
  coverageUpdatedAt: string | null;
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

export interface SchemeReviewRow {
  id: string;
  schemeId: string;
  decision: "submitted" | "changes_requested" | "approved";
  note: string | null;
  actorUserId: string;
  actorTeacherId: string | null;
  createdAt: string;
}
