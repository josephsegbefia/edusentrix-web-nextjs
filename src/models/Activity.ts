import { Schema, model, models, Types } from "mongoose";

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
  | "donation.received"
  | "donation.refunded"
  // Community Hub - Exports
  | "poll.exported"
  | "campaign.exported"
  | "payout.approved";

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

export const Activity =
  models.Activity || model<IActivity>("Activity", activitySchema);
