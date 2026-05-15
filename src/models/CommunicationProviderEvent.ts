import { Schema, model, models, Types, type Model } from "mongoose";
import type { CommunicationChannel } from "@/lib/communications/types";

export interface ICommunicationProviderEvent {
  _id: Types.ObjectId;
  schoolId?: Types.ObjectId | null;
  communicationId?: Types.ObjectId | null;
  deliveryId?: Types.ObjectId | null;
  channel: CommunicationChannel;
  provider: string;
  eventType: string;
  providerMessageId?: string | null;
  payload: Record<string, unknown>;
  receivedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const communicationProviderEventSchema = new Schema<ICommunicationProviderEvent>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", default: null, index: true },
    communicationId: { type: Schema.Types.ObjectId, ref: "Communication", default: null, index: true },
    deliveryId: { type: Schema.Types.ObjectId, ref: "CommunicationDelivery", default: null, index: true },
    channel: {
      type: String,
      enum: ["in_app", "email", "whatsapp", "sms"],
      required: true,
      index: true,
    },
    provider: { type: String, required: true, trim: true, index: true },
    eventType: { type: String, required: true, trim: true, index: true },
    providerMessageId: { type: String, default: null, trim: true, index: true },
    payload: { type: Schema.Types.Mixed, default: {} },
    receivedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);

export const CommunicationProviderEvent: Model<ICommunicationProviderEvent> =
  (models.CommunicationProviderEvent as Model<ICommunicationProviderEvent>) ||
  model<ICommunicationProviderEvent>(
    "CommunicationProviderEvent",
    communicationProviderEventSchema,
  );
