/**
 * AddOnPackage — catalog of purchasable add-on packages.
 *
 * Examples:
 *   - "500 Leo AI Credits" — code: leo_500, type: leo_credits, quantity: 500
 *   - "Meeting Bundle" — code: meetings_1000, type: meeting_participant_minutes, quantity: 1000
 *   - "+10GB Storage" — code: storage_10gb, type: storage_bytes, quantity: 10737418240
 *
 * Distinct from SubscriptionAddOn which tracks individual purchase records.
 * AddOnPackage is the catalog; SubscriptionAddOn is the purchase.
 *
 * Spec §11.7, §14.7.
 */

import { Schema, model, models, type Model } from "mongoose";

export type AddOnPackageType =
  | "leo_credits"
  | "meeting_participant_minutes"
  | "storage_bytes"
  | "learn_seats"
  | "sms_credits"
  | "whatsapp_credits";

export const ADDON_PACKAGE_TYPES: AddOnPackageType[] = [
  "leo_credits",
  "meeting_participant_minutes",
  "storage_bytes",
  "learn_seats",
  "sms_credits",
  "whatsapp_credits",
];

export const ADDON_PACKAGE_TYPE_LABELS: Record<AddOnPackageType, string> = {
  leo_credits: "Leo AI Credits",
  meeting_participant_minutes: "Meeting participant-minutes",
  storage_bytes: "Extra Storage",
  learn_seats: "EduSentrix Learn seats",
  sms_credits: "SMS Credits",
  whatsapp_credits: "WhatsApp Credits",
};

export interface IAddOnPackage {
  _id: Schema.Types.ObjectId;
  code: string;
  name: string;
  description?: string | null;
  type: AddOnPackageType;
  /** Quantity in native units (credits, minutes, bytes, seats) */
  quantity: number;
  /** Display quantity for human-readable labels (e.g. "10GB" displayed as 10) */
  displayQuantity?: number | null;
  /** Display unit (e.g. "GB", "credits", "minutes") */
  displayUnit?: string | null;
  priceMinor: number;
  currency: "GHS";
  active: boolean;
  /** Plan codes that may purchase this package — empty means all eligible plans */
  availableToPlans: string[];
  /** If true, credits expire at end of the billing period */
  expiresWithBillingPeriod: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const addOnPackageSchema = new Schema<IAddOnPackage>(
  {
    code: { type: String, required: true, trim: true, unique: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: null },
    type: {
      type: String,
      enum: ADDON_PACKAGE_TYPES,
      required: true,
      index: true,
    },
    quantity: { type: Number, required: true, min: 1 },
    displayQuantity: { type: Number, default: null },
    displayUnit: { type: String, trim: true, default: null },
    priceMinor: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: ["GHS"], default: "GHS" },
    active: { type: Boolean, default: true, index: true },
    availableToPlans: [{ type: String, trim: true }],
    expiresWithBillingPeriod: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

addOnPackageSchema.index({ type: 1, active: 1, sortOrder: 1 });

export const AddOnPackage: Model<IAddOnPackage> =
  (models.AddOnPackage as Model<IAddOnPackage>) ||
  model<IAddOnPackage>("AddOnPackage", addOnPackageSchema);
