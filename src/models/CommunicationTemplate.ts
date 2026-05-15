import { Schema, model, models, Types, type Model } from "mongoose";
import type { CommunicationChannel, CommunicationType } from "@/lib/communications/types";

export interface ICommunicationTemplate {
  _id: Types.ObjectId;
  schoolId?: Types.ObjectId | null;
  key: string;
  name: string;
  description?: string | null;
  type: CommunicationType;
  defaultChannels: CommunicationChannel[];
  subject: string;
  bodyHtml: string;
  bodyText: string;
  variables: string[];
  isSystem: boolean;
  isActive: boolean;
  createdByUserId?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const communicationTemplateSchema = new Schema<ICommunicationTemplate>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", default: null, index: true },
    key: { type: String, required: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: null, trim: true },
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
    },
    defaultChannels: {
      type: [{ type: String, enum: ["in_app", "email", "whatsapp", "sms"] }],
      default: ["in_app", "email"],
    },
    subject: { type: String, required: true, trim: true },
    bodyHtml: { type: String, required: true },
    bodyText: { type: String, required: true },
    variables: { type: [String], default: [] },
    isSystem: { type: Boolean, default: false, index: true },
    isActive: { type: Boolean, default: true, index: true },
    createdByUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

communicationTemplateSchema.index({ schoolId: 1, key: 1 }, { unique: true });

export const CommunicationTemplate: Model<ICommunicationTemplate> =
  (models.CommunicationTemplate as Model<ICommunicationTemplate>) ||
  model<ICommunicationTemplate>("CommunicationTemplate", communicationTemplateSchema);
