import { Schema, model, models, Types, type Model } from "mongoose";
import type {
  CommunicationChannel,
  CommunicationDeliveryStatus,
  CommunicationRecipientRole,
} from "@/lib/communications/types";

export interface ICommunicationDelivery {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  communicationId: Types.ObjectId;
  snapshotId?: Types.ObjectId | null;
  channel: CommunicationChannel;
  status: CommunicationDeliveryStatus;
  recipientKey: string;
  recipientUserId?: Types.ObjectId | null;
  recipientStudentId?: Types.ObjectId | null;
  recipientGuardianId?: Types.ObjectId | null;
  recipientRole: CommunicationRecipientRole;
  recipientName?: string | null;
  destination?: string | null;
  provider?: string | null;
  providerMessageId?: string | null;
  outputEntityType?: string | null;
  outputEntityId?: Types.ObjectId | null;
  skippedReason?: string | null;
  failureReason?: string | null;
  queuedAt?: Date | null;
  sentAt?: Date | null;
  deliveredAt?: Date | null;
  readAt?: Date | null;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const communicationDeliverySchema = new Schema<ICommunicationDelivery>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    communicationId: {
      type: Schema.Types.ObjectId,
      ref: "Communication",
      required: true,
      index: true,
    },
    snapshotId: {
      type: Schema.Types.ObjectId,
      ref: "CommunicationAudienceSnapshot",
      default: null,
    },
    channel: {
      type: String,
      enum: ["in_app", "email", "whatsapp", "sms"],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "queued", "sending", "sent", "delivered", "read", "failed", "skipped", "cancelled"],
      default: "pending",
      index: true,
    },
    recipientKey: { type: String, required: true, trim: true },
    recipientUserId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    recipientStudentId: { type: Schema.Types.ObjectId, ref: "Student", default: null },
    recipientGuardianId: { type: Schema.Types.ObjectId, ref: "Guardian", default: null },
    recipientRole: {
      type: String,
      enum: ["parent", "student", "teacher", "staff", "school_admin", "bursar", "external"],
      required: true,
    },
    recipientName: { type: String, default: null, trim: true },
    destination: { type: String, default: null, trim: true },
    provider: { type: String, default: null, trim: true },
    providerMessageId: { type: String, default: null, trim: true },
    outputEntityType: { type: String, default: null, trim: true },
    outputEntityId: { type: Schema.Types.ObjectId, default: null },
    skippedReason: { type: String, default: null, trim: true },
    failureReason: { type: String, default: null, trim: true },
    queuedAt: { type: Date, default: null },
    sentAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    readAt: { type: Date, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

communicationDeliverySchema.index({
  communicationId: 1,
  recipientKey: 1,
  channel: 1,
}, { unique: true });
communicationDeliverySchema.index({ schoolId: 1, status: 1, createdAt: -1 });

export const CommunicationDelivery: Model<ICommunicationDelivery> =
  (models.CommunicationDelivery as Model<ICommunicationDelivery>) ||
  model<ICommunicationDelivery>("CommunicationDelivery", communicationDeliverySchema);
