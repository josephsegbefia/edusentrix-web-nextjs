/**
 * Lesson Notes TypeScript Types
 *
 * These types are used across the application for:
 * - API request/response payloads
 * - React component props
 * - Form state management
 */

// ============================================================================
// Enums
// ============================================================================

export type LessonNoteTemplateType =
  | "NACCA_3_PHASE"
  | "CLASSIC_JHS"
  | "SIMPLE"
  | "CAMBRIDGE_3_PART"
  | "BRITISH_3_PART"
  | "AMERICAN_STANDARDS"
  | "IB_PYP_UNIT_PLANNER"
  | "IB_MYP_UNIT_PLANNER";

export type LessonNoteStatus = "draft" | "submitted" | "approved" | "rejected";

/** @deprecated Removed in Lessons v2 — treat as approved when reading legacy rows. */
export type LegacyLessonNotePublishedStatus = "published";

export const TEMPLATE_LABELS: Record<LessonNoteTemplateType, string> = {
  NACCA_3_PHASE: "NaCCA 3-Phase",
  CLASSIC_JHS: "Classic JHS",
  SIMPLE: "Quick Note",
  CAMBRIDGE_3_PART: "Cambridge 3-Part",
  BRITISH_3_PART: "British NC Lesson",
  AMERICAN_STANDARDS: "Standards-Based",
  IB_PYP_UNIT_PLANNER: "PYP Unit Planner",
  IB_MYP_UNIT_PLANNER: "MYP Unit Planner",
};

export const STATUS_LABELS: Record<LessonNoteStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved for delivery",
  rejected: "Rejected",
};

export const STATUS_COLORS: Record<LessonNoteStatus, string> = {
  draft: "bg-amber-500/20 text-amber-200",
  submitted: "bg-blue-500/20 text-blue-200",
  approved: "bg-emerald-500/20 text-emerald-200",
  rejected: "bg-rose-500/20 text-rose-200",
};

export type LessonNoteDeleteImpact = {
  noteId: string;
  topic: string;
  status: LessonNoteStatus;
  className: string | null;
  subjectName: string | null;
  weekOf: string | null;
  canDelete: boolean;
  blockReason: string | null;
  weekPlanCount: number;
  sessionCount: number;
  completedDeliveryCount: number;
  legacyLessonCount: number;
  linkedHomeworkCount: number;
  reviewCommentCount: number;
  warnings: string[];
};

export function normalizeLessonNoteStatus(status: string): LessonNoteStatus {
  if (status === "published") return "approved";
  if (
    status === "draft" ||
    status === "submitted" ||
    status === "approved" ||
    status === "rejected"
  ) {
    return status;
  }
  return "draft";
}

// ============================================================================
// Resource Types
// ============================================================================

export interface LessonNoteResource {
  title: string;
  url: string;
  type?: string;
}

export const RESOURCE_TYPES = [
  { value: "link", label: "Link" },
  { value: "pdf", label: "PDF" },
  { value: "video", label: "Video" },
  { value: "image", label: "Image" },
  { value: "doc", label: "Document" },
  { value: "slides", label: "Slides" },
  { value: "other", label: "Other" },
] as const;

// ============================================================================
// Curriculum Alignment
// ============================================================================

export interface CurriculumIndicator {
  refNo: string;
  text: string;
}

export interface CurriculumAlignment {
  strand?: string;
  subStrand?: string;
  contentStandard?: string;
  indicators: CurriculumIndicator[];
  learningOutcomes: string[];
}

// ============================================================================
// NaCCA 3-Phase Body
// ============================================================================

export interface NaCCAStarter {
  activities: string;
  rpkPrompt: string;
  engagementHook: string;
  timeMins: number;
}

export interface NaCCAMain {
  teacherActivities: string;
  learnerActivities: string;
  resourcesUsed: string;
  embeddedAssessment: string;
  differentiation?: string;
  groupingStrategy?: string;
  timeMins: number;
}

export interface NaCCAPlenary {
  summaryPoints: string;
  learnerReflection: string;
  teacherReflection: string;
  exitTicket?: string;
  homework?: string;
  timeMins: number;
}

export interface NaCCA3PhaseBody {
  starter: NaCCAStarter;
  main: NaCCAMain;
  plenary: NaCCAPlenary;
}

// Default values for new NaCCA notes
export const DEFAULT_NACCA_BODY: NaCCA3PhaseBody = {
  starter: {
    activities: "",
    rpkPrompt: "",
    engagementHook: "",
    timeMins: 10,
  },
  main: {
    teacherActivities: "",
    learnerActivities: "",
    resourcesUsed: "",
    embeddedAssessment: "",
    differentiation: "",
    groupingStrategy: "",
    timeMins: 25,
  },
  plenary: {
    summaryPoints: "",
    learnerReflection: "",
    teacherReflection: "",
    exitTicket: "",
    homework: "",
    timeMins: 5,
  },
};

