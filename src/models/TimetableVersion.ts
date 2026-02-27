import { Schema, model, models, Types, type Model } from "mongoose";

export type TimetableVersionStatus = "draft" | "published" | "archived";

export interface ITimetableVersion {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  academicPeriodId: Types.ObjectId;
  name: string;
  status: TimetableVersionStatus;
  baseVersionId?: Types.ObjectId | null;
  publishedAt?: Date | null;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  lockVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

const timetableVersionSchema = new Schema<ITimetableVersion>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    academicPeriodId: {
      type: Schema.Types.ObjectId,
      ref: "AcademicPeriod",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      required: true,
      default: "draft",
      index: true,
    },
    baseVersionId: {
      type: Schema.Types.ObjectId,
      ref: "TimetableVersion",
      default: null,
    },
    publishedAt: { type: Date, default: null },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    lockVersion: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

timetableVersionSchema.index({ schoolId: 1, academicPeriodId: 1, createdAt: -1 });
timetableVersionSchema.index({ schoolId: 1, academicPeriodId: 1, status: 1, updatedAt: -1 });
timetableVersionSchema.index(
  { schoolId: 1, academicPeriodId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "published" } }
);

export const TimetableVersion: Model<ITimetableVersion> =
  (models.TimetableVersion as Model<ITimetableVersion>) ||
  model<ITimetableVersion>("TimetableVersion", timetableVersionSchema);
