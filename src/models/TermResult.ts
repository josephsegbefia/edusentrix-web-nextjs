// src/models/TermResult.ts
import { Schema, model, models, Types } from "mongoose";

export type PerformanceTier = "top" | "above_average" | "average" | "at_risk";

export interface ITermResult {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  academicPeriodId: Types.ObjectId;
  studentId: Types.ObjectId;
  classGroupId: Types.ObjectId;
  totalSubjects: number;
  totalScore: number;
  averageScore: number;
  classPosition: number | null;
  totalStudents: number | null;
  performanceTier: PerformanceTier | null;
  gpa: number | null;
  isPromoted: boolean | null;
  calculatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const termResultSchema = new Schema<ITermResult>(
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
    totalSubjects: { type: Number, required: true },
    totalScore: { type: Number, required: true },
    averageScore: { type: Number, required: true },
    classPosition: { type: Number, default: null },
    totalStudents: { type: Number, default: null },
    performanceTier: {
      type: String,
      enum: ["top", "above_average", "average", "at_risk"],
      default: null,
    },
    gpa: { type: Number, default: null },
    isPromoted: { type: Boolean, default: null },
    calculatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

termResultSchema.index(
  { studentId: 1, academicPeriodId: 1 },
  { unique: true, name: "unique_student_term" }
);

termResultSchema.index(
  { schoolId: 1, academicPeriodId: 1, classPosition: 1 },
  { name: "by_class_position" }
);

export const TermResult =
  models.TermResult || model<ITermResult>("TermResult", termResultSchema);
