import { Schema, model, models, type Model, type Types } from "mongoose";

export type LessonAttendancePhase = "before" | "after";

export interface ILessonAttendanceLink {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  deliveryId: Types.ObjectId;
  sessionId: Types.ObjectId;
  classGroupId: Types.ObjectId;
  phase: LessonAttendancePhase;
  attendanceDate: Date;
  periodNumber: number;
  subjectId?: Types.ObjectId | null;
  studentCount: number;
  recordedBy: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

const lessonAttendanceLinkSchema = new Schema<ILessonAttendanceLink>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    deliveryId: { type: Schema.Types.ObjectId, ref: "LessonDelivery", required: true, index: true },
    sessionId: { type: Schema.Types.ObjectId, ref: "LessonSession", required: true, index: true },
    classGroupId: { type: Schema.Types.ObjectId, ref: "ClassGroup", required: true, index: true },
    phase: { type: String, enum: ["before", "after"], required: true },
    attendanceDate: { type: Date, required: true },
    periodNumber: { type: Number, required: true, min: 1, max: 20 },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject", default: null },
    studentCount: { type: Number, required: true, min: 0 },
    recordedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

lessonAttendanceLinkSchema.index(
  { deliveryId: 1, phase: 1 },
  { unique: true },
);

export const LessonAttendanceLink: Model<ILessonAttendanceLink> =
  (models.LessonAttendanceLink as Model<ILessonAttendanceLink>) ||
  model<ILessonAttendanceLink>("LessonAttendanceLink", lessonAttendanceLinkSchema);
