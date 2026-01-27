import { Schema, model, models, Types } from "mongoose";

export interface ISubjectGrade {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  academicPeriodId: Types.ObjectId;
  subjectId: Types.ObjectId;
  studentId: Types.ObjectId;
  teacherId: Types.ObjectId;
  caTotal: number;
  caMaxTotal: number;
  caPercentage: number;
  examScore: number;
  examMaxScore: number;
  examPercentage: number;
  totalScore: number;
  gradeLetter: string;
  gradePoint: number;
  isPassed: boolean;
  lastUpdated: Date;
  createdAt: Date;
}

const subjectGradeSchema = new Schema<ISubjectGrade>(
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
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: "Subject",
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
    caTotal: {
      type: Number,
      required: true,
      default: 0,
    },
    caMaxTotal: {
      type: Number,
      required: true,
      default: 0,
    },
    caPercentage: {
      type: Number,
      required: true,
      default: 0,
    },
    examScore: {
      type: Number,
      required: true,
      default: 0,
    },
    examMaxScore: {
      type: Number,
      required: true,
      default: 0,
    },
    examPercentage: {
      type: Number,
      required: true,
      default: 0,
    },
    totalScore: {
      type: Number,
      required: true,
      default: 0,
    },
    gradeLetter: {
      type: String,
      required: true,
      default: "",
    },
    gradePoint: {
      type: Number,
      required: true,
      default: 0,
    },
    isPassed: {
      type: Boolean,
      required: true,
      default: false,
    },
    lastUpdated: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  { timestamps: true }
);

subjectGradeSchema.index(
  {
    studentId: 1,
    academicPeriodId: 1,
    subjectId: 1,
  },
  { name: "unique_student_term_subject" }
);

subjectGradeSchema.index(
  { studentId: 1, academicPeriodId: 1, subjectId: 1 },
  { name: "unique_student_term_subject" }
);

subjectGradeSchema.index(
  {
    schoolId: 1,
    academicPeriod: 1,
  },
  { name: "by_school_term " }
);

export const SubjectGrade =
  models.SubjectGrade ||
  model<ISubjectGrade>("SubjectGrade", subjectGradeSchema);
