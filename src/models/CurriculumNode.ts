import { Schema, model, models, type Model, type Types } from "mongoose";

export type CurriculumNodeKind = "strand" | "sub_strand" | "topic" | "sub_topic" | "objective";

export interface ICurriculumNode {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  curriculumId: Types.ObjectId;
  curriculumSubjectId: Types.ObjectId;
  parentNodeId?: Types.ObjectId | null;
  kind: CurriculumNodeKind;
  title: string;
  code?: string | null;
  order: number;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

const curriculumNodeSchema = new Schema<ICurriculumNode>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    curriculumId: {
      type: Schema.Types.ObjectId,
      ref: "Curriculum",
      required: true,
      index: true,
    },
    curriculumSubjectId: {
      type: Schema.Types.ObjectId,
      ref: "CurriculumSubject",
      required: true,
      index: true,
    },
    parentNodeId: { type: Schema.Types.ObjectId, ref: "CurriculumNode", default: null, index: true },
    kind: {
      type: String,
      enum: ["strand", "sub_strand", "topic", "sub_topic", "objective"],
      required: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 260 },
    code: { type: String, trim: true, maxlength: 120, default: null },
    order: { type: Number, min: 0, default: 0 },
    metadata: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

curriculumNodeSchema.index({ schoolId: 1, curriculumSubjectId: 1, parentNodeId: 1, order: 1 });
curriculumNodeSchema.index({ schoolId: 1, curriculumId: 1, code: 1 });

export const CurriculumNode: Model<ICurriculumNode> =
  (models.CurriculumNode as Model<ICurriculumNode>) ||
  model<ICurriculumNode>("CurriculumNode", curriculumNodeSchema);
