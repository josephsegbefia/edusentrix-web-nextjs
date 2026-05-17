import { Schema, model, models, Types, type Model } from "mongoose";
import type { CommunicationChannel, CommunicationType } from "@/lib/communications/types";

export interface ICommunicationPreference {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  userId: Types.ObjectId;
  allowedChannels: CommunicationChannel[];
  mutedTypes: CommunicationType[];
  channelMutedTypes?: {
    in_app?: CommunicationType[];
    email?: CommunicationType[];
  };
  emailUrgentOnly: boolean;
  whatsappConsent: boolean;
  smsConsent: boolean;
  quietHours?: {
    enabled: boolean;
    start?: string | null;
    end?: string | null;
  };
  createdAt: Date;
  updatedAt: Date;
}

const communicationPreferenceSchema = new Schema<ICommunicationPreference>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    allowedChannels: {
      type: [{ type: String, enum: ["in_app", "email", "whatsapp", "sms"] }],
      default: ["in_app", "email"],
    },
    mutedTypes: {
      type: [
        {
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
        },
      ],
      default: [],
    },
    channelMutedTypes: {
      in_app: {
        type: [
          {
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
          },
        ],
        default: [],
      },
      email: {
        type: [
          {
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
          },
        ],
        default: [],
      },
    },
    emailUrgentOnly: { type: Boolean, default: false },
    whatsappConsent: { type: Boolean, default: false },
    smsConsent: { type: Boolean, default: false },
    quietHours: {
      enabled: { type: Boolean, default: false },
      start: { type: String, default: null },
      end: { type: String, default: null },
    },
  },
  { timestamps: true },
);

communicationPreferenceSchema.index({ schoolId: 1, userId: 1 }, { unique: true });

export const CommunicationPreference: Model<ICommunicationPreference> =
  (models.CommunicationPreference as Model<ICommunicationPreference>) ||
  model<ICommunicationPreference>("CommunicationPreference", communicationPreferenceSchema);
