import { Schema, model, models, type Model, type Types } from "mongoose";

export type LessonDeliveryStatus =
  | "scheduled"
  | "in_progress"
  | "delivered"
  | "completed"
  | "cancelled";

export type LessonSubstituteReason = "leave" | "absence" | "delegation" | "other";

export interface ILessonDelivery {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  sessionId: Types.ObjectId;
  weekPlanId: Types.ObjectId;
  classGroupId: Types.ObjectId;
  ownerTeacherId: Types.ObjectId;
  scheduledTeacherId: Types.ObjectId;
  actualTeacherId?: Types.ObjectId | null;
  substituteReason?: LessonSubstituteReason | null;
  status: LessonDeliveryStatus;
  startedAt?: Date | null;
  endedAt?: Date | null;
  completedAt?: Date | null;
  completedByTeacherId?: Types.ObjectId | null;
  attendanceBeforeId?: Types.ObjectId | null;
  attendanceAfterId?: Types.ObjectId | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const lessonDeliverySchema = new Schema<ILessonDelivery>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    sessionId: { type: Schema.Types.ObjectId, ref: "LessonSession", required: true, index: true },
    weekPlanId: { type: Schema.Types.ObjectId, ref: "LessonWeekPlan", required: true, index: true },
    classGroupId: { type: Schema.Types.ObjectId, ref: "ClassGroup", required: true, index: true },
    ownerTeacherId: { type: Schema.Types.ObjectId, ref: "Teacher", required: true, index: true },
    scheduledTeacherId: { type: Schema.Types.ObjectId, ref: "Teacher", required: true },
    actualTeacherId: { type: Schema.Types.ObjectId, ref: "Teacher", default: null },
    substituteReason: {
      type: String,
      enum: ["leave", "absence", "delegation", "other", null],
      default: null,
    },
    status: {
      type: String,
      enum: ["scheduled", "in_progress", "delivered", "completed", "cancelled"],
      default: "scheduled",
      index: true,
    },
    startedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    completedByTeacherId: { type: Schema.Types.ObjectId, ref: "Teacher", default: null },
    attendanceBeforeId: { type: Schema.Types.ObjectId, default: null },
    attendanceAfterId: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true },
);

lessonDeliverySchema.index({ schoolId: 1, sessionId: 1 }, { unique: true });

export const LessonDelivery: Model<ILessonDelivery> =
  (models.LessonDelivery as Model<ILessonDelivery>) ||
  model<ILessonDelivery>("LessonDelivery", lessonDeliverySchema);
