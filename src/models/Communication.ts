import { Schema, model, models, Types, type Model } from "mongoose";
import type {
  CommunicationAudienceRule,
  CommunicationChannel,
  CommunicationPriority,
  CommunicationStatus,
  CommunicationType,
} from "@/lib/communications/types";

export interface ICommunication {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  type: CommunicationType;
  status: CommunicationStatus;
  priority: CommunicationPriority;
  title: string;
  bodyHtml: string;
  bodyText: string;
  channels: CommunicationChannel[];
  audience: CommunicationAudienceRule;
  createdByUserId: Types.ObjectId;
  senderRole?: string | null;
  templateId?: Types.ObjectId | null;
  scheduledFor?: Date | null;
  sentAt?: Date | null;
  allowReplies: boolean;
  replyThreadId?: Types.ObjectId | null;
  actionUrl?: string | null;
  metadata?: Record<string, unknown>;
  stats?: {
    audienceCount: number;
    deliveryCount: number;
    queuedCount: number;
    sentCount: number;
    deliveredCount: number;
    readCount: number;
    failedCount: number;
    skippedCount: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const communicationSchema = new Schema<ICommunication>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    type: {
      type: String,
      enum: [
        "notice",
        "announcement",
        "direct_message",
        "fee_reminder",
        "attendance_alert",
        "academic_update",
        "lesson_update",
        "exam_notice",
        "event_notice",
        "emergency_alert",
        "video_meeting_invite",
        "newsletter",
        "system_alert",
      ],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["draft", "scheduled", "queued", "sending", "sent", "partially_sent", "failed", "cancelled", "archived"],
      default: "draft",
      index: true,
    },
    priority: {
      type: String,
      enum: ["low", "normal", "high", "urgent"],
      default: "normal",
      index: true,
    },
    title: { type: String, required: true, trim: true },
    bodyHtml: { type: String, required: true },
    bodyText: { type: String, required: true },
    channels: {
      type: [{ type: String, enum: ["in_app", "email", "whatsapp", "sms"] }],
      default: ["in_app"],
    },
    audience: { type: Schema.Types.Mixed, required: true },
    createdByUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    senderRole: { type: String, default: null },
    templateId: { type: Schema.Types.ObjectId, ref: "CommunicationTemplate", default: null },
    scheduledFor: { type: Date, default: null, index: true },
    sentAt: { type: Date, default: null },
    allowReplies: { type: Boolean, default: false },
    replyThreadId: { type: Schema.Types.ObjectId, ref: "MessageThread", default: null },
    actionUrl: { type: String, default: null, trim: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    stats: {
      audienceCount: { type: Number, default: 0 },
      deliveryCount: { type: Number, default: 0 },
      queuedCount: { type: Number, default: 0 },
      sentCount: { type: Number, default: 0 },
      deliveredCount: { type: Number, default: 0 },
      readCount: { type: Number, default: 0 },
      failedCount: { type: Number, default: 0 },
      skippedCount: { type: Number, default: 0 },
    },
  },
  { timestamps: true },
);

communicationSchema.index({ schoolId: 1, status: 1, createdAt: -1 });
communicationSchema.index({ schoolId: 1, type: 1, createdAt: -1 });

export const Communication: Model<ICommunication> =
  (models.Communication as Model<ICommunication>) ||
  model<ICommunication>("Communication", communicationSchema);
