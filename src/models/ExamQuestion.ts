import { Schema, model, models, type Model, type Types } from "mongoose";
import {
  EXAM_QUESTION_ATTACHMENT_DISPLAY_MODES,
  EXAM_QUESTION_ATTACHMENT_TYPES,
  EXAM_QUESTION_DIFFICULTIES,
  EXAM_QUESTION_SOURCES,
  EXAM_QUESTION_TYPES,
} from "@/constants/examinations";
import type {
  ExamQuestionDifficulty,
  ExamQuestionSource,
  ExamQuestionType,
} from "@/types/examinations";

export interface IExamQuestionOption {
  id: string;
  label: string;
  text: string;
  isCorrect?: boolean;
}

export interface IExamSubQuestion {
  label: string;
  prompt: string;
  marks: number;
  expectedAnswer?: string | null;
  markingGuide?: string | null;
}

export interface IExamQuestionAttachment {
  id: string;
  type: string;
  url: string;
  uploadKey?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  caption?: string | null;
  altText?: string | null;
  displayMode: string;
}

export interface IExamQuestion {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  examPaperId?: Types.ObjectId | null;
  sectionId?: Types.ObjectId | null;
  questionBankItemId?: Types.ObjectId | null;
  type: ExamQuestionType;
  prompt: string;
  plainTextPrompt?: string | null;
  options: IExamQuestionOption[];
  subQuestions: IExamSubQuestion[];
  marks: number;
  difficulty: ExamQuestionDifficulty;
  topic?: string | null;
  subtopic?: string | null;
  curriculumNodeIds: Types.ObjectId[];
  schemeItemIds: Types.ObjectId[];
  lessonIds: Types.ObjectId[];
  lessonNoteIds: Types.ObjectId[];
  expectedAnswer?: string | null;
  markingGuide?: string | null;
  explanation?: string | null;
  attachments: IExamQuestionAttachment[];
  order: number;
  createdBy: Types.ObjectId;
  teacherId?: Types.ObjectId | null;
  source: ExamQuestionSource;
  createdAt: Date;
  updatedAt: Date;
}

export const ExamQuestionOptionSchema = new Schema<IExamQuestionOption>(
  {
    id: { type: String, required: true, trim: true, maxlength: 40 },
    label: { type: String, required: true, trim: true, maxlength: 12 },
    text: { type: String, required: true, trim: true, maxlength: 8000 },
    isCorrect: { type: Boolean, default: false },
  },
  { _id: false }
);

export const ExamSubQuestionSchema = new Schema<IExamSubQuestion>(
  {
    label: { type: String, required: true, trim: true, maxlength: 20 },
    prompt: { type: String, required: true, trim: true, maxlength: 12000 },
    marks: { type: Number, required: true, min: 0, default: 0 },
    expectedAnswer: { type: String, trim: true, maxlength: 20000, default: null },
    markingGuide: { type: String, trim: true, maxlength: 20000, default: null },
  },
  { _id: false }
);

export const ExamQuestionAttachmentSchema =
  new Schema<IExamQuestionAttachment>(
    {
      id: { type: String, required: true, trim: true, maxlength: 80 },
      type: {
        type: String,
        enum: [...EXAM_QUESTION_ATTACHMENT_TYPES],
        required: true,
        default: "image",
      },
      url: { type: String, required: true, trim: true, maxlength: 4000 },
      uploadKey: { type: String, trim: true, maxlength: 1000, default: null },
      fileName: { type: String, trim: true, maxlength: 500, default: null },
      mimeType: { type: String, trim: true, maxlength: 200, default: null },
      caption: { type: String, trim: true, maxlength: 1000, default: null },
      altText: { type: String, trim: true, maxlength: 1000, default: null },
      displayMode: {
        type: String,
        enum: [...EXAM_QUESTION_ATTACHMENT_DISPLAY_MODES],
        default: "above_question",
      },
    },
    { _id: false }
  );

const examQuestionSchema = new Schema<IExamQuestion>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    examPaperId: { type: Schema.Types.ObjectId, ref: "ExamPaper", default: null, index: true },
    sectionId: {
      type: Schema.Types.ObjectId,
      ref: "ExamPaperSection",
      default: null,
      index: true,
    },
    questionBankItemId: {
      type: Schema.Types.ObjectId,
      ref: "QuestionBankItem",
      default: null,
      index: true,
    },
    type: {
      type: String,
      enum: [...EXAM_QUESTION_TYPES],
      required: true,
      index: true,
    },
    prompt: { type: String, required: true, trim: true, maxlength: 30000 },
    plainTextPrompt: { type: String, trim: true, maxlength: 30000, default: null },
    options: { type: [ExamQuestionOptionSchema], default: [] },
    subQuestions: { type: [ExamSubQuestionSchema], default: [] },
    marks: { type: Number, required: true, min: 0, default: 1 },
    difficulty: {
      type: String,
      enum: [...EXAM_QUESTION_DIFFICULTIES],
      default: "medium",
      index: true,
    },
    topic: { type: String, trim: true, maxlength: 240, default: null, index: true },
    subtopic: { type: String, trim: true, maxlength: 240, default: null },
    curriculumNodeIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "CurriculumNode" }],
      default: [],
      index: true,
    },
    schemeItemIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "SchemeItem" }],
      default: [],
      index: true,
    },
    lessonIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "Lesson" }],
      default: [],
      index: true,
    },
    lessonNoteIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "LessonNote" }],
      default: [],
      index: true,
    },
    expectedAnswer: { type: String, trim: true, maxlength: 30000, default: null },
    markingGuide: { type: String, trim: true, maxlength: 30000, default: null },
    explanation: { type: String, trim: true, maxlength: 20000, default: null },
    attachments: { type: [ExamQuestionAttachmentSchema], default: [] },
    order: { type: Number, required: true, min: 0, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    teacherId: { type: Schema.Types.ObjectId, ref: "Teacher", default: null, index: true },
    source: {
      type: String,
      enum: [...EXAM_QUESTION_SOURCES],
      default: "manual",
      index: true,
    },
  },
  { timestamps: true }
);

examQuestionSchema.index({ schoolId: 1, examPaperId: 1, sectionId: 1, order: 1 });
examQuestionSchema.index({ schoolId: 1, type: 1, difficulty: 1 });

export const ExamQuestion: Model<IExamQuestion> =
  (models.ExamQuestion as Model<IExamQuestion>) ||
  model<IExamQuestion>("ExamQuestion", examQuestionSchema);
