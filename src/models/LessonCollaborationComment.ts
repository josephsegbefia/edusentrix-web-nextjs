import { Schema, model, models, type Model, type Types } from "mongoose";

export type LessonCollaborationCommentStatus = "open" | "resolved";

export interface ILessonCollaborationComment {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  lessonId: Types.ObjectId;
  authorTeacherId: Types.ObjectId;
  authorUserId: Types.ObjectId;
  comment: string;
  status: LessonCollaborationCommentStatus;
  resolvedAt?: Date | null;
  resolvedByTeacherId?: Types.ObjectId | null;
  resolvedByUserId?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const lessonCollaborationCommentSchema = new Schema<ILessonCollaborationComment>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    lessonId: { type: Schema.Types.ObjectId, ref: "Lesson", required: true, index: true },
    authorTeacherId: { type: Schema.Types.ObjectId, ref: "Teacher", required: true, index: true },
    authorUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    comment: { type: String, required: true, trim: true, maxlength: 4000 },
    status: { type: String, enum: ["open", "resolved"], default: "open", index: true },
    resolvedAt: { type: Date, default: null },
    resolvedByTeacherId: { type: Schema.Types.ObjectId, ref: "Teacher", default: null },
    resolvedByUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

lessonCollaborationCommentSchema.index({ schoolId: 1, lessonId: 1, createdAt: -1 });

export const LessonCollaborationComment: Model<ILessonCollaborationComment> =
  (models.LessonCollaborationComment as Model<ILessonCollaborationComment>) ||
  model<ILessonCollaborationComment>("LessonCollaborationComment", lessonCollaborationCommentSchema);
