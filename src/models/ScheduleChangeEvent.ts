import { Schema, model, models, Types, type Model } from "mongoose";

export type ScheduleChangeEntityType =
  | "teacher"
  | "subject"
  | "subjectOffering"
  | "classGroup"
  | "teacherAssignment"
  | "timetableSlot"
  | "timetableVersion"
  | "schoolDailySchedule";

export type ScheduleChangeAction =
  | "created"
  | "updated"
  | "deleted"
  | "published"
  | "archived"
  | "stale_marked";

export interface IScheduleChangeEvent {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  academicPeriodId?: Types.ObjectId | null;
  entityType: ScheduleChangeEntityType;
  entityId: Types.ObjectId;
  action: ScheduleChangeAction;
  affectedClassGroupIds?: Types.ObjectId[];
  affectedTeacherIds?: Types.ObjectId[];
  affectedSubjectIds?: Types.ObjectId[];
  affectedRoomIds?: Types.ObjectId[];
  message?: string | null;
  createdBy?: Types.ObjectId | null;
  createdAt: Date;
}

const scheduleChangeEventSchema = new Schema<IScheduleChangeEvent>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    academicPeriodId: {
      type: Schema.Types.ObjectId,
      ref: "AcademicPeriod",
      default: null,
      index: true,
    },
    entityType: {
      type: String,
      enum: [
        "teacher",
        "subject",
        "subjectOffering",
        "classGroup",
        "teacherAssignment",
        "timetableSlot",
        "timetableVersion",
        "schoolDailySchedule",
      ],
      required: true,
      index: true,
    },
    entityId: { type: Schema.Types.ObjectId, required: true, index: true },
    action: {
      type: String,
      enum: ["created", "updated", "deleted", "published", "archived", "stale_marked"],
      required: true,
      index: true,
    },
    affectedClassGroupIds: [{ type: Schema.Types.ObjectId, ref: "ClassGroup" }],
    affectedTeacherIds: [{ type: Schema.Types.ObjectId, ref: "Teacher" }],
    affectedSubjectIds: [{ type: Schema.Types.ObjectId, ref: "Subject" }],
    affectedRoomIds: [{ type: Schema.Types.ObjectId, ref: "Room" }],
    message: { type: String, default: null, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

scheduleChangeEventSchema.index({ schoolId: 1, academicPeriodId: 1, createdAt: -1 });
scheduleChangeEventSchema.index({ schoolId: 1, entityType: 1, entityId: 1, createdAt: -1 });

export const ScheduleChangeEvent: Model<IScheduleChangeEvent> =
  (models.ScheduleChangeEvent as Model<IScheduleChangeEvent>) ||
  model<IScheduleChangeEvent>("ScheduleChangeEvent", scheduleChangeEventSchema);
