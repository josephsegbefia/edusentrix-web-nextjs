/* eslint-disable @typescript-eslint/no-unused-vars */
// src/models/TeacherAssignment.ts
import mongoose, { Schema, model, models, Types } from "mongoose";

export type AssignmentStatus = "active" | "inactive";

export interface ITeacherAssignment {
  _id: Types.ObjectId;
  teacherId: Types.ObjectId;
  schoolId: Types.ObjectId;
  academicPeriodId: Types.ObjectId;
  subjectId: Types.ObjectId;
  classGroupId: Types.ObjectId;

  schedule?: {
    dayOfWeek?: number; // 0-6
    startTime?: string; // "HH:MM"
    endTime?: string; // "HH:MM"
    location?: string;
  };
  schedules?: Array<{
    dayOfWeek: number; // 0-6
    startTime: string; // "HH:MM"
    endTime: string; // "HH:MM"
    location?: string;
  }>;

  workloadHours?: number;
  status: AssignmentStatus;

  notes?: string;
  assignedBy?: Types.ObjectId | null; // keep optional (depends on requireSchoolAdmin return)
  assignedAt: Date;


  createdAt: Date;
  updatedAt: Date;
}

const ScheduleSchema = new Schema(
  {
    dayOfWeek: { type: Number, min: 0, max: 6 },
    startTime: { type: String, trim: true },
    endTime: { type: String, trim: true },
    location: { type: String, trim: true },
  },
  { _id: false }
);

const ScheduleItemSchema = new Schema(
  {
    dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
    startTime: { type: String, required: true, trim: true },
    endTime: { type: String, required: true, trim: true },
    location: { type: String, trim: true },
  },
  { _id: false }
);

const TeacherAssignmentSchema = new Schema<ITeacherAssignment>(
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
    academicPeriodId: {
      type: Schema.Types.ObjectId,
      ref: "AcademicPeriod",
      required: true,
      index: true,
    },
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
      index: true,
    },
    classGroupId: {
      type: Schema.Types.ObjectId,
      ref: "ClassGroup",
      required: true,
      index: true,
    },

    schedule: { type: ScheduleSchema, default: undefined }, // Legacy single schedule
    schedules: { type: [ScheduleItemSchema], default: undefined }, // New multiple schedules array

    workloadHours: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      index: true,
    },

    notes: { type: String, trim: true },
    assignedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    assignedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

/**
 * ✅ Critical: allow history + replacements
 * Only ONE ACTIVE assignment per teacher+period+subject+classGroup
 */
TeacherAssignmentSchema.index(
  {
    schoolId: 1,
    teacherId: 1,
    academicPeriodId: 1,
    subjectId: 1,
    classGroupId: 1,
  },
  { unique: true, partialFilterExpression: { status: "active" } }
);

/**
 * ✅ Critical: prevent two ACTIVE teachers for same subject/class in same period
 * (turn off later if you want co-teaching)
 */
TeacherAssignmentSchema.index(
  { schoolId: 1, academicPeriodId: 1, subjectId: 1, classGroupId: 1 },
  { unique: true, partialFilterExpression: { status: "active" } }
);

// Performance indexes
TeacherAssignmentSchema.index({
  schoolId: 1,
  teacherId: 1,
  academicPeriodId: 1,
  status: 1,
});
TeacherAssignmentSchema.index({
  schoolId: 1,
  classGroupId: 1,
  academicPeriodId: 1,
  status: 1,
});
TeacherAssignmentSchema.index({
  schoolId: 1,
  subjectId: 1,
  academicPeriodId: 1,
  status: 1,
});

export const TeacherAssignment =
  models.TeacherAssignment ||
  model<ITeacherAssignment>("TeacherAssignment", TeacherAssignmentSchema);
