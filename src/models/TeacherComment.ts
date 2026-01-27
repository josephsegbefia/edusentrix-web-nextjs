// src/models/TeacherComment.ts
import { Schema, model, models, Types } from "mongoose";

export type TeacherCommentType =
  | "subject"
  | "general"
  | "promotion"
  | "behavior";

export interface ITeacherComment {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  academicPeriodId: Types.ObjectId;
  studentId: Types.ObjectId;
  subjectId?: Types.ObjectId | null;
  teacherId: Types.ObjectId;
  commentType: TeacherCommentType;
  comment: string;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const teacherCommentSchema = new Schema<ITeacherComment>(
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
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: "Subject",
      default: null,
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
      index: true,
    },
    commentType: {
      type: String,
      enum: ["subject", "general", "promotion", "behavior"],
      required: true,
    },
    comment: { type: String, required: true },
    isPublic: { type: Boolean, default: true },
  },
  { timestamps: true }
);

teacherCommentSchema.index(
  { studentId: 1, academicPeriodId: 1 },
  { name: "by_student_term" }
);

export const TeacherComment =
  models.TeacherComment ||
  model<ITeacherComment>("TeacherComment", teacherCommentSchema);