// ============================================================================
// Classic JHS Body
// ============================================================================

export interface ClassicObjectives {
  general: string;
  specific: string[];
}

export interface ClassicPresentationStep {
  stepTitle: string;
  teacherActivity: string;
  learnerActivity: string;
  boardWork?: string;
  keyQuestions?: string[];
  timeMins: number;
}

export interface ClassicEvaluation {
  questions: string[];
  answers?: string[];
  markingNotes?: string;
}

export interface ClassicJHSBody {
  objectives: ClassicObjectives;
  rpk: string;
  introduction: string;
  presentationSteps: ClassicPresentationStep[];
  corePoints: string[];
  evaluation: ClassicEvaluation;
  remarks: string;
}

// Default values for new Classic JHS notes
export const DEFAULT_CLASSIC_BODY: ClassicJHSBody = {
  objectives: {
    general: "",
    specific: [""],
  },
  rpk: "",
  introduction: "",
  presentationSteps: [
    {
      stepTitle: "Step 1",
      teacherActivity: "",
      learnerActivity: "",
      boardWork: "",
      keyQuestions: [],
      timeMins: 10,
    },
  ],
  corePoints: [""],
  evaluation: {
    questions: [""],
    answers: [],
    markingNotes: "",
  },
  remarks: "",
};

// ============================================================================
// Simple Body (Legacy/Quick Notes)
// ============================================================================

export interface SimpleBody {
  objectives?: string;
  content: string;
}

export const DEFAULT_SIMPLE_BODY: SimpleBody = {
  objectives: "",
  content: "",
};

// ============================================================================
// Assessment
// ============================================================================

export interface LessonAssessment {
  inClassChecks: string[];
  exitTicket?: string;
  homework?: string;
  rubricId?: string;
}

export const DEFAULT_ASSESSMENT: LessonAssessment = {
  inClassChecks: [],
  exitTicket: "",
  homework: "",
};

// ============================================================================
// Reflections
// ============================================================================

export interface LessonReflections {
  learner?: string;
  teacher?: string;
  nextLessonLink?: string;
}

export const DEFAULT_REFLECTIONS: LessonReflections = {
  learner: "",
  teacher: "",
  nextLessonLink: "",
};

// ============================================================================
// Full Lesson Note (API Response)
// ============================================================================

export interface LessonNote {
  id: string;
  schoolId: string;
  teacherId: string;
  classGroupId: string;
  className?: string;
  subjectId?: string;
  subjectName?: string;
  academicPeriodId?: string;

  // Template & Curriculum
  templateType: LessonNoteTemplateType;
  curriculumCode?: string;
  curriculumMetadata?: Record<string, unknown>;
  unitPlannerData?: Record<string, unknown>;

  // Basic Info
  weekOf: string;
  date?: string;
  weekEndingDate?: string | null;
  topic: string;
  durationMinutes?: number;
  references: string[];

  // Curriculum
  curriculum?: CurriculumAlignment;

  // TLMs
  tlms: string[];

  // Body
  body?: NaCCA3PhaseBody | ClassicJHSBody | SimpleBody | null;

  // Assessment
  assessment?: LessonAssessment;

  // Reflections
  reflections?: LessonReflections;

  // Resources
  resources: LessonNoteResource[];

  // Tags
  tags: string[];

  // Status
  status: LessonNoteStatus;
  submittedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectionReason?: string;

  // Export
  exportUrls?: {
    pdf?: string;
    docx?: string;
    generatedAt?: string;
  };

  // Legacy
  content?: string;
  objectives?: string;

  /** Optional scheme of work alignment (Phase 2). */
  schemeId?: string | null;
  schemeItemIds?: string[];

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Form Types
// ============================================================================

export interface LessonNoteFormData {
  classGroupId: string;
  subjectId?: string;
  templateType: LessonNoteTemplateType;
  curriculumCode?: string;
  curriculumMetadata?: Record<string, unknown>;
  unitPlannerData?: Record<string, unknown>;
  weekOf: Date;
  date?: Date;
  weekEndingDate?: Date | null;
  topic: string;
  durationMinutes?: number;
  references: string[];
  curriculum: CurriculumAlignment;
  tlms: string[];
  body: NaCCA3PhaseBody | ClassicJHSBody | SimpleBody;
  assessment: LessonAssessment;
  reflections: LessonReflections;
  resources: LessonNoteResource[];
  tags: string[];
  status: LessonNoteStatus;

