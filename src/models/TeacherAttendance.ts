// src/models/TeacherAttendance.ts
import mongoose, { Schema, model, models, Types } from "mongoose";

export type TeacherAttendanceStatus =
  | "present"
  | "absent"
  | "late"
  | "on_leave"
  | "sick"
  | "other";

export interface ITeacherAttendance {
  _id: Types.ObjectId;
  teacherId: Types.ObjectId;
  schoolId: Types.ObjectId;

  date: Date; // normalized day (store date-only or normalize in code)
  status: TeacherAttendanceStatus;

  checkInTime?: Date;
  checkOutTime?: Date;
  minutesLate?: number;

  leaveType?: "sick" | "vacation" | "personal" | "professional" | "other";
  reason?: string;
  notes?: string;

  recordedBy?: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

const TeacherAttendanceSchema = new Schema<ITeacherAttendance>(
  {
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
      index: true,
    },
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },

    date: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ["present", "absent", "late", "on_leave", "sick", "other"],
      required: true,
      index: true,
    },

    checkInTime: { type: Date },
    checkOutTime: { type: Date },
    minutesLate: { type: Number },

    leaveType: {
      type: String,
      enum: ["sick", "vacation", "personal", "professional", "other"],
    },
    reason: { type: String },
    notes: { type: String },

    recordedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// One record per teacher per day
TeacherAttendanceSchema.index({ teacherId: 1, date: 1 }, { unique: true });
TeacherAttendanceSchema.index({ schoolId: 1, date: 1 });

export const TeacherAttendance =
  models.TeacherAttendance ||
  model<ITeacherAttendance>("TeacherAttendance", TeacherAttendanceSchema);
