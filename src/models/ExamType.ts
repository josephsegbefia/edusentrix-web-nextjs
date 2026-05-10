import { Schema, model, models, type Model, type Types } from "mongoose";
import { EXAM_QUESTION_TYPES } from "@/constants/examinations";
import type { ExamQuestionType } from "@/types/examinations";

export interface IExamType {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  name: string;
  description?: string | null;
  requiresApproval: boolean;
  appearsOnReportCard: boolean;
  contributesToFinalGrade: boolean;
  canBePrinted: boolean;
  allowCandidateNumbers: boolean;
  allowAnswerSheet: boolean;
  allowedQuestionTypes: ExamQuestionType[];
  status: "active" | "inactive" | "archived";
  createdAt: Date;
  updatedAt: Date;
}

const examTypeSchema = new Schema<IExamType>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 2000, default: null },
    requiresApproval: { type: Boolean, default: true },
    appearsOnReportCard: { type: Boolean, default: false },
    contributesToFinalGrade: { type: Boolean, default: false },
    canBePrinted: { type: Boolean, default: true },
    allowCandidateNumbers: { type: Boolean, default: true },
    allowAnswerSheet: { type: Boolean, default: false },
    allowedQuestionTypes: {
      type: [{ type: String, enum: [...EXAM_QUESTION_TYPES] }],
      default: () => [
        "multiple_choice",
        "true_false",
        "short_answer",
        "essay",
        "structured",
        "fill_blank",
      ],
    },
    status: {
      type: String,
      enum: ["active", "inactive", "archived"],
      default: "active",
      index: true,
    },
  },
  { timestamps: true }
);

examTypeSchema.index({ schoolId: 1, name: 1 }, { unique: true });
examTypeSchema.index({ schoolId: 1, status: 1, name: 1 });

export const ExamType: Model<IExamType> =
  (models.ExamType as Model<IExamType>) ||
  model<IExamType>("ExamType", examTypeSchema);
