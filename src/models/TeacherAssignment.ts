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
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    location: string;
  };
  workloadHours?: number;
  status: AssignmentStatus;

  notes?: string;
  assignedBy: Types.ObjectId;
  assignedAt: Date;

  createdAt: Date;
  updatedAt: Date;
}

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

    schedule: {
      dayOfWeek: { type: Number },
      startTime: { type: String },
      endTime: { type: String },
      location: { type: String },
    },

    workloadHours: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      index: true,
    },
    notes: { type: String },
    assignedBy: { type: Schema.Types.ObjectId, ref: "User" },
    assignedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Uniqueness same teacher + period + subject + classgroup should be unique

TeacherAssignmentSchema.index(
  { teacherId: 1, academicPeriodId: 1, subjectId: 1, classGroupId: 1 },
  { unique: true }
);

export const TeacherAssignment =
  models.TeacherAssignment ||
  model<ITeacherAssignment>("TeacherAssignment", TeacherAssignmentSchema);
