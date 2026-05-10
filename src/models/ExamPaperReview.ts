import { Schema, model, models, type Model, type Types } from "mongoose";
import { EXAM_REVIEW_DECISIONS } from "@/constants/examinations";
import type { ExamReviewDecision } from "@/types/examinations";

export interface IExamPaperReview {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  examPaperId: Types.ObjectId;
  reviewerId: Types.ObjectId;
  decision: ExamReviewDecision;
  comment?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const examPaperReviewSchema = new Schema<IExamPaperReview>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    examPaperId: { type: Schema.Types.ObjectId, ref: "ExamPaper", required: true, index: true },
    reviewerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    decision: {
      type: String,
      enum: [...EXAM_REVIEW_DECISIONS],
      required: true,
      index: true,
    },
    comment: { type: String, trim: true, maxlength: 8000, default: null },
  },
  { timestamps: true }
);

examPaperReviewSchema.index({ schoolId: 1, examPaperId: 1, createdAt: -1 });

export const ExamPaperReview: Model<IExamPaperReview> =
  (models.ExamPaperReview as Model<IExamPaperReview>) ||
  model<IExamPaperReview>("ExamPaperReview", examPaperReviewSchema);