  schemeId?: string | null;
  schemeItemIds?: string[];
}

/** Timetable context shown when planning a lesson note from a scheme row. */
export type LessonNotePeriodPlanningContext = {
  periodsThisWeek: number | null;
  typicalPeriodMinutes: number;
  hasPublishedTimetable: boolean;
};

export const DEFAULT_FORM_DATA: Omit<LessonNoteFormData, "classGroupId"> = {
  templateType: "SIMPLE",
  weekOf: new Date(),
  topic: "",
  durationMinutes: 40,
  references: [],
  curriculum: {
    strand: "",
    subStrand: "",
    contentStandard: "",
    indicators: [],
    learningOutcomes: [],
  },
  tlms: [],
  body: DEFAULT_SIMPLE_BODY,
  assessment: DEFAULT_ASSESSMENT,
  reflections: DEFAULT_REFLECTIONS,
  resources: [],
  tags: [],
  status: "draft",
  schemeId: undefined,
  schemeItemIds: [],
};

// ============================================================================
// API Types
// ============================================================================

export interface CreateLessonNotePayload {
  classGroupId: string;
  subjectId?: string;
  templateType?: LessonNoteTemplateType;
  curriculumCode?: string;
  curriculumMetadata?: Record<string, unknown>;
  unitPlannerData?: Record<string, unknown>;
  weekOf: string;
  date?: string;
  weekEndingDate?: string | null;
  topic: string;
  durationMinutes?: number;
  references?: string[];
  curriculum?: CurriculumAlignment;
  tlms?: string[];
  body?: NaCCA3PhaseBody | ClassicJHSBody | SimpleBody;
  assessment?: LessonAssessment;
  reflections?: LessonReflections;
  resources?: LessonNoteResource[];
  tags?: string[];
  status?: LessonNoteStatus;

  // Legacy fields
  content?: string;
  objectives?: string;

