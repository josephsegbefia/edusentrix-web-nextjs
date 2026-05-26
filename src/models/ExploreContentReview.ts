import { Schema, model, models, Types, type Model } from "mongoose";

import type { ExploreReviewAction, ExploreReviewerRole } from "@/lib/learn/explore/explore-types";

export type { ExploreReviewAction, ExploreReviewerRole };

export interface IExploreContentReview {
  _id: Types.ObjectId;
  adventureId: Types.ObjectId;
  contentSnapshotId: Types.ObjectId;
  schoolId: Types.ObjectId;
  reviewerId: Types.ObjectId;
  reviewerRole: ExploreReviewerRole;
  action: ExploreReviewAction;
  reason?: string | null;
  notes?: string | null;
  reportedByStudentId?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const exploreContentReviewSchema = new Schema<IExploreContentReview>(
  {
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
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    reviewerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    reviewerRole: {
      type: String,
      enum: ["parent", "class_teacher", "school_admin", "platform_admin"],
      required: true,
    },
    action: {
      type: String,
      enum: [
        "approved",
        "hidden",
        "reported",
        "requested_changes",
        "marked_safe",
        "marked_too_hard",
        "marked_too_easy",
        "marked_not_relevant",
      ],
      required: true,
      index: true,
    },
    reason: { type: String, default: null, trim: true },
    notes: { type: String, default: null, trim: true },
    reportedByStudentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

exploreContentReviewSchema.index({ adventureId: 1, createdAt: -1 });
exploreContentReviewSchema.index({ contentSnapshotId: 1, action: 1 });
exploreContentReviewSchema.index({ schoolId: 1, action: 1, createdAt: -1 });

export const ExploreContentReview: Model<IExploreContentReview> =
  (models.ExploreContentReview as Model<IExploreContentReview>) ||
  model<IExploreContentReview>("ExploreContentReview", exploreContentReviewSchema);
