import { Schema, model, models, type Model, type Types } from "mongoose";

export type LessonAuditAction =
  | "lesson_created_from_note"
  | "lesson_updated"
  | "lesson_deleted"
  | "lesson_published"
  | "lesson_unpublished"
  | "lesson_archived"
  | "student_content_updated"
  | "parent_summary_saved"
  | "parent_summary_visibility_changed"
  | "resource_added"
  | "resource_updated"
  | "resource_deleted"
  | "resources_reordered"
  | "flashcard_deck_created"
  | "flashcard_deck_updated"
  | "flashcard_deck_published"
  | "flashcard_deck_archived"
  | "flashcard_added"
  | "flashcard_updated"
  | "flashcard_deleted"
  | "flashcards_reordered"
  | "reflection_saved"
  | "teaching_mode_updated"
  | "teaching_mode_generated"
  | "collaborator_added"
  | "collaborator_removed"
  | "comment_added"
  | "comment_resolved"
  | "ai_draft_generated"
  | "ai_draft_applied"
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
        "lesson_deleted",
        "lesson_published",
        "lesson_unpublished",
        "lesson_archived",
        "student_content_updated",
        "parent_summary_saved",
        "parent_summary_visibility_changed",
        "resource_added",
        "resource_updated",
        "resource_deleted",
        "resources_reordered",
        "flashcard_deck_created",
        "flashcard_deck_updated",
        "flashcard_deck_published",
        "flashcard_deck_archived",
        "flashcard_added",
        "flashcard_updated",
        "flashcard_deleted",
        "flashcards_reordered",
        "reflection_saved",
        "teaching_mode_updated",
        "teaching_mode_generated",
        "collaborator_added",
        "collaborator_removed",
        "comment_added",
        "comment_resolved",
        "ai_draft_generated",
        "ai_draft_applied",
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
