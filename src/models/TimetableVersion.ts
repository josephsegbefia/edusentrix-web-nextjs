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
  stale?: boolean;
  staleReasons?: Array<{
    sourceModule:
      | "teacher"
      | "subject"
      | "subjectOffering"
      | "classGroup"
      | "teacherAssignment"
      | "schoolDailySchedule";
    sourceEntityId?: Types.ObjectId | null;
    message: string;
    createdAt: Date;
  }>;
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
    stale: { type: Boolean, default: false, index: true },
    staleReasons: {
      type: [
        {
          sourceModule: {
            type: String,
            enum: [
              "teacher",
              "subject",
              "subjectOffering",
              "classGroup",
              "teacherAssignment",
              "schoolDailySchedule",
            ],
            required: true,
          },
          sourceEntityId: {
            type: Schema.Types.ObjectId,
            default: null,
          },
          message: { type: String, required: true, trim: true },
          createdAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
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
  {
    unique: true,
    partialFilterExpression: { status: { $in: ["draft", "published"] } },
  }
);

export const TimetableVersion: Model<ITimetableVersion> =
  (models.TimetableVersion as Model<ITimetableVersion>) ||
  model<ITimetableVersion>("TimetableVersion", timetableVersionSchema);
