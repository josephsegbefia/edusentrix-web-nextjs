/**
 * SubscriptionAddOn — a one-time or recurring add-on purchase for a school.
 *
 * Examples:
 *  - Leo AI credit top-ups  (addonType: "leo_credits",       quantity: 500)
 *  - EduSentrix Learn seats (addonType: "learn_seats",       quantity: 20)
 *  - Extra storage          (addonType: "storage_gb",        quantity: 50)
 *  - Meeting minutes        (addonType: "meeting_minutes",   quantity: 1000)
 *
 * When status === "credited", the corresponding UsageBalance record is
 * updated by the crediting workflow.
 *
 * Spec §10.
 */

import { Schema, model, models, Types, type Model } from "mongoose";

export type AddOnType =
  | "leo_credits"
  | "learn_seats"
  | "storage_gb"
  | "meeting_minutes"
  | "sms_credits"
  | "whatsapp_credits";

export type AddOnStatus =
  | "pending"     // created, awaiting payment confirmation
  | "paid"        // payment confirmed, not yet applied to balance
  | "credited"    // applied to UsageBalance
  | "cancelled"   // voided before crediting
  | "refunded";   // credited then refunded

export const ADDON_TYPES: AddOnType[] = [
  "leo_credits",
  "learn_seats",
  "storage_gb",
  "meeting_minutes",
  "sms_credits",
  "whatsapp_credits",
];

export const ADDON_LABELS: Record<AddOnType, string> = {
  leo_credits: "Leo AI Credits",
  learn_seats: "EduSentrix Learn Seats",
  storage_gb: "Extra Storage (GB)",
  meeting_minutes: "Meeting Minutes",
  sms_credits: "SMS Credits",
  whatsapp_credits: "WhatsApp Credits",
};

export interface ISubscriptionAddOn {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  subscriptionId?: Types.ObjectId | null;
  addonType: AddOnType;
  quantity: number;
  priceMinor: number;
  status: AddOnStatus;
  invoiceReference?: string | null;
  paymentReference?: string | null;
  creditedAt?: Date | null;
  cancelledAt?: Date | null;
  note?: string | null;
  createdBy?: Types.ObjectId | null;
  createdByEmail?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionAddOnSchema = new Schema<ISubscriptionAddOn>(
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
    addonType: {
      type: String,
      enum: ADDON_TYPES,
      required: true,
      index: true,
    },
    quantity: { type: Number, required: true, min: 1 },
    priceMinor: { type: Number, required: true, min: 0, default: 0 },
    status: {
      type: String,
      enum: ["pending", "paid", "credited", "cancelled", "refunded"],
      required: true,
      default: "pending",
      index: true,
    },
    invoiceReference: { type: String, trim: true, default: null },
    paymentReference: { type: String, trim: true, default: null },
    creditedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    note: { type: String, trim: true, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    createdByEmail: { type: String, trim: true, default: null },
  },
  { timestamps: true }
);

subscriptionAddOnSchema.index({ schoolId: 1, status: 1 });
subscriptionAddOnSchema.index({ schoolId: 1, addonType: 1 });
subscriptionAddOnSchema.index({ schoolId: 1, createdAt: -1 });

export const SubscriptionAddOn: Model<ISubscriptionAddOn> =
  (models.SubscriptionAddOn as Model<ISubscriptionAddOn>) ||
  model<ISubscriptionAddOn>("SubscriptionAddOn", subscriptionAddOnSchema);
