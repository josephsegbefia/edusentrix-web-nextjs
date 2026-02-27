import { Schema, model, models, Types, type Model } from "mongoose";

export type TimetableChangeAction =
  | "slot_created"
  | "slot_updated"
  | "slot_deleted"
  | "published"
  | "archived";

export interface ITimetableChangeLog {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  academicPeriodId: Types.ObjectId;
  versionId: Types.ObjectId;
  action: TimetableChangeAction;
  actorId: Types.ObjectId;
  entityId?: Types.ObjectId | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  createdAt: Date;
}

const timetableChangeLogSchema = new Schema<ITimetableChangeLog>(
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
    action: {
      type: String,
      enum: ["slot_created", "slot_updated", "slot_deleted", "published", "archived"],
      required: true,
      index: true,
    },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    entityId: {
      type: Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    before: { type: Schema.Types.Mixed, default: null },
    after: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

timetableChangeLogSchema.index({
  schoolId: 1,
  academicPeriodId: 1,
  versionId: 1,
  createdAt: -1,
});
timetableChangeLogSchema.index({ versionId: 1, action: 1, createdAt: -1 });
timetableChangeLogSchema.index({ entityId: 1, createdAt: -1 });

export const TimetableChangeLog: Model<ITimetableChangeLog> =
  (models.TimetableChangeLog as Model<ITimetableChangeLog>) ||
  model<ITimetableChangeLog>("TimetableChangeLog", timetableChangeLogSchema);
