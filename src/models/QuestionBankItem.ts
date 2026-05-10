import { Schema, model, models, type Model, type Types } from "mongoose";
import {
  EXAM_QUESTION_DIFFICULTIES,
  EXAM_QUESTION_TYPES,
  QUESTION_BANK_ITEM_SOURCES,
  QUESTION_BANK_ITEM_STATUSES,
} from "@/constants/examinations";
import {
  ExamQuestionAttachmentSchema,
  ExamQuestionOptionSchema,
  ExamSubQuestionSchema,
  type IExamQuestionAttachment,
  type IExamQuestionOption,
  type IExamSubQuestion,
} from "@/models/ExamQuestion";
import type {
  ExamQuestionDifficulty,
  ExamQuestionType,
  QuestionBankItemSource,
  QuestionBankItemStatus,
} from "@/types/examinations";

export interface IQuestionBankItem {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  subjectId: Types.ObjectId;
  gradeId: Types.ObjectId;
  classGroupIds: Types.ObjectId[];
  curriculumId?: Types.ObjectId | null;
  curriculumNodeIds: Types.ObjectId[];
  schemeItemIds: Types.ObjectId[];
  lessonIds: Types.ObjectId[];
  lessonNoteIds: Types.ObjectId[];
  type: ExamQuestionType;
  prompt: string;
  plainTextPrompt?: string | null;
  options: IExamQuestionOption[];
  subQuestions: IExamSubQuestion[];
  marks: number;
  teacherIntendedDifficulty?: ExamQuestionDifficulty | null;
  aiEstimatedDifficulty?: ExamQuestionDifficulty | null;
  performanceDifficulty?: ExamQuestionDifficulty | null;
  topic?: string | null;
  subtopic?: string | null;
  tags: string[];
  expectedAnswer?: string | null;
  markingGuide?: string | null;
  explanation?: string | null;
  attachments: IExamQuestionAttachment[];
  createdBy: Types.ObjectId;
  originalTeacherId?: Types.ObjectId | null;
  firstUsedExamPaperId?: Types.ObjectId | null;
  lastUsedExamPaperId?: Types.ObjectId | null;
  usedCount: number;
  source: QuestionBankItemSource;
  status: QuestionBankItemStatus;
  createdAt: Date;
  updatedAt: Date;
}

const questionBankItemSchema = new Schema<IQuestionBankItem>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject", required: true, index: true },
    gradeId: { type: Schema.Types.ObjectId, ref: "Grade", required: true, index: true },
    classGroupIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "ClassGroup" }],
      default: [],
      index: true,
    },
    curriculumId: { type: Schema.Types.ObjectId, ref: "Curriculum", default: null, index: true },
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
    teacherIntendedDifficulty: {
      type: String,
      enum: [...EXAM_QUESTION_DIFFICULTIES],
      default: null,
      index: true,
    },
    aiEstimatedDifficulty: {
      type: String,
      enum: [...EXAM_QUESTION_DIFFICULTIES],
      default: null,
    },
    performanceDifficulty: {
      type: String,
      enum: [...EXAM_QUESTION_DIFFICULTIES],
      default: null,
      index: true,
    },
    topic: { type: String, trim: true, maxlength: 240, default: null, index: true },
    subtopic: { type: String, trim: true, maxlength: 240, default: null },
    tags: { type: [{ type: String, trim: true, maxlength: 80 }], default: [], index: true },
    expectedAnswer: { type: String, trim: true, maxlength: 30000, default: null },
    markingGuide: { type: String, trim: true, maxlength: 30000, default: null },
    explanation: { type: String, trim: true, maxlength: 20000, default: null },
    attachments: { type: [ExamQuestionAttachmentSchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    originalTeacherId: { type: Schema.Types.ObjectId, ref: "Teacher", default: null, index: true },
    firstUsedExamPaperId: { type: Schema.Types.ObjectId, ref: "ExamPaper", default: null },
    lastUsedExamPaperId: { type: Schema.Types.ObjectId, ref: "ExamPaper", default: null },
    usedCount: { type: Number, min: 0, default: 0 },
    source: {
      type: String,
      enum: [...QUESTION_BANK_ITEM_SOURCES],
      default: "manual",
      index: true,
    },
    status: {
      type: String,
      enum: [...QUESTION_BANK_ITEM_STATUSES],
      default: "draft",
      index: true,
    },
  },
  { timestamps: true }
);

questionBankItemSchema.index({
  schoolId: 1,
  subjectId: 1,
  gradeId: 1,
  status: 1,
  updatedAt: -1,
});
questionBankItemSchema.index({ schoolId: 1, type: 1, performanceDifficulty: 1 });
questionBankItemSchema.index({ schoolId: 1, tags: 1 });

export const QuestionBankItem: Model<IQuestionBankItem> =
  (models.QuestionBankItem as Model<IQuestionBankItem>) ||
  model<IQuestionBankItem>("QuestionBankItem", questionBankItemSchema);
