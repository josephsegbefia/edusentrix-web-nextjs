import { Schema, model, models, type Model, type Types } from "mongoose";

export interface IExamPaperSection {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  examPaperId: Types.ObjectId;
  title: string;
  instructions?: string | null;
  order: number;
  marks: number;
  createdAt: Date;
  updatedAt: Date;
}

const examPaperSectionSchema = new Schema<IExamPaperSection>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    examPaperId: {
      type: Schema.Types.ObjectId,
      ref: "ExamPaper",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    instructions: { type: String, trim: true, maxlength: 4000, default: null },
    order: { type: Number, required: true, min: 0, default: 0 },
    marks: { type: Number, required: true, min: 0, default: 0 },
  },
  { timestamps: true }
);

examPaperSectionSchema.index({ schoolId: 1, examPaperId: 1, order: 1 });

export const ExamPaperSection: Model<IExamPaperSection> =
  (models.ExamPaperSection as Model<IExamPaperSection>) ||
  model<IExamPaperSection>("ExamPaperSection", examPaperSectionSchema);
