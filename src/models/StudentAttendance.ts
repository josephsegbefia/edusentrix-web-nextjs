import { Schema, model, models, Types } from "mongoose";

export type AttendanceType = "homeroom" | "period";
export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export interface IStudentAttendance {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  studentId: Types.ObjectId;
  classGroupId: Types.ObjectId;
  academicPeriodId: Types.ObjectId;
  date: Date;
  type: AttendanceType;
  periodNumber?: number;
  subjectId?: Types.ObjectId;
  status: AttendanceStatus;
  lateMinutes?: number;
  reason?: string;
  notificationSent?: boolean;
  notificationSentAt?: Date;
  recordedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const studentAttendanceSchema = new Schema<IStudentAttendance>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    classGroupId: {
      type: Schema.Types.ObjectId,
      ref: "ClassGroup",
      required: true,
      index: true,
    },
    academicPeriodId: {
      type: Schema.Types.ObjectId,
      ref: "AcademicPeriod",
      required: true,
      index: true,
    },
    date: { type: Date, required: true, index: true },
    type: {
      type: String,
      enum: ["homeroom", "period"],
      required: true,
      index: true,
    },
    periodNumber: { type: Number, min: 1, max: 20 },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject" },
    status: {
      type: String,
      enum: ["present", "absent", "late", "excused"],
      required: true,
      index: true,
    },
    lateMinutes: { type: Number, min: 0 },
    reason: { type: String, trim: true },
    notificationSent: { type: Boolean, default: false },
    notificationSentAt: { type: Date },
    recordedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

studentAttendanceSchema.index(
  { studentId: 1, date: 1, type: 1 },
  { unique: true, partialFilterExpression: { type: "homeroom" } }
);
studentAttendanceSchema.index(
  { studentId: 1, date: 1, periodNumber: 1 },
  { unique: true, partialFilterExpression: { type: "period" } }
);
studentAttendanceSchema.index({ schoolId: 1, classGroupId: 1, date: 1 });
studentAttendanceSchema.index({ schoolId: 1, date: 1, status: 1 });

export const StudentAttendance =
  models.StudentAttendance ||
  model<IStudentAttendance>("StudentAttendance", studentAttendanceSchema);
