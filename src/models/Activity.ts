import { Schema, model, models, Types, type Model } from "mongoose";

export type ActivityType =
  | "student.created"
  | "student.updated"
  | "teacher.created"
  | "teacher.updated"
  | "class_group.created"
  | "class_group.updated"
  | "invitation.sent"
  | "invitation.resent"
  | "invitation.revoked"
  | "invitation.accepted"
  | "subject.created"
  | "subject.updated"
  | "academic_period.created"
  | "academic_period.updated"
  | "fee.created"
  | "fee.updated"
  | "fee.reminder_sent"
  | "payment.received"
  | "report.generated"
  | "settings.updated"
  | "guardian.created"
  | "guardian.updated"
  | "guardian.removed"
  | "guardian.set_primary"
  // Community Hub - Polls
  | "poll.created"
  | "poll.published"
  | "poll.closed"
  | "poll.approved"
  | "poll.rejected"
  // Community Hub - Fundraising
  | "campaign.created"
  | "campaign.published"
  | "campaign.closed"
  | "campaign.approved"
  | "campaign.rejected"
  | "campaign.shared"
  | "campaign.unshared"
  | "campaign.update_posted"
  | "campaign.update_edited"
  | "campaign.update_deleted"
  | "donation.received"
  | "donation.refunded"
  // Community Hub - Exports
  | "poll.exported"
  | "campaign.exported"
  | "payout.approved"
  | "payout.rejected"
  // Expenses
  | "expense.created"
  | "expense.updated"
  | "expense.submitted"
  | "expense.approved"
  | "expense.rejected"
  | "expense.paid"
  | "expense.cancelled"
  // Financial Center
  | "transaction.created"
  | "transaction.voided"
  | "transaction.refunded"
  | "transaction.adjusted"
  // Timetable Reboot
  | "timetable.version.created"
  | "timetable.version.cloned_from_published"
  | "timetable.conflicts.recomputed"
  | "timetable.slot.created"
  | "timetable.slot.updated"
  | "timetable.slot.deleted"
  | "timetable.version.published"
  | "timetable.version.archived"
  | "timetable.backfill.executed"
  // Promotions
  | "promotion.policy.created"
  | "promotion.policy.activated"
  | "promotion.cycle.preview_ready"
  | "promotion.cycle.approved"
  | "promotion.cycle.finalize_started"
  | "promotion.cycle.finalized"
  | "promotion.cycle.finalize_failed"
  | "promotion.cycle.rollback_started"
  | "promotion.cycle.rolled_back"
  | "promotion.cycle.rollback_failed"
  | "promotion.decision.override"
  | "promotion.decision.placement";

export interface IActivity {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  type: ActivityType;
  userId: Types.ObjectId; // User who performed the action
  entityType?: string; // e.g., "Student", "Teacher", "Invitation"
  entityId?: Types.ObjectId; // ID of the affected entity
  description: string; // Human-readable description
  metadata?: Record<string, unknown>; // Additional context
  createdAt: Date;
}

const activitySchema = new Schema<IActivity>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    entityType: {
      type: String,
      index: true,
    },
    entityId: {
      type: Schema.Types.ObjectId,
      index: true,
    },
    description: {
      type: String,
      required: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Indexes for efficient queries
activitySchema.index({ schoolId: 1, createdAt: -1 });
activitySchema.index({ schoolId: 1, type: 1, createdAt: -1 });
activitySchema.index({ entityType: 1, entityId: 1 });

export const Activity: Model<IActivity> =
  (models.Activity as Model<IActivity>) ||
  model<IActivity>("Activity", activitySchema);
