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

  /**
   * Present only on rows submitted as a leave request. Set from the session by the leave-request
   * submit route (or by the audited backfill), never from a request body. Routine attendance rows
   * marked `on_leave` have no `leaveRequest` and are not approval requests.
   */
  leaveRequest?: {
    submittedBy: Types.ObjectId;
    submittedAt: Date;
    source: "leave_request" | "backfill_leave_submitted";
  };

  /** Decision on an `on_leave` row. Written only by the leave-request decision routes. */
  leaveDecision?: {
    status: "approved" | "rejected";
    decidedBy: Types.ObjectId;
    decidedAt: Date;
    reason?: string;
  };

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

    leaveRequest: {
      type: new Schema(
        {
          submittedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
          submittedAt: { type: Date, required: true },
          source: { type: String, enum: ["leave_request", "backfill_leave_submitted"], required: true },
        },
        { _id: false }
      ),
      required: false,
    },

    leaveDecision: {
      status: { type: String, enum: ["approved", "rejected"] },
      decidedBy: { type: Schema.Types.ObjectId, ref: "User" },
      decidedAt: { type: Date },
      reason: { type: String, trim: true, maxlength: 500 },
    },
  },
  { timestamps: true }
);

// One record per teacher per day
TeacherAttendanceSchema.index({ teacherId: 1, date: 1 }, { unique: true });
TeacherAttendanceSchema.index({ schoolId: 1, date: 1 });

export const TeacherAttendance =
  models.TeacherAttendance ||
  model<ITeacherAttendance>("TeacherAttendance", TeacherAttendanceSchema);
