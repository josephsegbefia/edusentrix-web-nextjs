import { Schema, model, models, type Model, type Types } from "mongoose";

export type LessonAuditAction =
  | "lesson_created_from_note"
  | "lesson_updated"
  | "lesson_published"
  | "lesson_unpublished"
  | "lesson_archived"
  | "resource_added"
  | "resource_deleted"
  | "flashcards_published";

export interface ILessonAuditLog {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  lessonId: Types.ObjectId;
  /** Clerk-linked user id (teacher). */
  actorId: Types.ObjectId;
  action: LessonAuditAction;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const lessonAuditLogSchema = new Schema<ILessonAuditLog>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    lessonId: { type: Schema.Types.ObjectId, ref: "Lesson", required: true, index: true },
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    action: {
      type: String,
      required: true,
      enum: [
        "lesson_created_from_note",
        "lesson_updated",
        "lesson_published",
        "lesson_unpublished",
        "lesson_archived",
        "resource_added",
        "resource_deleted",
        "flashcards_published",
      ],
      index: true,
    },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

lessonAuditLogSchema.index({ schoolId: 1, lessonId: 1, createdAt: -1 });
lessonAuditLogSchema.index({ schoolId: 1, action: 1, createdAt: -1 });

export const LessonAuditLog: Model<ILessonAuditLog> =
  models.LessonAuditLog || model<ILessonAuditLog>("LessonAuditLog", lessonAuditLogSchema);
