import { Schema, model, models, Types, type Model } from "mongoose";

// ============================================================================
// Enums & Basic Types
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

export type LessonNoteStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "published";

// ============================================================================
// Resource Type (Links, PDFs, Videos, etc.)
// ============================================================================

export interface ILessonNoteResource {
  title: string;
  url: string;
  type?: string; // link, pdf, video, image, doc, slides, other
}

// ============================================================================
// Curriculum Alignment
// ============================================================================

export interface ICurriculumIndicator {
  refNo: string; // e.g., "B4.2.1.1"
  text: string; // e.g., "Demonstrate understanding of fractions..."
}

export interface ICurriculumAlignment {
  strand?: string;
  subStrand?: string;
  contentStandard?: string;
  indicators: ICurriculumIndicator[];
  learningOutcomes: string[];
}

// ============================================================================
// NaCCA 3-Phase Body Structure (Primary)
// ============================================================================

export interface INaCCAStarter {
  activities: string;
  rpkPrompt: string; // Review of previous knowledge
  engagementHook: string; // Question, story, game
  timeMins: number;
}

export interface INaCCAMain {
  teacherActivities: string;
  learnerActivities: string;
  resourcesUsed: string;
  embeddedAssessment: string;
  differentiation?: string;
  groupingStrategy?: string;
  timeMins: number;
}

export interface INaCCAPlenary {
  summaryPoints: string;
  learnerReflection: string;
  teacherReflection: string;
  exitTicket?: string;
  homework?: string;
  timeMins: number;
}

export interface INaCCA3PhaseBody {
  starter: INaCCAStarter;
  main: INaCCAMain;
  plenary: INaCCAPlenary;
}

// ============================================================================
// Classic JHS Body Structure
// ============================================================================

export interface IClassicObjectives {
  general: string;
  specific: string[]; // 2-5 measurable objectives
}

export interface IClassicPresentationStep {
  stepTitle: string;
  teacherActivity: string;
  learnerActivity: string;
  boardWork?: string;
  keyQuestions?: string[];
  timeMins: number;
}

export interface IClassicEvaluation {
  questions: string[];
  answers?: string[];
  markingNotes?: string;
}

export interface IClassicJHSBody {
  objectives: IClassicObjectives;
  rpk: string; // Relevant Previous Knowledge
  introduction: string;
  presentationSteps: IClassicPresentationStep[];
  corePoints: string[]; // Board summary
  evaluation: IClassicEvaluation;
  remarks: string;
}

// ============================================================================
// Simple Body (Legacy/Quick Notes)
// ============================================================================

export interface ISimpleBody {
  objectives?: string;
  content: string;
}

// ============================================================================
// Assessment Section
// ============================================================================

export interface ILessonAssessment {
  inClassChecks: string[]; // Questions/tasks during lesson
  exitTicket?: string;
  homework?: string;
  rubricId?: Types.ObjectId;
}

// ============================================================================
// Reflections
// ============================================================================

export interface ILessonReflections {
  learner?: string; // What did students learn?
  teacher?: string; // What worked? What to improve?
  nextLessonLink?: string; // Connection to next lesson
}

// ============================================================================
// Export URLs
// ============================================================================

export interface IExportUrls {
  pdf?: string;
  docx?: string;
  generatedAt?: Date;
}

// ============================================================================
// Main LessonNote Interface
// ============================================================================

export interface ILessonNote {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  teacherId: Types.ObjectId;
  classGroupId: Types.ObjectId;
  subjectId?: Types.ObjectId;
  subjectOfferingId?: Types.ObjectId;
  subjectNameSnapshot?: string | null;
  subjectOfferingCodeSnapshot?: string | null;
  academicPeriodId?: Types.ObjectId;

  // Template & Curriculum
  templateType: LessonNoteTemplateType;
  curriculumCode?: string;
  curriculumMetadata?: Record<string, unknown>;
  unitPlannerData?: Record<string, unknown>;

  // Basic Info
  weekOf: Date;
  date?: Date; // Specific lesson date (optional)
  weekEndingDate?: Date | null;
  topic: string;
  durationMinutes?: number;
  references: string[]; // Textbook pages, curriculum references

  // Curriculum Alignment (NaCCA)
  curriculum?: ICurriculumAlignment;

  // Teaching & Learning Materials
  tlms: string[]; // e.g., ["Whiteboard", "Markers", "Number cards"]

