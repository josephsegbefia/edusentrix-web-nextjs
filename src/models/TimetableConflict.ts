import mongoose, { Schema, model, models, Types, type Model } from "mongoose";

export type TimetableConflictCode =
  | "TEACHER_OVERLAP"
  | "CLASS_OVERLAP"
  | "INVALID_TIME_RANGE"
  | "MISSING_TEACHER"
  | "MISSING_SUBJECT"
  | "MISSING_CLASSGROUP"
  | "MISSING_CLASSROOM_LABEL"
  | "OUTSIDE_PERIOD_RANGE"
  | "TEACHER_PENDING_ASSIGNMENT";

export type TimetableConflictSeverity = "error" | "warning";
export type TimetableConflictStatus = "open" | "resolved" | "ignored";

export interface ITimetableConflict {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  academicPeriodId: Types.ObjectId;
  versionId: Types.ObjectId;
  code: TimetableConflictCode;
  severity: TimetableConflictSeverity;
  slotIds: Types.ObjectId[];
  message: string;
  metadata?: Record<string, unknown>;
  status: TimetableConflictStatus;
  createdAt: Date;
  updatedAt: Date;
}

const timetableConflictSchema = new Schema<ITimetableConflict>(
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
    versionId: {
      type: Schema.Types.ObjectId,
      ref: "TimetableVersion",
      required: true,
      index: true,
    },
    code: {
      type: String,
      enum: [
        "TEACHER_OVERLAP",
        "CLASS_OVERLAP",
        "INVALID_TIME_RANGE",
        "MISSING_TEACHER",
        "MISSING_SUBJECT",
        "MISSING_CLASSGROUP",
        "MISSING_CLASSROOM_LABEL",
        "OUTSIDE_PERIOD_RANGE",
        "TEACHER_PENDING_ASSIGNMENT",
      ],
      required: true,
      index: true,
    },
    severity: {
      type: String,
      enum: ["error", "warning"],
      required: true,
      index: true,
    },
    slotIds: [{ type: Schema.Types.ObjectId, ref: "TimetableSlot", required: true }],
    message: { type: String, required: true, trim: true },
    metadata: { type: Schema.Types.Mixed, default: undefined },
    status: {
      type: String,
      enum: ["open", "resolved", "ignored"],
      required: true,
      default: "open",
      index: true,
    },
  },
  { timestamps: true }
);

timetableConflictSchema.index({
  schoolId: 1,
  academicPeriodId: 1,
  versionId: 1,
  status: 1,
  severity: 1,
  createdAt: -1,
});
timetableConflictSchema.index({ versionId: 1, code: 1, status: 1, updatedAt: -1 });

// Next.js dev hot-reload can keep a stale model without updated `code` enum values.
if (process.env.NODE_ENV === "development" && mongoose.models.TimetableConflict) {
  delete mongoose.models.TimetableConflict;
}

export const TimetableConflict: Model<ITimetableConflict> =
  (models.TimetableConflict as Model<ITimetableConflict>) ||
  model<ITimetableConflict>("TimetableConflict", timetableConflictSchema);
