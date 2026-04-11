import "server-only";

import { TeacherSettings, type ITeacherSettings } from "@/models/TeacherSettings";

/**
 * Resolved email preference: a unified read model that any send path
 * can use regardless of the backing store.
 */
export interface ResolvedEmailPreference {
  source:
    | "teacher_settings"
    | "email_preference"
    | "school_default"
    | "platform_default";
  role: string;
  channels: {
    email: boolean;
    inApp: boolean;
    whatsapp?: boolean;
    sms?: boolean;
  };
  categories: {
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
}

/**
 * Map existing TeacherSettings into the resolved email preference model.
 * This preserves all existing teacher behavior without a breaking migration.
 */
export function mapTeacherSettingsToPreference(
  settings: ITeacherSettings,
): ResolvedEmailPreference {
  return {
    source: "teacher_settings",
    role: "teacher",
    channels: {
      email: true,
      inApp: true,
      whatsapp: settings.whatsapp?.linked ?? false,
      sms: false,
    },
    categories: {
      attendance: settings.whatsapp?.featureFlags?.attendanceAlerts ?? true,
      academics: settings.whatsapp?.featureFlags?.submissionUpdates ?? true,
      announcements: settings.whatsapp?.featureFlags?.noticeBroadcasts ?? true,
      billingReminders: true,
      manualMessages: true,
      lessonNoteReview: true,
    },
    digest: {
      daily: false,
      weekly: settings.notifications?.email?.weeklyDigest ?? false,
    },
    urgentOnly: settings.notifications?.email?.urgentOnly ?? true,
    quietHours: {
      enabled: settings.whatsapp?.quietHours?.enabled ?? false,
      startTime: settings.whatsapp?.quietHours?.startTime ?? "21:00",
      endTime: settings.whatsapp?.quietHours?.endTime ?? "06:30",
    },
    optOutCategories: [],
  };
}

/**
 * Build the platform default preference for roles that have no stored preference.
 */
export function buildPlatformDefaultPreference(
  role: string,
): ResolvedEmailPreference {
  return {
    source: "platform_default",
    role,
    channels: {
      email: true,
      inApp: true,
      whatsapp: false,
      sms: false,
    },
    categories: {
      attendance: true,
      academics: true,
      announcements: true,
      billingReminders: true,
      manualMessages: true,
      lessonNoteReview: true,
    },
    digest: {
      daily: false,
      weekly: false,
    },
    urgentOnly: false,
    quietHours: {
      enabled: false,
      startTime: "21:00",
      endTime: "06:30",
    },
    optOutCategories: [],
  };
}
