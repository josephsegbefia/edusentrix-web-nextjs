import { Schema, model, models, Types } from "mongoose";

/**
 * LessonNoteApproval Model
 *
 * Tracks the approval history for lesson notes.
 * Each action (submit, approve, reject, revise) creates a new record.
 */

export type ApprovalAction = "submit" | "approve" | "reject" | "revise";

export interface ILessonNoteApproval {
  _id: Types.ObjectId;
  lessonNoteId: Types.ObjectId;
  schoolId: Types.ObjectId;
  action: ApprovalAction;
  actorId: Types.ObjectId; // User who performed the action
  comment?: string;
  previousStatus?: string;
  newStatus?: string;
  createdAt: Date;
}

const LessonNoteApprovalSchema = new Schema<ILessonNoteApproval>(
  {
    lessonNoteId: {
      type: Schema.Types.ObjectId,
      ref: "LessonNote",
      required: true,
      index: true,
    },
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: ["submit", "approve", "reject", "revise"],
      required: true,
    },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    comment: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    previousStatus: {
      type: String,
    },
    newStatus: {
      type: String,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Index for fetching approval history for a lesson note
LessonNoteApprovalSchema.index({ lessonNoteId: 1, createdAt: -1 });

// Index for fetching all approvals by an actor
LessonNoteApprovalSchema.index({ schoolId: 1, actorId: 1, createdAt: -1 });

// Index for fetching recent actions in a school
LessonNoteApprovalSchema.index({ schoolId: 1, action: 1, createdAt: -1 });

export const LessonNoteApproval =
  models.LessonNoteApproval ||
  model<ILessonNoteApproval>("LessonNoteApproval", LessonNoteApprovalSchema);
