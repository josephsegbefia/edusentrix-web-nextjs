import { Schema, model, models, Types, type Model } from "mongoose";

export interface ISubscriptionTier {
  _id: Types.ObjectId;
  code: string;
  name: string;
  description?: string | null;
  priceMinor: number;
  billingCadence: "monthly";
  studentLimit?: number | null;
  features: string[];
  provisional: boolean;
  active: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionTierSchema = new Schema<ISubscriptionTier>(
  {
    code: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: null, trim: true },
    priceMinor: { type: Number, required: true },
    billingCadence: {
      type: String,
      enum: ["monthly"],
      default: "monthly",
      required: true,
    },
    studentLimit: { type: Number, default: null },
    features: [{ type: String, trim: true }],
    provisional: { type: Boolean, default: true },
    active: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

subscriptionTierSchema.index({ code: 1 }, { unique: true });
subscriptionTierSchema.index({ active: 1, sortOrder: 1 });

export const SubscriptionTier: Model<ISubscriptionTier> =
  (models.SubscriptionTier as Model<ISubscriptionTier>) ||
  model<ISubscriptionTier>("SubscriptionTier", subscriptionTierSchema);
