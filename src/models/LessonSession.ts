import { Schema, model, models, type Model, type Types } from "mongoose";
import {
  LESSON_CONTENT_BLOCK_TYPES,
  type LessonAccessibilityMeta,
  type LessonAssetMeta,
  type LessonContentBlockType,
  type LessonDiagramMeta,
  type LessonLanguageMeta,
  type LessonMathMeta,
  type LessonReviewMeta,
  type LessonSubjectMode,
} from "@/types/lesson-content-blocks";
import type { TeachingDeck } from "@/types/teaching-deck";

export type LessonSessionStatus = "draft" | "ready" | "published" | "archived";

export type LessonSessionStudentVisibility = "hidden" | "published";

export interface ILessonSessionNoteAllocation {
  schemeItemIds: Types.ObjectId[];
  noteSectionKeys: string[];
  coverageWeight: number;
}

export interface ILessonContentBlock {
  id: string;
  type: LessonContentBlockType;
  title?: string | null;
  bodyHtml: string;
  order: number;
  estimatedMinutes?: number | null;
  aiGenerated: boolean;
  teacherReviewed: boolean;
  resourceUrl?: string | null;
  subjectMode?: LessonSubjectMode;
  languageMeta?: LessonLanguageMeta | null;
  mathMeta?: LessonMathMeta | null;
  assetMeta?: LessonAssetMeta | null;
  reviewMeta?: LessonReviewMeta | null;
  accessibilityMeta?: LessonAccessibilityMeta | null;
  diagramMeta?: LessonDiagramMeta | null;
}

export type LessonAssessmentItemType =
  | "multiple_choice"
  | "short_answer"
  | "fill_blank"
  | "practical_task"
  | "project";

export interface ILessonAssessmentItem {
  id: string;
  type: LessonAssessmentItemType;
  title: string;
  question: string;
  options?: string[];
  correctAnswer?: string | null;
  rubric?: string | null;
  estimatedMinutes?: number | null;
  aiGenerated: boolean;
}

export interface ILessonSessionAiMetadata {
  leoGeneratedAt?: Date | null;
  teacherReviewedAllAi?: boolean;
}

export interface ILessonBoardNotes {
  contentHtml: string;
  generatedAt: Date;
  aiGenerated: boolean;
}

export interface ILessonSession {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  weekPlanId: Types.ObjectId;
  lessonNoteId: Types.ObjectId;
  classGroupId: Types.ObjectId;
  subjectOfferingId: Types.ObjectId;
  ownerTeacherId: Types.ObjectId;
  sequenceInWeek: number;
  timetableSlotId?: Types.ObjectId | null;
  timetableSlotIds?: Types.ObjectId[];
  scheduledDate: Date;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  title: string;
  status: LessonSessionStatus;
  noteSectionAllocation: ILessonSessionNoteAllocation;
  studentVisibility: LessonSessionStudentVisibility;
  parentVisibility: boolean;
  adminVisibility: boolean;
  contentVersion: number;
  /** Teacher session plan (manual, Phase B). */
  planNotes?: string | null;
  contentBlocks: ILessonContentBlock[];
  teachingDeck?: TeachingDeck | null;
  aiMetadata?: ILessonSessionAiMetadata;
  assessmentItems: ILessonAssessmentItem[];
  boardNotes?: ILessonBoardNotes | null;
  /** When true, notebook notes are visible to students after the class session is taught. */
  notebookNotesPublished?: boolean;
  /** When true, boosts this lesson in EduSentrix Learn Today's Journey ordering. */
  learnTeacherPriority?: boolean;
  /** Set when migrated from legacy `Lesson` for URL redirects. */
  legacyLessonId?: Types.ObjectId | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const contentBlockSchema = new Schema<ILessonContentBlock>(
  {
    id: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: LESSON_CONTENT_BLOCK_TYPES,
      required: true,
    },
    title: { type: String, trim: true, maxlength: 200, default: null },
    bodyHtml: { type: String, required: true, maxlength: 24_000, default: "" },
    order: { type: Number, required: true, min: 0 },
    estimatedMinutes: { type: Number, min: 0, max: 180, default: null },
    aiGenerated: { type: Boolean, default: false },
    teacherReviewed: { type: Boolean, default: false },
    resourceUrl: { type: String, trim: true, maxlength: 2000, default: null },
    subjectMode: { type: String, trim: true, maxlength: 40, default: null },
    languageMeta: { type: Schema.Types.Mixed, default: null },
    mathMeta: { type: Schema.Types.Mixed, default: null },
    assetMeta: { type: Schema.Types.Mixed, default: null },
    reviewMeta: { type: Schema.Types.Mixed, default: null },
    accessibilityMeta: { type: Schema.Types.Mixed, default: null },
    diagramMeta: { type: Schema.Types.Mixed, default: null },
  },
  { _id: false },
);

