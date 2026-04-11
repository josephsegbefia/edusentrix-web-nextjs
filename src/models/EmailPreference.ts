import { Schema, model, models, Types, type Model } from "mongoose";

export type EmailPreferenceRole =
  | "platform_admin"
  | "school_admin"
  | "bursar"
  | "teacher"
  | "parent"
  | "staff";

export interface IEmailPreference {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  schoolId?: Types.ObjectId | null;
  role: EmailPreferenceRole;

  locale?: string;
  timezone?: string;

  channels: {
    email: boolean;
    inApp: boolean;
    whatsapp?: boolean;
    sms?: boolean;
  };

  email: {
    immediate: {
      attendance: boolean;
      academics: boolean;
      announcements: boolean;
      billingReminders: boolean;
      manualMessages: boolean;
      lessonNoteReview: boolean;
    };
    digest: {
      daily: boolean;
      weekly: boolean;
    };
    urgentOnly: boolean;
    quietHours: {
      enabled: boolean;
      startTime: string;
      endTime: string;
    };
    optOutCategories: string[];
  };

  createdAt: Date;
  updatedAt: Date;
}

const TimeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;

const emailPreferenceSchema = new Schema<IEmailPreference>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      default: null,
      index: true,
    },
    role: {
      type: String,
      enum: [
        "platform_admin",
        "school_admin",
        "bursar",
        "teacher",
        "parent",
        "staff",
      ],
      required: true,
    },

    locale: { type: String, default: "en-GH", trim: true },
    timezone: { type: String, default: "Africa/Accra", trim: true },

    channels: {
      email: { type: Boolean, default: true },
      inApp: { type: Boolean, default: true },
      whatsapp: { type: Boolean, default: false },
      sms: { type: Boolean, default: false },
    },

    email: {
      immediate: {
        attendance: { type: Boolean, default: true },
        academics: { type: Boolean, default: true },
        announcements: { type: Boolean, default: true },
        billingReminders: { type: Boolean, default: true },
        manualMessages: { type: Boolean, default: true },
        lessonNoteReview: { type: Boolean, default: true },
      },
      digest: {
        daily: { type: Boolean, default: false },
        weekly: { type: Boolean, default: false },
      },
      urgentOnly: { type: Boolean, default: false },
      quietHours: {
        enabled: { type: Boolean, default: false },
        startTime: { type: String, default: "21:00", match: TimeRegex },
        endTime: { type: String, default: "06:30", match: TimeRegex },
      },
      optOutCategories: [{ type: String, trim: true }],
    },
  },
  { timestamps: true },
);

emailPreferenceSchema.index(
  { userId: 1, schoolId: 1, role: 1 },
  { unique: true },
);

export const EmailPreference: Model<IEmailPreference> =
  (models.EmailPreference as Model<IEmailPreference>) ||
  model<IEmailPreference>("EmailPreference", emailPreferenceSchema);
