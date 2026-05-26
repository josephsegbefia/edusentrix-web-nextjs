import { Schema, model, models, Types, type Model } from "mongoose";

import type { StudentExploreStatus, ExploreQuizAnswer } from "@/lib/learn/explore/explore-types";

export type { StudentExploreStatus, ExploreQuizAnswer };

export interface IStudentExploreRecord {
  _id: Types.ObjectId;
  studentId: Types.ObjectId;
  schoolId: Types.ObjectId;
  classGroupId: Types.ObjectId;
  accountId?: Types.ObjectId | null;
  adventureId: Types.ObjectId;
  contentSnapshotId: Types.ObjectId;
  status: StudentExploreStatus;
  startedAt?: Date | null;
  quizSubmittedAt?: Date | null;
  completedAt?: Date | null;
  quizScorePercent?: number | null;
  correctCount?: number | null;
  totalCount?: number | null;
  answers?: ExploreQuizAnswer[];
  createdAt: Date;
  updatedAt: Date;
}

const exploreQuizAnswerSchema = new Schema<ExploreQuizAnswer>(
  {
    questionId: { type: String, required: true },
    selectedOptionId: { type: String, required: true },
    correct: { type: Boolean, required: true },
  },
  { _id: false }
);

const studentExploreRecordSchema = new Schema<IStudentExploreRecord>(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    classGroupId: {
      type: Schema.Types.ObjectId,
      ref: "ClassGroup",
      required: true,
      index: true,
    },
    accountId: {
      type: Schema.Types.ObjectId,
      ref: "LearnStudentAccount",
      default: null,
    },
    adventureId: {
      type: Schema.Types.ObjectId,
      ref: "ExploreAdventure",
      required: true,
      index: true,
    },
    contentSnapshotId: {
      type: Schema.Types.ObjectId,
      ref: "ExploreContentSnapshot",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["not_started", "in_progress", "quiz_submitted", "completed"],
      default: "not_started",
      required: true,
      index: true,
    },
    startedAt: { type: Date, default: null },
    quizSubmittedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    quizScorePercent: { type: Number, default: null, min: 0, max: 100 },
    correctCount: { type: Number, default: null, min: 0 },
    totalCount: { type: Number, default: null, min: 0 },
    answers: { type: [exploreQuizAnswerSchema], default: [] },
  },
  { timestamps: true }
);

studentExploreRecordSchema.index({ studentId: 1, adventureId: 1 }, { unique: true });
studentExploreRecordSchema.index({ schoolId: 1, classGroupId: 1, status: 1 });
studentExploreRecordSchema.index({ contentSnapshotId: 1 });
studentExploreRecordSchema.index({ studentId: 1, schoolId: 1, updatedAt: -1 });

export const StudentExploreRecord: Model<IStudentExploreRecord> =
  (models.StudentExploreRecord as Model<IStudentExploreRecord>) ||
  model<IStudentExploreRecord>("StudentExploreRecord", studentExploreRecordSchema);
