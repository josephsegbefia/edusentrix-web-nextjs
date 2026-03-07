import { Schema, model, models, Types, type Model } from "mongoose";

export type PlatformPayoutMethod = "bank" | "mobile_money";

export interface IPlatformPayoutDestination {
  method: PlatformPayoutMethod;
  accountName: string;
  accountNumber: string;
  bankName?: string | null;
  bankCode?: string | null;
  providerName?: string | null;
  notes?: string | null;
}

export interface IPlatformBillingSettings {
  _id: Types.ObjectId;
  key: string;
  subscriptionPayout: IPlatformPayoutDestination | null;
  transactionFeePayout: IPlatformPayoutDestination | null;
  lastVerifiedAt?: Date | null;
  updatedBy?: Types.ObjectId | null;
  updatedByEmail?: string | null;
  auditLog: Array<{
    changedAt: Date;
    changedBy?: Types.ObjectId | null;
    changedByEmail?: string | null;
    summary?: string | null;
    subscriptionPayoutMasked?: string | null;
    transactionFeePayoutMasked?: string | null;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export const platformPayoutDestinationSchema =
  new Schema<IPlatformPayoutDestination>(
    {
      method: {
        type: String,
        enum: ["bank", "mobile_money"],
        required: true,
      },
      accountName: { type: String, required: true, trim: true },
      accountNumber: { type: String, required: true, trim: true },
      bankName: { type: String, default: null, trim: true },
      bankCode: { type: String, default: null, trim: true },
      providerName: { type: String, default: null, trim: true },
      notes: { type: String, default: null, trim: true },
    },
    { _id: false }
  );

const platformBillingSettingsSchema = new Schema<IPlatformBillingSettings>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: "default",
      trim: true,
    },
    subscriptionPayout: {
      type: platformPayoutDestinationSchema,
      default: null,
    },
    transactionFeePayout: {
      type: platformPayoutDestinationSchema,
      default: null,
    },
    lastVerifiedAt: { type: Date, default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    updatedByEmail: { type: String, default: null, trim: true },
    auditLog: [
      {
        changedAt: { type: Date, default: Date.now },
        changedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
        changedByEmail: { type: String, default: null, trim: true },
        summary: { type: String, default: null, trim: true },
        subscriptionPayoutMasked: { type: String, default: null, trim: true },
        transactionFeePayoutMasked: { type: String, default: null, trim: true },
      },
    ],
  },
  { timestamps: true }
);

platformBillingSettingsSchema.index({ key: 1 }, { unique: true });

export const PlatformBillingSettings: Model<IPlatformBillingSettings> =
  (models.PlatformBillingSettings as Model<IPlatformBillingSettings>) ||
  model<IPlatformBillingSettings>(
    "PlatformBillingSettings",
    platformBillingSettingsSchema
  );
