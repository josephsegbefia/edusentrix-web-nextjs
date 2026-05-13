import { Schema, model, models, type Model, type Types } from "mongoose";
import {
  EXAM_PAPER_OWNER_ROLES,
  EXAM_PAPER_SCOPES,
  EXAM_PAPER_SOURCE_MODES,
  EXAM_PAPER_STATUSES,
} from "@/constants/examinations";
import type {
  ExamPaperOwnerRole,
  ExamPaperScope,
  ExamPaperSourceMode,
  ExamPaperStatus,
} from "@/types/examinations";

export interface IExamPaper {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  title: string;
  examTypeId: Types.ObjectId;
  academicYearId: Types.ObjectId;
  termId?: Types.ObjectId | null;
  academicPeriodId?: Types.ObjectId | null;
  scope: ExamPaperScope;
  gradeId: Types.ObjectId;
  classGroupId?: Types.ObjectId | null;
  classGroupIds: Types.ObjectId[];
  subjectId: Types.ObjectId;
  subjectOfferingId?: Types.ObjectId | null;
  teacherId?: Types.ObjectId | null;
  leadSetterId?: Types.ObjectId | null;
  contributorIds: Types.ObjectId[];
  setBy?: Types.ObjectId | null;
  createdBy: Types.ObjectId;
  ownerRole: ExamPaperOwnerRole;
  durationMinutes?: number | null;
  totalMarks: number;
  instructions?: string | null;
  candidateInstructions?: string | null;
  status: ExamPaperStatus;
  sourceMode: ExamPaperSourceMode;
  scheduledExamDate?: Date | null;
  submittedAt?: Date | null;
  approvedAt?: Date | null;
  approvedBy?: Types.ObjectId | null;
  completedAt?: Date | null;
  archivedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const examPaperSchema = new Schema<IExamPaper>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 220 },
    examTypeId: { type: Schema.Types.ObjectId, ref: "ExamType", required: true, index: true },
    academicYearId: {
      type: Schema.Types.ObjectId,
      ref: "AcademicPeriod",
      required: true,
      index: true,
    },
    termId: { type: Schema.Types.ObjectId, ref: "AcademicPeriod", default: null, index: true },
    academicPeriodId: {
      type: Schema.Types.ObjectId,
      ref: "AcademicPeriod",
      default: null,
      index: true,
    },
    scope: {
      type: String,
      enum: [...EXAM_PAPER_SCOPES],
      required: true,
      default: "class_group",
      index: true,
    },
    gradeId: { type: Schema.Types.ObjectId, ref: "Grade", required: true, index: true },
    classGroupId: { type: Schema.Types.ObjectId, ref: "ClassGroup", default: null, index: true },
    classGroupIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "ClassGroup" }],
      default: [],
      index: true,
    },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject", required: true, index: true },
    subjectOfferingId: { type: Schema.Types.ObjectId, ref: "SubjectOffering", default: null, index: true },
    teacherId: { type: Schema.Types.ObjectId, ref: "Teacher", default: null, index: true },
    leadSetterId: { type: Schema.Types.ObjectId, ref: "Teacher", default: null, index: true },
    contributorIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "Teacher" }],
      default: [],
      index: true,
    },
    setBy: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    ownerRole: {
      type: String,
      enum: [...EXAM_PAPER_OWNER_ROLES],
      required: true,
      default: "teacher",
      index: true,
    },
    durationMinutes: { type: Number, min: 1, default: null },
    totalMarks: { type: Number, min: 0, default: 0 },
    instructions: { type: String, trim: true, maxlength: 8000, default: null },
    candidateInstructions: { type: String, trim: true, maxlength: 8000, default: null },
    status: {
      type: String,
      enum: [...EXAM_PAPER_STATUSES],
      default: "draft",
      index: true,
    },
    sourceMode: {
      type: String,
      enum: [...EXAM_PAPER_SOURCE_MODES],
      default: "manual",
      index: true,
    },
    scheduledExamDate: { type: Date, default: null, index: true },
    submittedAt: { type: Date, default: null },
    approvedAt: { type: Date, default: null },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    completedAt: { type: Date, default: null },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

examPaperSchema.index({ schoolId: 1, status: 1, updatedAt: -1 });
examPaperSchema.index({
  schoolId: 1,
  academicYearId: 1,
  termId: 1,
  gradeId: 1,
  subjectId: 1,
  status: 1,
});
examPaperSchema.index({
  schoolId: 1,
  academicYearId: 1,
  termId: 1,
  gradeId: 1,
  subjectOfferingId: 1,
  status: 1,
});
examPaperSchema.index({ schoolId: 1, leadSetterId: 1, status: 1 });
examPaperSchema.index({ schoolId: 1, contributorIds: 1, status: 1 });

export const ExamPaper: Model<IExamPaper> =
  (models.ExamPaper as Model<IExamPaper>) ||
  model<IExamPaper>("ExamPaper", examPaperSchema);
