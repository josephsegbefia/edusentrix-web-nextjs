import { Schema, model, models, Types, type Model } from "mongoose";
import {
  platformPayoutDestinationSchema,
  type IPlatformPayoutDestination,
} from "@/models/PlatformBillingSettings";

export interface IPlatformPayoutChangeChallenge {
  _id: Types.ObjectId;
  adminUserId: Types.ObjectId;
  adminEmail: string;
  phone: string;
  purpose: "payout_account_change";
  otpHash: string;
  attempts: number;
  deliveryChannel: "whatsapp";
  deliveryMode?: string | null;
  pendingUpdate: {
    subscriptionPayout: IPlatformPayoutDestination;
    transactionFeePayout: IPlatformPayoutDestination;
    changeNote?: string | null;
  };
  createdAt: Date;
  expiresAt: Date;
  consumedAt?: Date | null;
}

const platformPayoutChangeChallengeSchema =
  new Schema<IPlatformPayoutChangeChallenge>({
    adminUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    adminEmail: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    purpose: {
      type: String,
      enum: ["payout_account_change"],
      required: true,
      default: "payout_account_change",
      index: true,
    },
    otpHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    deliveryChannel: {
      type: String,
      enum: ["whatsapp"],
      required: true,
      default: "whatsapp",
    },
    deliveryMode: { type: String, default: null, trim: true },
    pendingUpdate: {
      subscriptionPayout: {
        type: platformPayoutDestinationSchema,
        required: true,
      },
      transactionFeePayout: {
        type: platformPayoutDestinationSchema,
        required: true,
      },
      changeNote: { type: String, default: null, trim: true },
    },
    createdAt: { type: Date, default: () => new Date() },
    expiresAt: { type: Date, required: true },
    consumedAt: { type: Date, default: null },
  });

platformPayoutChangeChallengeSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);
platformPayoutChangeChallengeSchema.index({
  adminUserId: 1,
  purpose: 1,
  createdAt: -1,
});

export const PlatformPayoutChangeChallenge: Model<IPlatformPayoutChangeChallenge> =
  (models.PlatformPayoutChangeChallenge as Model<IPlatformPayoutChangeChallenge>) ||
  model<IPlatformPayoutChangeChallenge>(
    "PlatformPayoutChangeChallenge",
    platformPayoutChangeChallengeSchema
  );
