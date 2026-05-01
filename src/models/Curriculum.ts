import { Schema, model, models, type Model, type Types } from "mongoose";

export type CurriculumStatus = "draft" | "active" | "archived";

export interface ICurriculum {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  title: string;
  code: string;
  description?: string;
  status: CurriculumStatus;
  createdByUserId: Types.ObjectId;
  updatedByUserId?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const curriculumSchema = new Schema<ICurriculum>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    code: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 4000 },
    status: {
      type: String,
      enum: ["draft", "active", "archived"],
      default: "draft",
      index: true,
    },
    createdByUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedByUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

curriculumSchema.index({ schoolId: 1, code: 1 }, { unique: true });
curriculumSchema.index({ schoolId: 1, status: 1, updatedAt: -1 });

export const Curriculum: Model<ICurriculum> =
  (models.Curriculum as Model<ICurriculum>) ||
  model<ICurriculum>("Curriculum", curriculumSchema);
