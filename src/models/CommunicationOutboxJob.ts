import { Schema, model, models, Types, type Model } from "mongoose";
import type { CommunicationChannel, CommunicationOutboxStatus } from "@/lib/communications/types";

export interface ICommunicationOutboxJob {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  communicationId: Types.ObjectId;
  deliveryId: Types.ObjectId;
  channel: CommunicationChannel;
  status: CommunicationOutboxStatus;
  priority: number;
  attempts: number;
  maxAttempts: number;
  nextRunAt?: Date | null;
  lockedAt?: Date | null;
  lastError?: string | null;
  payload?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const communicationOutboxJobSchema = new Schema<ICommunicationOutboxJob>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    communicationId: {
      type: Schema.Types.ObjectId,
      ref: "Communication",
      required: true,
      index: true,
    },
    deliveryId: {
      type: Schema.Types.ObjectId,
      ref: "CommunicationDelivery",
      required: true,
      index: true,
      unique: true,
    },
    channel: {
      type: String,
      enum: ["in_app", "email", "whatsapp", "sms"],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "running", "completed", "failed", "dead_letter"],
      default: "pending",
      index: true,
    },
    priority: { type: Number, default: 50, index: true },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 5 },
    nextRunAt: { type: Date, default: null, index: true },
    lockedAt: { type: Date, default: null },
    lastError: { type: String, default: null, trim: true },
    payload: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

communicationOutboxJobSchema.index({ status: 1, priority: 1, nextRunAt: 1, createdAt: 1 });
communicationOutboxJobSchema.index({ communicationId: 1, status: 1 });

export const CommunicationOutboxJob: Model<ICommunicationOutboxJob> =
  (models.CommunicationOutboxJob as Model<ICommunicationOutboxJob>) ||
  model<ICommunicationOutboxJob>("CommunicationOutboxJob", communicationOutboxJobSchema);
