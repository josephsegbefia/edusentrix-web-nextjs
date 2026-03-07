import { Schema, model, models, Types, type Model } from "mongoose";
import type {
  SubscriptionDiscountMode,
  SubscriptionStatus,
} from "@/lib/platform-billing/subscription-pricing";

export interface ISchoolSubscription {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  tierId?: Types.ObjectId | null;
  tierCode?: string | null;
  tierName?: string | null;
  status: SubscriptionStatus;
  basePriceMinor: number;
  manualPriceOverrideMinor?: number | null;
  discountMode: SubscriptionDiscountMode;
  discountValue?: number | null;
  effectivePriceMinor: number;
  note?: string | null;
  pilotEndsAt?: Date | null;
  updatedBy?: Types.ObjectId | null;
  updatedByEmail?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const schoolSubscriptionSchema = new Schema<ISchoolSubscription>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      unique: true,
      index: true,
    },
    tierId: { type: Schema.Types.ObjectId, ref: "SubscriptionTier", default: null },
    tierCode: { type: String, default: null, trim: true },
    tierName: { type: String, default: null, trim: true },
    status: {
      type: String,
      enum: ["draft", "trial", "active", "suspended", "cancelled"],
      default: "draft",
      required: true,
    },
    basePriceMinor: { type: Number, required: true, default: 0 },
    manualPriceOverrideMinor: { type: Number, default: null },
    discountMode: {
      type: String,
      enum: ["none", "percent", "fixed"],
      default: "none",
      required: true,
    },
    discountValue: { type: Number, default: null },
    effectivePriceMinor: { type: Number, required: true, default: 0 },
    note: { type: String, default: null, trim: true },
    pilotEndsAt: { type: Date, default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    updatedByEmail: { type: String, default: null, trim: true },
  },
  { timestamps: true }
);

schoolSubscriptionSchema.index({ schoolId: 1 }, { unique: true });
schoolSubscriptionSchema.index({ status: 1 });

export const SchoolSubscription: Model<ISchoolSubscription> =
  (models.SchoolSubscription as Model<ISchoolSubscription>) ||
  model<ISchoolSubscription>("SchoolSubscription", schoolSubscriptionSchema);