  // Lesson Body (depends on templateType)
  body?: INaCCA3PhaseBody | IClassicJHSBody | ISimpleBody | null;

  // Assessment
  assessment?: ILessonAssessment;

  // Reflections (filled after lesson)
  reflections?: ILessonReflections;

  // External Resources (links, videos, etc.)
  resources: ILessonNoteResource[];

  // Tags for organization
  tags: string[];

  // Status & Workflow
  status: LessonNoteStatus;
  submittedAt?: Date;
  approvedAt?: Date;
  approvedBy?: Types.ObjectId;
  rejectionReason?: string;

  // Export
  exportUrls?: IExportUrls;

  // Upload source (if created from uploaded document)
  uploadedSourceUrl?: string;

  // Legacy field (for backwards compatibility)
  content?: string;
  objectives?: string;

  /** Optional link to an approved/active scheme of work (Phase 2 curriculum integration). */
  schemeId?: Types.ObjectId;
  /** One or more scheme items this lesson note aligns to (subset of scheme items). */
  schemeItemIds?: Types.ObjectId[];

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Mongoose Schemas
// ============================================================================

const ResourceSchema = new Schema<ILessonNoteResource>(
  {
    title: { type: String, required: true, trim: true },
    url: { type: String, default: "", trim: true },
    type: { type: String, trim: true },
  },
  { _id: false }
);

const CurriculumIndicatorSchema = new Schema<ICurriculumIndicator>(
  {
    refNo: { type: String, required: true, trim: true },
    text: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const CurriculumAlignmentSchema = new Schema<ICurriculumAlignment>(
  {
    strand: { type: String, trim: true },
    subStrand: { type: String, trim: true },
    contentStandard: { type: String, trim: true },
    indicators: { type: [CurriculumIndicatorSchema], default: [] },
    learningOutcomes: { type: [String], default: [] },
  },
  { _id: false }
);

// NaCCA 3-Phase Schemas
const NaCCAStarterSchema = new Schema<INaCCAStarter>(
  {
    activities: { type: String, default: "" },
    rpkPrompt: { type: String, default: "" },
    engagementHook: { type: String, default: "" },
    timeMins: { type: Number, default: 10 },
  },
  { _id: false }
);

const NaCCAMainSchema = new Schema<INaCCAMain>(
  {
    teacherActivities: { type: String, default: "" },
    learnerActivities: { type: String, default: "" },
    resourcesUsed: { type: String, default: "" },
    embeddedAssessment: { type: String, default: "" },
    differentiation: { type: String },
    groupingStrategy: { type: String },
    timeMins: { type: Number, default: 25 },
  },
  { _id: false }
);

const NaCCAPlenarySchema = new Schema<INaCCAPlenary>(
  {
    summaryPoints: { type: String, default: "" },
    learnerReflection: { type: String, default: "" },
    teacherReflection: { type: String, default: "" },
    exitTicket: { type: String },
    homework: { type: String },
    timeMins: { type: Number, default: 5 },
  },
  { _id: false }
);

// Classic JHS Schemas
const ClassicObjectivesSchema = new Schema<IClassicObjectives>(
  {
    general: { type: String, default: "" },
    specific: { type: [String], default: [] },
  },
  { _id: false }
);

const ClassicPresentationStepSchema = new Schema<IClassicPresentationStep>(
  {
    stepTitle: { type: String, default: "" },
    teacherActivity: { type: String, default: "" },
    learnerActivity: { type: String, default: "" },
    boardWork: { type: String },
    keyQuestions: { type: [String], default: [] },
    timeMins: { type: Number, default: 10 },
  },
  { _id: false }
);

const ClassicEvaluationSchema = new Schema<IClassicEvaluation>(
  {
    questions: { type: [String], default: [] },
    answers: { type: [String] },
    markingNotes: { type: String },
  },
  { _id: false }
);

// Assessment Schema
const LessonAssessmentSchema = new Schema<ILessonAssessment>(
  {
    inClassChecks: { type: [String], default: [] },
    exitTicket: { type: String },
    homework: { type: String },
    rubricId: { type: Schema.Types.ObjectId, ref: "Rubric" },
  },
  { _id: false }
);

// Reflections Schema
const LessonReflectionsSchema = new Schema<ILessonReflections>(
  {
    learner: { type: String },
    teacher: { type: String },
    nextLessonLink: { type: String },
  },
  { _id: false }
);

// Export URLs Schema
const ExportUrlsSchema = new Schema<IExportUrls>(
  {
    pdf: { type: String },
    docx: { type: String },
    generatedAt: { type: Date },
  },
  { _id: false }
);

// ============================================================================
// Main LessonNote Schema
// ============================================================================

const LessonNoteSchema = new Schema<ILessonNote>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
      index: true,
    },
    classGroupId: {
      type: Schema.Types.ObjectId,
      ref: "ClassGroup",
      required: true,
      index: true,
    },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject", index: true },
    subjectOfferingId: { type: Schema.Types.ObjectId, ref: "SubjectOffering", index: true },
    subjectNameSnapshot: { type: String, trim: true, default: null },
    subjectOfferingCodeSnapshot: { type: String, trim: true, default: null },
    academicPeriodId: {
      type: Schema.Types.ObjectId,
      ref: "AcademicPeriod",
      index: true,
    },

    // Template type & curriculum
    templateType: {
      type: String,
      enum: [
        "NACCA_3_PHASE",
        "CLASSIC_JHS",
        "SIMPLE",
        "CAMBRIDGE_3_PART",
        "BRITISH_3_PART",
        "AMERICAN_STANDARDS",
        "IB_PYP_UNIT_PLANNER",
        "IB_MYP_UNIT_PLANNER",
      ],
      default: "SIMPLE",
      index: true,
    },
    curriculumCode: { type: String, index: true },
    curriculumMetadata: { type: Schema.Types.Mixed },
    unitPlannerData: { type: Schema.Types.Mixed },

    // Basic info
    weekOf: { type: Date, required: true, index: true },
    date: { type: Date },
    weekEndingDate: { type: Date, default: null, index: true },
    topic: { type: String, required: true, trim: true, maxlength: 200 },
    durationMinutes: { type: Number, min: 5, max: 180 },
    references: { type: [String], default: [] },

    // Curriculum alignment
    curriculum: { type: CurriculumAlignmentSchema },

    // TLMs
    tlms: { type: [String], default: [] },

    // Body - stored as Mixed to support different template structures
    body: { type: Schema.Types.Mixed },

    // Assessment
    assessment: { type: LessonAssessmentSchema },

    // Reflections
    reflections: { type: LessonReflectionsSchema },

    // Resources
    resources: { type: [ResourceSchema], default: [] },

    // Tags
    tags: { type: [String], default: [] },

    // Status & workflow
    status: {
      type: String,
      enum: ["draft", "submitted", "approved", "rejected", "published"],
      default: "draft",
      index: true,
    },
    submittedAt: { type: Date },
    approvedAt: { type: Date },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    rejectionReason: { type: String, maxlength: 1000 },

    // Export
    exportUrls: { type: ExportUrlsSchema },

    // Upload source
    uploadedSourceUrl: { type: String },

    // Legacy fields (for backwards compatibility with existing notes)
    content: { type: String, trim: true, maxlength: 8000 },
    objectives: { type: String, trim: true, maxlength: 2000 },

    schemeId: { type: Schema.Types.ObjectId, ref: "SchemeOfWork", index: true },
    schemeItemIds: [{ type: Schema.Types.ObjectId, ref: "SchemeItem", index: true }],
  },
  { timestamps: true }
);

// ============================================================================
// Indexes
// ============================================================================

// Primary queries
LessonNoteSchema.index({
  schoolId: 1,
  teacherId: 1,
  classGroupId: 1,
  weekOf: -1,
});
LessonNoteSchema.index({
  schoolId: 1,
  teacherId: 1,
  subjectId: 1,
  weekOf: -1,
});
LessonNoteSchema.index({
  schoolId: 1,
  teacherId: 1,
  subjectOfferingId: 1,
  weekOf: -1,
});
LessonNoteSchema.index({ schoolId: 1, teacherId: 1, status: 1, weekOf: -1 });

// Approval workflow queries
LessonNoteSchema.index({ schoolId: 1, status: 1, submittedAt: -1 });

// Template type queries
LessonNoteSchema.index({ schoolId: 1, templateType: 1, status: 1 });

// Text search on topic
LessonNoteSchema.index({ topic: "text", tags: "text" });

// ============================================================================
// Export Model
// ============================================================================

export const LessonNote: Model<ILessonNote> =
  (models.LessonNote as Model<ILessonNote>) ||
  model<ILessonNote>("LessonNote", LessonNoteSchema);
