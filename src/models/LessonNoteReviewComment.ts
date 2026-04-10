import { Schema, model, models, Types, type Model } from "mongoose";

export type LessonNoteReviewCommentType =
  | "required_change"
  | "suggestion"
  | "question"
  | "commendation";

export type LessonNoteReviewCommentStatus = "open" | "addressed" | "resolved";

export interface ILessonNoteReviewComment {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  lessonNoteId: Types.ObjectId;
  sectionKey: string;
  sectionLabel: string;
  commentType: LessonNoteReviewCommentType;
  comment: string;
  status: LessonNoteReviewCommentStatus;
  authorId: Types.ObjectId;
  addressedAt?: Date | null;
  addressedBy?: Types.ObjectId | null;
  resolvedAt?: Date | null;
  resolvedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const LessonNoteReviewCommentSchema = new Schema<ILessonNoteReviewComment>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    lessonNoteId: {
      type: Schema.Types.ObjectId,
      ref: "LessonNote",
      required: true,
      index: true,
    },
    sectionKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      index: true,
    },
    sectionLabel: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    commentType: {
      type: String,
      enum: ["required_change", "suggestion", "question", "commendation"],
      default: "suggestion",
      index: true,
    },
    comment: {
      type: String,
      required: true,
      trim: true,
      maxlength: 4000,
    },
    status: {
      type: String,
      enum: ["open", "addressed", "resolved"],
      default: "open",
      index: true,
    },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    addressedAt: {
      type: Date,
      default: null,
    },
    addressedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

LessonNoteReviewCommentSchema.index({
  schoolId: 1,
  lessonNoteId: 1,
  sectionKey: 1,
  status: 1,
  createdAt: -1,
});

LessonNoteReviewCommentSchema.index({
  schoolId: 1,
  lessonNoteId: 1,
  createdAt: -1,
});

export const LessonNoteReviewComment: Model<ILessonNoteReviewComment> =
  (models.LessonNoteReviewComment as Model<ILessonNoteReviewComment>) ||
  model<ILessonNoteReviewComment>(
    "LessonNoteReviewComment",
    LessonNoteReviewCommentSchema
  );
