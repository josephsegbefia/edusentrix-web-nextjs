import { Schema, model, models, Types, type Model } from "mongoose";

export type SubscriptionEventType =
  | "subscription_assigned"
  | "subscription_updated"
  | "subscription_renewed"
  | "subscription_suspended"
  | "subscription_reactivated"
  | "subscription_cancelled"
  | "subscription_expired"
  | "subscription_upgraded"
  | "subscription_downgraded"
  | "subscription_pricing_recalculated"
  | "subscription_renewal_notice_sent"
  | "subscription_invoice_issued"
  | "plan_change_requested"
  | "grace_period_started"
  | "grace_period_ended"
  | "pilot_ended"
  | "access_mode_override"
  | "addon_purchased"
  | "addon_credited"
  | "usage_event"
  | "renewal_requested"
  | "renewal_confirmed"
  | "renewal_failed"
  | "payment_recorded"
  | "entitlement_audit";

export const SUBSCRIPTION_EVENT_TYPES: SubscriptionEventType[] = [
  "subscription_assigned",
  "subscription_updated",
  "subscription_renewed",
  "subscription_suspended",
  "subscription_reactivated",
  "subscription_cancelled",
  "subscription_expired",
  "subscription_upgraded",
  "subscription_downgraded",
  "subscription_pricing_recalculated",
  "subscription_renewal_notice_sent",
  "subscription_invoice_issued",
  "plan_change_requested",
  "grace_period_started",
  "grace_period_ended",
  "pilot_ended",
  "access_mode_override",
  "addon_purchased",
  "addon_credited",
  "usage_event",
  "renewal_requested",
  "renewal_confirmed",
  "renewal_failed",
  "payment_recorded",
  "entitlement_audit",
];

export interface ISubscriptionEvent {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  subscriptionId?: Types.ObjectId | null;
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
    default: null,
    index: true,
  },
  eventType: {
    type: String,
    enum: SUBSCRIPTION_EVENT_TYPES,
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

function blockMutation(next: (err?: Error) => void) {
  next(new Error("Subscription events are immutable. Create a new event instead."));
}

subscriptionEventSchema.pre("updateOne", blockMutation);
subscriptionEventSchema.pre("findOneAndUpdate", blockMutation);
subscriptionEventSchema.pre("deleteOne", blockMutation);
subscriptionEventSchema.pre("findOneAndDelete", blockMutation);

export const SubscriptionEvent: Model<ISubscriptionEvent> =
  (models.SubscriptionEvent as Model<ISubscriptionEvent>) ||
  model<ISubscriptionEvent>("SubscriptionEvent", subscriptionEventSchema);
