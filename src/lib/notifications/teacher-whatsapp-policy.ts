import mongoose from "mongoose";
import { TeacherSettings } from "@/models/TeacherSettings";
import { normalizeGhanaPhoneForStorage } from "@/lib/phone/ghana";

export type TeacherWhatsAppFeatureFlag =
  | "attendanceAlerts"
  | "noticeBroadcasts"
  | "assignmentReminders"
  | "submissionUpdates"
  | "escalationAlerts"
  | "weeklyDigest";

export type TeacherWhatsAppPolicyReason =
  | "missing_settings"
  | "school_channel_disabled"
  | "not_linked"
  | "consent_not_given"
  | "no_phone"
  | "feature_disabled"
  | "quiet_hours";

export type TeacherWhatsAppPolicyResult =
  | {
      allowed: true;
      phoneNumber: string;
    }
  | {
      allowed: false;
      reason: TeacherWhatsAppPolicyReason;
      message: string;
    };

export type EvaluateTeacherWhatsAppPolicyInput = {
  schoolId: mongoose.Types.ObjectId | string;
  teacherId: mongoose.Types.ObjectId | string;
  feature: TeacherWhatsAppFeatureFlag;
  at?: Date;
  schoolChannelEnabled?: boolean;
  requireFeatureFlag?: boolean;
  honorQuietHours?: boolean;
};

type TeacherSettingsPolicyProjection = {
  timezone?: string;
  whatsapp?: {
    phoneNumber?: string | null;
    linked?: boolean;
    consentGiven?: boolean;
    featureFlags?: Partial<Record<TeacherWhatsAppFeatureFlag, boolean>>;
    quietHours?: {
      enabled?: boolean;
      startTime?: string;
      endTime?: string;
    };
  };
};

function toObjectIdOrNull(
  value: mongoose.Types.ObjectId | string
): mongoose.Types.ObjectId | null {
  try {
    return new mongoose.Types.ObjectId(String(value));
  } catch {
    return null;
  }
}

export function normalizePhone(input?: string | null): string | null {
  const normalized = normalizeGhanaPhoneForStorage(input);
  return normalized || null;
}

function parseTimeToMinutes(value?: string): number | null {
  if (!value) return null;
  const match = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function currentMinutesInTimezone(now: Date, timezone?: string): number {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone || "UTC",
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(now);

    const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
    const minute = Number(
      parts.find((part) => part.type === "minute")?.value ?? "0"
    );
    return hour * 60 + minute;
  } catch {
    return now.getHours() * 60 + now.getMinutes();
  }
}

function isWithinQuietHours(input: {
  startTime?: string;
  endTime?: string;
  timezone?: string;
  at: Date;
}) {
  const startMinutes = parseTimeToMinutes(input.startTime);
  const endMinutes = parseTimeToMinutes(input.endTime);
  if (startMinutes === null || endMinutes === null) return false;

  const nowMinutes = currentMinutesInTimezone(input.at, input.timezone);

  if (startMinutes === endMinutes) return true;
  if (startMinutes < endMinutes) {
    return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  }
  return nowMinutes >= startMinutes || nowMinutes < endMinutes;
}

export async function evaluateTeacherWhatsAppPolicy(
  input: EvaluateTeacherWhatsAppPolicyInput
): Promise<TeacherWhatsAppPolicyResult> {
  const schoolId = toObjectIdOrNull(input.schoolId);
  const teacherId = toObjectIdOrNull(input.teacherId);

  if (!schoolId || !teacherId) {
    return {
      allowed: false,
      reason: "missing_settings",
      message: "Unable to resolve teacher settings for WhatsApp delivery.",
    };
  }

  if (input.schoolChannelEnabled === false) {
    return {
      allowed: false,
      reason: "school_channel_disabled",
      message: "School-level WhatsApp channel is disabled for this notification.",
    };
  }

  const settingsRaw = await TeacherSettings.findOne({ schoolId, teacherId })
    .select("timezone whatsapp")
    .lean();

  const settings = (Array.isArray(settingsRaw)
    ? settingsRaw[0]
    : settingsRaw) as TeacherSettingsPolicyProjection | null;

  if (!settings) {
    return {
      allowed: false,
      reason: "missing_settings",
      message: "Teacher WhatsApp settings are not configured yet.",
    };
  }

  const whatsapp = settings.whatsapp;
  if (!whatsapp?.linked) {
    return {
      allowed: false,
      reason: "not_linked",
      message: "WhatsApp is not linked for this teacher.",
    };
  }

  if (!whatsapp.consentGiven) {
    return {
      allowed: false,
      reason: "consent_not_given",
      message: "Teacher consent is required before WhatsApp notifications can be sent.",
    };
  }

  const phoneNumber = normalizePhone(whatsapp.phoneNumber);
  if (!phoneNumber) {
    return {
      allowed: false,
      reason: "no_phone",
      message: "No WhatsApp phone number is linked.",
    };
  }

  if (input.requireFeatureFlag !== false) {
    const enabled = Boolean(whatsapp.featureFlags?.[input.feature]);
    if (!enabled) {
      return {
        allowed: false,
        reason: "feature_disabled",
        message: "This WhatsApp feature is disabled in teacher settings.",
      };
    }
  }

  if (input.honorQuietHours !== false && whatsapp.quietHours?.enabled) {
    const inQuietHours = isWithinQuietHours({
      startTime: whatsapp.quietHours.startTime,
      endTime: whatsapp.quietHours.endTime,
      timezone: settings.timezone,
      at: input.at || new Date(),
    });
    if (inQuietHours) {
      return {
        allowed: false,
        reason: "quiet_hours",
        message: "WhatsApp delivery is paused because quiet hours are active.",
      };
    }
  }

  return {
    allowed: true,
    phoneNumber,
  };
}
