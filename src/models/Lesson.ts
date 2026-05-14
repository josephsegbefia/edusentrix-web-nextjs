import { Schema, model, models, type Model, type Types } from "mongoose";

/**
 * Student-facing lesson instance created from a LessonNote.
 * Many lessons may reference the same note (reteach, reschedule).
 */
export type LessonDeliveryStatus = "draft" | "published" | "archived";

/** Frozen instructional payload copied from the lesson note at publish time. */
export interface ILessonPublishedSnapshot {
  topic: string;
  templateType: string;
  curriculumCode?: string;
  references: string[];
  curriculum?: unknown;
  tlms: string[];
  body: unknown;
  assessment?: unknown;
  resources: Array<{ title: string; url: string; type?: string }>;
  durationMinutes: number | null;
}

export interface ILessonTeachingSegment {
  title: string;
  durationMinutes?: number;
  teacherPrompt?: string;
  learnerActivity?: string;
  notes?: string;
  resources?: string[];
  order?: number;
}

export interface ILessonTeachingMode {
  enabled?: boolean;
  segments: ILessonTeachingSegment[];
  generatedFromLessonNote?: boolean;
  lastEditedBy?: Types.ObjectId;
  lastEditedAt?: Date;
}

export interface ILessonStudentContentVocabulary {
  term: string;
  definition: string;
}

export interface ILessonStudentContent {
  summaryHtml?: string;
  keyPoints: string[];
  vocabulary: ILessonStudentContentVocabulary[];
  studentInstructions?: string;
  practicePrompt?: string;
  estimatedReadingMinutes?: number;
  lastEditedBy?: Types.ObjectId;
  lastEditedAt?: Date;
  aiGenerated?: boolean;
  teacherReviewed?: boolean;
  aiTool?: string;
  aiGeneratedAt?: Date;
  aiAppliedBy?: Types.ObjectId;
}

export interface ILessonParentContent {
  summaryHtml?: string;
  howToHelpAtHome: string[];
  conversationStarters: string[];
  visible: boolean;
  aiGenerated?: boolean;
  teacherReviewed?: boolean;
}

export interface ILesson {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  /** Authoring teacher (copied from the lesson note). */
  teacherId: Types.ObjectId;
  lessonNoteId: Types.ObjectId;
  classGroupId: Types.ObjectId;
  subjectId?: Types.ObjectId;
  subjectOfferingId?: Types.ObjectId | null;
  academicPeriodId?: Types.ObjectId;

  title: string;
  /** When the lesson is scheduled for delivery (optional). */
  scheduledAt?: Date;

  status: LessonDeliveryStatus;
  publishedAt?: Date;
  /** Present when status has been `published` at least once (cleared when returned to `draft`). */
  publishedSnapshot?: ILessonPublishedSnapshot | null;
  /** Teacher-facing delivery plan (segments, prompts); optional. */
  teachingMode?: ILessonTeachingMode | null;
  /** Student-facing content edited by the teacher without mutating the source LessonNote. */
  studentContent?: ILessonStudentContent | null;
  /**
   * Teacher-approved HTML for caregivers, when the school enables parent-facing summaries.
   * Never exposed to students; parents see it only via guardian APIs when `SchoolSettings.lessonsModule` allows.
   */
  parentSummaryHtml?: string | null;
  parentContent?: ILessonParentContent | null;
  /**
   * Optional explicit co-authors (teacher IDs). These teachers can open and collaborate
   * on this lesson in addition to assignment-based co-teachers.
   */
  collaboratorTeacherIds?: Types.ObjectId[];

  /** Copied from lesson note / editable on lesson; optional curriculum alignment. */
  schemeId?: Types.ObjectId;
  schemeItemIds?: Types.ObjectId[];

  createdAt: Date;
  updatedAt: Date;
}

const lessonTeachingSegmentSchema = new Schema<ILessonTeachingSegment>(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    durationMinutes: { type: Number, min: 0, max: 600 },
    teacherPrompt: { type: String, trim: true, maxlength: 8000 },
    learnerActivity: { type: String, trim: true, maxlength: 8000 },
    notes: { type: String, trim: true, maxlength: 8000 },
    resources: { type: [String], default: [] },
    order: { type: Number, min: 0, default: 0 },
  },
  { _id: false }
);

