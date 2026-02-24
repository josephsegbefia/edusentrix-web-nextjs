import { Schema, model, models, Types } from "mongoose";
export type AssessmentType =
  | "ca"
  | "quiz"
  | "assignment"
  | "midterm"
  | "exam"
  | "project"
  | "mock"
  | "criterion"
  | "portfolio"
  | "formative"
  | "classwork"
  | "homework"
  | "final";

export interface IAssessment {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  academicPeriodId: Types.ObjectId;
  subjectId: Types.ObjectId;
  studentId: Types.ObjectId;
  teacherId: Types.ObjectId;
  assessmentType: AssessmentType;
  title: string;
  maxScore: number;
  score: number;
  percentage: number; // score / maxScore * 100
  weight: number; // e.g CA = 0.3 Exam = 0.7
  criterionName?: string | null;
  gradedAt: Date | null;
  remarks?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
const assessmentSchema = new Schema<IAssessment>(
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
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
      index: true,
    },
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
      index: true,
    },
    assessmentType: {
      type: String,
      enum: [
        "ca",
        "quiz",
        "assignment",
        "midterm",
        "exam",
        "project",
        "mock",
        "criterion",
        "portfolio",
        "formative",
        "classwork",
        "homework",
        "final",
      ],
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      index: true,
    },
    maxScore: {
      type: Number,
      required: true,
      index: true,
    },
    score: {
      type: Number,
      required: true,
      index: true,
    },
    percentage: {
      type: Number,
      required: true,
      index: true,
    },
    weight: {
      type: Number,
      required: true,
      index: true,
    },
    criterionName: {
      type: String,
      default: null,
    },
    gradedAt: {
      type: Date,
      default: null,
    },
    remarks: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

assessmentSchema.index(
  { studentId: 1, academicPeriodId: 1, subjectId: 1 },
  { name: "by_student_term_subject" }
);

assessmentSchema.index(
  {
    studentId: 1,
    academicPeriodId: 1,
  },
  { name: "by_student_term" }
);

assessmentSchema.index(
  {
    teacherId: 1,
    subjectId: 1,
  },
  { name: "by_teacher_subject" }
);

export const Assessment =
  models.Assessment || model<IAssessment>("Assessment", assessmentSchema);
