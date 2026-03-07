import { Schema, model, models, Types, type Model } from "mongoose";

export type SubscriptionEventType =
  | "subscription_assigned"
  | "subscription_updated"
  | "subscription_suspended"
  | "subscription_reactivated"
  | "subscription_cancelled";

export interface ISubscriptionEvent {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  subscriptionId: Types.ObjectId;
  eventType: SubscriptionEventType;
  actorId?: Types.ObjectId | null;
  actorEmail?: string | null;
  summary: string;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
}

const subscriptionEventSchema = new Schema<ISubscriptionEvent>({
  schoolId: {
    type: Schema.Types.ObjectId,
    ref: "School",
    required: true,
    index: true,
  },
  subscriptionId: {
    type: Schema.Types.ObjectId,
    ref: "SchoolSubscription",
    required: true,
    index: true,
  },
  eventType: {
    type: String,
    enum: [
      "subscription_assigned",
      "subscription_updated",
      "subscription_suspended",
      "subscription_reactivated",
      "subscription_cancelled",
    ],
    required: true,
    index: true,
  },
  actorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  actorEmail: { type: String, default: null, trim: true },
  summary: { type: String, required: true, trim: true },
  metadata: { type: Schema.Types.Mixed, default: null },
  createdAt: { type: Date, default: () => new Date() },
});

subscriptionEventSchema.index({ schoolId: 1, createdAt: -1 });
subscriptionEventSchema.index({ subscriptionId: 1, createdAt: -1 });

export const SubscriptionEvent: Model<ISubscriptionEvent> =
  (models.SubscriptionEvent as Model<ISubscriptionEvent>) ||
  model<ISubscriptionEvent>("SubscriptionEvent", subscriptionEventSchema);