const lessonTeachingModeSchema = new Schema<ILessonTeachingMode>(
  {
    enabled: { type: Boolean, default: true },
    segments: { type: [lessonTeachingSegmentSchema], default: [] },
    generatedFromLessonNote: { type: Boolean, default: false },
    lastEditedBy: { type: Schema.Types.ObjectId, ref: "User" },
    lastEditedAt: { type: Date },
  },
  { _id: false }
);

const lessonStudentContentVocabularySchema = new Schema<ILessonStudentContentVocabulary>(
  {
    term: { type: String, trim: true, maxlength: 160, required: true },
    definition: { type: String, trim: true, maxlength: 1000, required: true },
  },
  { _id: false }
);

const lessonStudentContentSchema = new Schema<ILessonStudentContent>(
  {
    summaryHtml: { type: String, trim: true, maxlength: 48_000 },
    keyPoints: { type: [String], default: [] },
    vocabulary: { type: [lessonStudentContentVocabularySchema], default: [] },
    studentInstructions: { type: String, trim: true, maxlength: 12_000 },
    practicePrompt: { type: String, trim: true, maxlength: 12_000 },
    estimatedReadingMinutes: { type: Number, min: 0, max: 600 },
    lastEditedBy: { type: Schema.Types.ObjectId, ref: "User" },
    lastEditedAt: { type: Date },
    aiGenerated: { type: Boolean, default: false },
    teacherReviewed: { type: Boolean, default: false },
    aiTool: { type: String, trim: true, maxlength: 120 },
    aiGeneratedAt: { type: Date },
    aiAppliedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { _id: false }
);

const lessonParentContentSchema = new Schema<ILessonParentContent>(
  {
    summaryHtml: { type: String, trim: true, maxlength: 48_000 },
    howToHelpAtHome: { type: [String], default: [] },
    conversationStarters: { type: [String], default: [] },
    visible: { type: Boolean, default: false },
    aiGenerated: { type: Boolean, default: false },
    teacherReviewed: { type: Boolean, default: false },
  },
  { _id: false }
);

const lessonSchema = new Schema<ILesson>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    teacherId: { type: Schema.Types.ObjectId, ref: "Teacher", required: true, index: true },
    lessonNoteId: {
      type: Schema.Types.ObjectId,
      ref: "LessonNote",
      required: true,
      index: true,
    },
    classGroupId: { type: Schema.Types.ObjectId, ref: "ClassGroup", required: true, index: true },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject", index: true },
    subjectOfferingId: { type: Schema.Types.ObjectId, ref: "SubjectOffering", default: null, index: true },
    academicPeriodId: { type: Schema.Types.ObjectId, ref: "AcademicPeriod", index: true },

    title: { type: String, required: true, trim: true, maxlength: 220 },
    scheduledAt: { type: Date },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
      index: true,
    },
    publishedAt: { type: Date },
    publishedSnapshot: { type: Schema.Types.Mixed, default: null },
    teachingMode: { type: lessonTeachingModeSchema, default: null },
    studentContent: { type: lessonStudentContentSchema, default: null },
    parentSummaryHtml: { type: String, default: null, maxlength: 48_000 },
    parentContent: { type: lessonParentContentSchema, default: null },
    collaboratorTeacherIds: [{ type: Schema.Types.ObjectId, ref: "Teacher", index: true }],
    schemeId: { type: Schema.Types.ObjectId, ref: "SchemeOfWork", index: true },
    schemeItemIds: [{ type: Schema.Types.ObjectId, ref: "SchemeItem", index: true }],
  },
  { timestamps: true }
);

lessonSchema.index({ schoolId: 1, teacherId: 1, updatedAt: -1 });
lessonSchema.index({ schoolId: 1, lessonNoteId: 1, createdAt: -1 });
lessonSchema.index({ schoolId: 1, classGroupId: 1, status: 1 });
lessonSchema.index({ schoolId: 1, schemeId: 1 });
lessonSchema.index({ schoolId: 1, subjectOfferingId: 1, status: 1 });

export const Lesson: Model<ILesson> =
  (models.Lesson as Model<ILesson>) || model<ILesson>("Lesson", lessonSchema);