const teachingSlideSchema = new Schema(
  {
    id: { type: String, required: true },
    type: {
      type: String,
      enum: [
        "title",
        "content_block",
        "activity",
        "check",
        "discussion",
        "exit_ticket",
        "resource",
        "timer",
        "plan_notes",
      ],
      required: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 220 },
    bodyHtml: { type: String, maxlength: 24_000, default: null },
    speakerNotes: { type: String, maxlength: 8000, default: null },
    contentBlockId: { type: String, default: null },
    contentBlockType: { type: String, default: null },
    diagramMeta: { type: Schema.Types.Mixed, default: null },
    estimatedMinutes: { type: Number, min: 0, max: 180, default: null },
    resourceUrl: { type: String, maxlength: 2000, default: null },
    timerMinutes: { type: Number, min: 0, max: 120, default: null },
  },
  { _id: false },
);

const teachingDeckSchema = new Schema(
  {
    slides: { type: [teachingSlideSchema], default: [] },
    builtAt: { type: String, required: true },
    sourceContentVersion: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const aiMetadataSchema = new Schema<ILessonSessionAiMetadata>(
  {
    leoGeneratedAt: { type: Date, default: null },
    teacherReviewedAllAi: { type: Boolean, default: false },
  },
  { _id: false },
);

const assessmentItemSchema = new Schema<ILessonAssessmentItem>(
  {
    id: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["multiple_choice", "short_answer", "fill_blank", "practical_task", "project"],
      required: true,
    },
    title: { type: String, trim: true, maxlength: 300, default: "" },
    question: { type: String, trim: true, maxlength: 8000, default: "" },
    options: [{ type: String, trim: true, maxlength: 500 }],
    correctAnswer: { type: String, trim: true, maxlength: 2000, default: null },
    rubric: { type: String, trim: true, maxlength: 4000, default: null },
    estimatedMinutes: { type: Number, min: 0, max: 120, default: null },
    aiGenerated: { type: Boolean, default: true },
  },
  { _id: false },
);

const boardNotesSchema = new Schema<ILessonBoardNotes>(
  {
    contentHtml: { type: String, required: true, maxlength: 40_000 },
    generatedAt: { type: Date, required: true },
    aiGenerated: { type: Boolean, default: true },
  },
  { _id: false },
);

const noteAllocationSchema = new Schema<ILessonSessionNoteAllocation>(
  {
    schemeItemIds: [{ type: Schema.Types.ObjectId, ref: "SchemeItem" }],
    noteSectionKeys: [{ type: String, trim: true }],
    coverageWeight: { type: Number, default: 0, min: 0, max: 1 },
  },
  { _id: false },
);

const lessonSessionSchema = new Schema<ILessonSession>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    weekPlanId: { type: Schema.Types.ObjectId, ref: "LessonWeekPlan", required: true, index: true },
    lessonNoteId: { type: Schema.Types.ObjectId, ref: "LessonNote", required: true, index: true },
    classGroupId: { type: Schema.Types.ObjectId, ref: "ClassGroup", required: true, index: true },
    subjectOfferingId: {
      type: Schema.Types.ObjectId,
      ref: "SubjectOffering",
      required: true,
      index: true,
    },
    ownerTeacherId: { type: Schema.Types.ObjectId, ref: "Teacher", required: true, index: true },
    sequenceInWeek: { type: Number, required: true, min: 1 },
    timetableSlotId: { type: Schema.Types.ObjectId, ref: "TimetableSlot", default: null },
    timetableSlotIds: [{ type: Schema.Types.ObjectId, ref: "TimetableSlot", default: [] }],
    scheduledDate: { type: Date, required: true, index: true },
    dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
    startTime: { type: String, required: true, trim: true },
    endTime: { type: String, required: true, trim: true },
    durationMinutes: { type: Number, required: true, min: 1 },
    title: { type: String, trim: true, maxlength: 220, required: true },
    status: {
      type: String,
      enum: ["draft", "ready", "published", "archived"],
      default: "draft",
      index: true,
    },
    noteSectionAllocation: { type: noteAllocationSchema, default: () => ({}) },
    studentVisibility: {
      type: String,
      enum: ["hidden", "published"],
      default: "hidden",
    },
    parentVisibility: { type: Boolean, default: false },
    adminVisibility: { type: Boolean, default: true },
    contentVersion: { type: Number, default: 1 },
    planNotes: { type: String, trim: true, maxlength: 12000, default: null },
    contentBlocks: { type: [contentBlockSchema], default: [] },
    assessmentItems: { type: [assessmentItemSchema], default: [] },
    boardNotes: { type: boardNotesSchema, default: null },
    notebookNotesPublished: { type: Boolean, default: false },
    learnTeacherPriority: { type: Boolean, default: false },
    teachingDeck: { type: teachingDeckSchema, default: null },
    aiMetadata: { type: aiMetadataSchema, default: () => ({}) },
    legacyLessonId: { type: Schema.Types.ObjectId, ref: "Lesson", default: null, index: true },
  },
  { timestamps: true },
);

lessonSessionSchema.index({ schoolId: 1, weekPlanId: 1, sequenceInWeek: 1 }, { unique: true });
lessonSessionSchema.index(
  { schoolId: 1, legacyLessonId: 1 },
  { unique: true, partialFilterExpression: { legacyLessonId: { $type: "objectId" } } },
);

export const LessonSession: Model<ILessonSession> =
  (models.LessonSession as Model<ILessonSession>) ||
  model<ILessonSession>("LessonSession", lessonSessionSchema);
