import { Schema, model, models, Types, type Model } from "mongoose";

export type RevisionBankItemReason =
  | "missed_quest"
  | "weak_topic"
  | "spaced_repetition"
  | "teacher_priority";

export type RevisionBankItemStatus =
  | "active"
  | "selected_for_board"
  | "completed"
  | "expired";

export interface IRevisionBankItem {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  studentId: Types.ObjectId;
  classGroupId: Types.ObjectId;
  subjectOfferingId?: Types.ObjectId | null;
  subjectId?: Types.ObjectId | null;
  subjectName: string;
  lessonId?: Types.ObjectId | null;
  conceptTitle: string;
  conceptTags: string[];
  sourceBoardId?: Types.ObjectId | null;
  sourceItemId?: Types.ObjectId | null;
  reason: RevisionBankItemReason;
  priorityScore: number;
  dueDate?: string | null;
  status: RevisionBankItemStatus;
  createdAt: Date;
  updatedAt: Date;
}

const revisionBankItemSchema = new Schema<IRevisionBankItem>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
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
    subjectOfferingId: {
      type: Schema.Types.ObjectId,
      ref: "SubjectOffering",
      default: null,
      index: true,
    },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject", default: null, index: true },
    subjectName: { type: String, required: true, trim: true },
    lessonId: { type: Schema.Types.ObjectId, ref: "LessonSession", default: null, index: true },
    conceptTitle: { type: String, required: true, trim: true },
    conceptTags: { type: [String], default: [] },
    sourceBoardId: { type: Schema.Types.ObjectId, ref: "DailyQuestBoard", default: null },
    sourceItemId: { type: Schema.Types.ObjectId, ref: "DailyQuestItem", default: null },
    reason: {
      type: String,
      enum: ["missed_quest", "weak_topic", "spaced_repetition", "teacher_priority"],
      required: true,
      index: true,
    },
    priorityScore: { type: Number, default: 0 },
    dueDate: { type: String, default: null, trim: true, index: true },
    status: {
      type: String,
      enum: ["active", "selected_for_board", "completed", "expired"],
      default: "active",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

revisionBankItemSchema.index({ schoolId: 1, studentId: 1, status: 1 });
revisionBankItemSchema.index({ schoolId: 1, classGroupId: 1, status: 1 });
revisionBankItemSchema.index({ studentId: 1, dueDate: 1, priorityScore: -1 });
revisionBankItemSchema.index({ sourceBoardId: 1, sourceItemId: 1 });

export const RevisionBankItem: Model<IRevisionBankItem> =
  (models.RevisionBankItem as Model<IRevisionBankItem>) ||
  model<IRevisionBankItem>("RevisionBankItem", revisionBankItemSchema);
