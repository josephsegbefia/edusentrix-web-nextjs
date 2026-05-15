import { Schema, model, models, Types, type Model } from "mongoose";

export interface IWhatsAppMessage {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  communicationId?: Types.ObjectId | null;
  deliveryId?: Types.ObjectId | null;
  toPhone: string;
  body: string;
  status: "queued" | "sent" | "delivered" | "read" | "failed" | "skipped";
  provider?: string | null;
  providerMessageId?: string | null;
  failureReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const whatsAppMessageSchema = new Schema<IWhatsAppMessage>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    communicationId: { type: Schema.Types.ObjectId, ref: "Communication", default: null, index: true },
    deliveryId: { type: Schema.Types.ObjectId, ref: "CommunicationDelivery", default: null, index: true },
    toPhone: { type: String, required: true, trim: true, index: true },
    body: { type: String, required: true },
    status: {
      type: String,
      enum: ["queued", "sent", "delivered", "read", "failed", "skipped"],
      default: "queued",
      index: true,
    },
    provider: { type: String, default: null, trim: true },
    providerMessageId: { type: String, default: null, trim: true },
    failureReason: { type: String, default: null, trim: true },
  },
  { timestamps: true },
);

export const WhatsAppMessage: Model<IWhatsAppMessage> =
  (models.WhatsAppMessage as Model<IWhatsAppMessage>) ||
  model<IWhatsAppMessage>("WhatsAppMessage", whatsAppMessageSchema);
