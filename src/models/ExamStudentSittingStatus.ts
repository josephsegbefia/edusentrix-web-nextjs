import { Schema, model, models, Types, type Model } from "mongoose";
import type { ExamStudentSittingStatusValue } from "@/types/academics/exam-scheduling-engine";
import { EXAM_STUDENT_SITTING_STATUSES } from "@/constants/academics/exam-scheduling-engine";

export interface IExamStudentSittingStatus {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  examSessionId: Types.ObjectId;
  examTimetableEntryId: Types.ObjectId;
  studentId: Types.ObjectId;
  status: ExamStudentSittingStatusValue;
  recordedBy: Types.ObjectId;
  recordedAt: Date;
  note?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const examStudentSittingStatusSchema = new Schema<IExamStudentSittingStatus>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    examSessionId: {
      type: Schema.Types.ObjectId,
      ref: "ExamSession",
      required: true,
      index: true,
    },
    examTimetableEntryId: {
      type: Schema.Types.ObjectId,
      ref: "ExamTimetableEntry",
      required: true,
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: [...EXAM_STUDENT_SITTING_STATUSES],
      required: true,
      index: true,
    },
    recordedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    recordedAt: { type: Date, required: true, index: true },
    note: { type: String, default: null, trim: true, maxlength: 1000 },
  },
  { timestamps: true }
);

examStudentSittingStatusSchema.index(
  { schoolId: 1, examTimetableEntryId: 1, studentId: 1 },
  { name: "exam_sitting_by_entry_student", unique: true }
);

export const ExamStudentSittingStatus: Model<IExamStudentSittingStatus> =
  (models.ExamStudentSittingStatus as Model<IExamStudentSittingStatus>) ||
  model<IExamStudentSittingStatus>("ExamStudentSittingStatus", examStudentSittingStatusSchema);
