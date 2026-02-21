import { Schema, model, models, Types, type Model } from "mongoose";

export interface ITeacherSettings {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  teacherId: Types.ObjectId;
  userId: Types.ObjectId;
  locale?: string;
  timezone?: string;
  notifications: {
    inApp: {
      messages: boolean;
      notices: boolean;
      submissions: boolean;
      escalations: boolean;
      reminders: boolean;
    };
    email: {
      weeklyDigest: boolean;
      urgentOnly: boolean;
    };
  };
  whatsapp: {
    phoneNumber?: string | null;
    linked: boolean;
    verified: boolean;
    linkedAt?: Date | null;
    verifiedAt?: Date | null;
    consentGiven: boolean;
    consentAt?: Date | null;
    featureFlags: {
      attendanceAlerts: boolean;
      noticeBroadcasts: boolean;
      assignmentReminders: boolean;
      submissionUpdates: boolean;
      escalationAlerts: boolean;
      weeklyDigest: boolean;
    };
    quietHours: {
      enabled: boolean;
      startTime: string;
      endTime: string;
    };
    lastTestMessageAt?: Date | null;
  };
  createdAt: Date;
  updatedAt: Date;
}

const TimeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;

const TeacherSettingsSchema = new Schema<ITeacherSettings>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    locale: { type: String, default: "en-GH", trim: true },
    timezone: { type: String, default: "Africa/Accra", trim: true },
    notifications: {
      inApp: {
        messages: { type: Boolean, default: true },
        notices: { type: Boolean, default: true },
        submissions: { type: Boolean, default: true },
        escalations: { type: Boolean, default: true },
        reminders: { type: Boolean, default: true },
      },
      email: {
        weeklyDigest: { type: Boolean, default: false },
        urgentOnly: { type: Boolean, default: true },
      },
    },
    whatsapp: {
      phoneNumber: { type: String, default: null, trim: true },
      linked: { type: Boolean, default: false },
      verified: { type: Boolean, default: false },
      linkedAt: { type: Date, default: null },
      verifiedAt: { type: Date, default: null },
      consentGiven: { type: Boolean, default: false },
      consentAt: { type: Date, default: null },
      featureFlags: {
        attendanceAlerts: { type: Boolean, default: true },
        noticeBroadcasts: { type: Boolean, default: true },
        assignmentReminders: { type: Boolean, default: true },
        submissionUpdates: { type: Boolean, default: true },
        escalationAlerts: { type: Boolean, default: true },
        weeklyDigest: { type: Boolean, default: false },
      },
      quietHours: {
        enabled: { type: Boolean, default: false },
        startTime: { type: String, default: "21:00", match: TimeRegex },
        endTime: { type: String, default: "06:30", match: TimeRegex },
      },
      lastTestMessageAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

TeacherSettingsSchema.index({ schoolId: 1, teacherId: 1 }, { unique: true });
TeacherSettingsSchema.index({ schoolId: 1, userId: 1 }, { unique: true });

export const TeacherSettings: Model<ITeacherSettings> =
  (models.TeacherSettings as Model<ITeacherSettings>) ||
  model<ITeacherSettings>("TeacherSettings", TeacherSettingsSchema);