  schemeId?: string | null;
  schemeItemIds?: string[] | null;
}

export interface UpdateLessonNotePayload extends Partial<CreateLessonNotePayload> {
  id: string;
}

export interface LessonNoteFilters {
  classGroupId?: string;
  subjectId?: string;
  academicPeriodId?: string;
  templateType?: LessonNoteTemplateType;
  weekOf?: string;
  status?: LessonNoteStatus;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface LessonNotesResponse {
  success: boolean;
  data: {
    entries: LessonNote[];
    total?: number;
    hasMore?: boolean;
  };
}

export interface LessonNoteResponse {
  success: boolean;
  data: LessonNote;
}

export type LessonNoteReviewCommentType =
  | "required_change"
  | "suggestion"
  | "question"
  | "commendation";

export type LessonNoteReviewCommentStatus = "open" | "addressed" | "resolved";

export interface LessonNoteReviewComment {
  id: string;
  lessonNoteId: string;
  sectionKey: string;
  sectionLabel: string;
  commentType: LessonNoteReviewCommentType;
  comment: string;
  status: LessonNoteReviewCommentStatus;
  authorId: string;
  authorName?: string;
  createdAt: string;
  updatedAt: string;
  addressedAt?: string | null;
  addressedBy?: string | null;
  addressedByName?: string | null;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
  resolvedByName?: string | null;
}

export interface LessonNoteDetail extends LessonNote {
  teacherName?: string | null;
  reviewComments: LessonNoteReviewComment[];
  openCommentCount: number;
  lessonsWorkflow?: {
    requireApprovedLessonNote: boolean;
  };
}

export interface LessonNoteDetailResponse {
  success: boolean;
  data: LessonNoteDetail;
}

export interface LessonNoteReviewCommentResponse {
  success: boolean;
  data: LessonNoteReviewComment;
}

export interface AdminLessonNoteFilters extends LessonNoteFilters {
  teacherId?: string;
}

export interface AdminLessonNote extends LessonNote {
  teacherName?: string | null;
  reviewComments?: LessonNoteReviewComment[];
  openCommentCount: number;
  totalCommentCount: number;
}

export interface AdminLessonNotesResponse {
  success: boolean;
  data: {
    entries: AdminLessonNote[];
    summary: {
      total: number;
      byStatus: Partial<Record<LessonNoteStatus, number>>;
      openComments: number;
    };
  };
}

// ============================================================================
// Wizard Step Types
// ============================================================================

export type WizardStep =
  | "context"
  | "curriculum"
  | "resources"
  | "body"
  | "assessment"
  | "review"
  // IB unit planner steps
  | "overview"
  | "planning"
  | "experiences"
  | "inquiry"
  | "reflection"
  | string;

export const WIZARD_STEPS: { id: WizardStep; label: string }[] = [
  { id: "context", label: "Context" },
  { id: "curriculum", label: "Curriculum" },
  { id: "resources", label: "Resources" },
  { id: "body", label: "Lesson Body" },
  { id: "assessment", label: "Assessment" },
  { id: "review", label: "Review" },
];

// ============================================================================
// Approval Types
// ============================================================================

export type ApprovalAction = "submit" | "approve" | "reject" | "revise";

export interface LessonNoteApproval {
  id: string;
  lessonNoteId: string;
  action: ApprovalAction;
  actorId: string;
  actorName?: string;
  comment?: string;
  timestamp: string;
}

export interface ApprovalPayload {
  action: "approve" | "reject";
  comment?: string;
}

// ============================================================================
// Export Types
// ============================================================================

export type ExportFormat = "pdf" | "docx";

export interface ExportOptions {
  format: ExportFormat;
  includeSchoolHeader?: boolean;
  includeReflections?: boolean;
}

// ============================================================================
// Common TLMs (Teaching Learning Materials)
// ============================================================================

export const COMMON_TLMS = [
  "Whiteboard",
  "Markers",
  "Textbook",
  "Workbook",
  "Number cards",
  "Flashcards",
  "Charts",
  "Posters",
  "Projector",
  "Computer/Laptop",
  "Manipulatives",
  "Counters",
  "Real objects",
  "Pictures",
  "Videos",
  "Audio recordings",
  "Measuring tools",
  "Models",
  "Maps",
  "Globes",
] as const;

// ============================================================================
// Validation Helpers
// ============================================================================

export function isNaCCA3PhaseBody(
  body: NaCCA3PhaseBody | ClassicJHSBody | SimpleBody | null | undefined
): body is NaCCA3PhaseBody {
  if (!body) return false;
  return "starter" in body && "main" in body && "plenary" in body;
}

export function isClassicJHSBody(
  body: NaCCA3PhaseBody | ClassicJHSBody | SimpleBody | null | undefined
): body is ClassicJHSBody {
  if (!body) return false;
  return "objectives" in body && "rpk" in body && "presentationSteps" in body;
}

export function isSimpleBody(
  body: NaCCA3PhaseBody | ClassicJHSBody | SimpleBody | null | undefined
): body is SimpleBody {
  if (!body) return false;
  return "content" in body && !("starter" in body) && !("presentationSteps" in body);
}

export function getDefaultBodyForTemplate(
  templateType: LessonNoteTemplateType
): NaCCA3PhaseBody | ClassicJHSBody | SimpleBody {
  switch (templateType) {
    case "NACCA_3_PHASE":
    case "CAMBRIDGE_3_PART":
    case "BRITISH_3_PART":
    case "AMERICAN_STANDARDS":
      return { ...DEFAULT_NACCA_BODY };
    case "CLASSIC_JHS":
      return { ...DEFAULT_CLASSIC_BODY };
    case "IB_PYP_UNIT_PLANNER":
    case "IB_MYP_UNIT_PLANNER":
    case "SIMPLE":
    default:
      return { ...DEFAULT_SIMPLE_BODY };
  }
}

const THREE_PHASE_TEMPLATES: LessonNoteTemplateType[] = [
  "NACCA_3_PHASE",
  "CAMBRIDGE_3_PART",
  "BRITISH_3_PART",
  "AMERICAN_STANDARDS",
];

export function isThreePhaseTemplate(templateType: LessonNoteTemplateType): boolean {
  return THREE_PHASE_TEMPLATES.includes(templateType);
}

export function isUnitPlannerTemplate(templateType: LessonNoteTemplateType): boolean {
  return templateType === "IB_PYP_UNIT_PLANNER" || templateType === "IB_MYP_UNIT_PLANNER";
}

export function calculateTotalTime(
  body: NaCCA3PhaseBody | ClassicJHSBody | SimpleBody | null | undefined,
  templateType: LessonNoteTemplateType
): number {
  if (!body) return 0;

  if (isThreePhaseTemplate(templateType) && isNaCCA3PhaseBody(body)) {
    return (
      (body.starter.timeMins || 0) +
      (body.main.timeMins || 0) +
      (body.plenary.timeMins || 0)
    );
  }

  if (templateType === "CLASSIC_JHS" && isClassicJHSBody(body)) {
    return body.presentationSteps.reduce(
      (sum, step) => sum + (step.timeMins || 0),
      0
    );
  }

  return 0;
}
