import { Schema, model, models, Types, type Model } from "mongoose";

export interface ISubscriptionCheckoutIntent {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  subscriptionId?: Types.ObjectId | null;
  invoiceId?: Types.ObjectId | null;
  targetTierId: Types.ObjectId;
  targetTierCode: string;
  targetTierName: string;
  amountMinor: number;
  currency: string;
  status:
    | "initiated"
    | "awaiting_webhook"
    | "succeeded"
    | "failed"
    | "cancelled"
    | "expired";
  paystackReference?: string | null;
  idempotencyKey: string;
  requestedBy?: Types.ObjectId | null;
  requestedByEmail?: string | null;
  appliedAt?: Date | null;
  expiresAt?: Date | null;
  failureReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionCheckoutIntentSchema =
  new Schema<ISubscriptionCheckoutIntent>(
    {
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
      },
      invoiceId: {
        type: Schema.Types.ObjectId,
        ref: "SubscriptionInvoice",
        default: null,
        index: true,
      },
      targetTierId: {
        type: Schema.Types.ObjectId,
        ref: "SubscriptionTier",
        required: true,
        index: true,
      },
      targetTierCode: { type: String, required: true, trim: true },
      targetTierName: { type: String, required: true, trim: true },
      amountMinor: { type: Number, required: true, default: 0 },
      currency: { type: String, required: true, default: "GHS", trim: true },
      status: {
        type: String,
        enum: [
          "initiated",
          "awaiting_webhook",
          "succeeded",
          "failed",
          "cancelled",
          "expired",
        ],
        required: true,
        default: "initiated",
        index: true,
      },
      paystackReference: { type: String, default: null, trim: true, index: true },
      idempotencyKey: { type: String, required: true, unique: true, trim: true },
      requestedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
      requestedByEmail: { type: String, default: null, trim: true },
      appliedAt: { type: Date, default: null },
      expiresAt: { type: Date, default: null, index: true },
      failureReason: { type: String, default: null, trim: true },
    },
    { timestamps: true }
  );

subscriptionCheckoutIntentSchema.index({ schoolId: 1, createdAt: -1 });
subscriptionCheckoutIntentSchema.index({ schoolId: 1, invoiceId: 1 });
subscriptionCheckoutIntentSchema.index({ schoolId: 1, paystackReference: 1 });
subscriptionCheckoutIntentSchema.index({ status: 1, expiresAt: 1 });

export const SubscriptionCheckoutIntent: Model<ISubscriptionCheckoutIntent> =
  (models.SubscriptionCheckoutIntent as Model<ISubscriptionCheckoutIntent>) ||
  model<ISubscriptionCheckoutIntent>(
    "SubscriptionCheckoutIntent",
    subscriptionCheckoutIntentSchema
  );
