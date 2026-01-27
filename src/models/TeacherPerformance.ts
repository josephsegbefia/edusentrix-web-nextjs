// src/models/TeacherPerformance.ts
import mongoose, { Schema, model, models, Types } from "mongoose";

export interface ITeacherPerformanceEvaluation {
  date: Date;
  evaluatorId: Types.ObjectId;
  overallRating: number; // 1-5
  strengths: string[];
  areasForImprovement: string[];
  goals: string[];
  comments?: string;
}

export interface ITeacherPDRecord {
  name: string;
  date: Date;
  hours: number;
  certificateUrl?: string;
}

export interface ITeacherPerformance {
  _id: Types.ObjectId;
  teacherId: Types.ObjectId;
  schoolId: Types.ObjectId;
  academicPeriodId: Types.ObjectId;

  averageStudentGrade?: number;
  studentPassRate?: number;
  classAttendanceRate?: number;
  teacherAttendanceRate?: number;

  evaluations: ITeacherPerformanceEvaluation[];
  pdCompleted: ITeacherPDRecord[];

  notes?: string;

  createdAt: Date;
  updatedAt: Date;
}

const EvaluationSchema = new Schema<ITeacherPerformanceEvaluation>(
  {
    date: { type: Date, required: true },
    evaluatorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    overallRating: { type: Number, min: 1, max: 5, required: true },
    strengths: { type: [String], default: [] },
    areasForImprovement: { type: [String], default: [] },
    goals: { type: [String], default: [] },
    comments: { type: String },
  },
  { _id: false }
);

const PDSchema = new Schema<ITeacherPDRecord>(
  {
    name: { type: String, required: true },
    date: { type: Date, required: true },
    hours: { type: Number, required: true },
    certificateUrl: { type: String },
  },
  { _id: false }
);

const TeacherPerformanceSchema = new Schema<ITeacherPerformance>(
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

    averageStudentGrade: { type: Number },
    studentPassRate: { type: Number },
    classAttendanceRate: { type: Number },
    teacherAttendanceRate: { type: Number },

    evaluations: { type: [EvaluationSchema], default: [] },
    pdCompleted: { type: [PDSchema], default: [] },

    notes: { type: String },
  },
  { timestamps: true }
);

TeacherPerformanceSchema.index(
  { teacherId: 1, academicPeriodId: 1 },
  { unique: true }
);

export const TeacherPerformance =
  models.TeacherPerformance ||
  model<ITeacherPerformance>("TeacherPerformance", TeacherPerformanceSchema);
