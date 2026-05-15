import { Schema, model, models, Types, type Model } from "mongoose";
import type { CommunicationChannel } from "@/lib/communications/types";

export interface ICommunicationSuppression {
  _id: Types.ObjectId;
  schoolId?: Types.ObjectId | null;
  channel: CommunicationChannel;
  destination: string;
  reason: string;
  source?: string | null;
  expiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const communicationSuppressionSchema = new Schema<ICommunicationSuppression>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", default: null, index: true },
    channel: {
      type: String,
      enum: ["in_app", "email", "whatsapp", "sms"],
      required: true,
      index: true,
    },
    destination: { type: String, required: true, lowercase: true, trim: true },
    reason: { type: String, required: true, trim: true },
    source: { type: String, default: null, trim: true },
    expiresAt: { type: Date, default: null, index: true },
  },
  { timestamps: true },
);

communicationSuppressionSchema.index(
  { schoolId: 1, channel: 1, destination: 1 },
  { unique: true },
);

export const CommunicationSuppression: Model<ICommunicationSuppression> =
  (models.CommunicationSuppression as Model<ICommunicationSuppression>) ||
  model<ICommunicationSuppression>("CommunicationSuppression", communicationSuppressionSchema);
