import "server-only";

import { TeacherSettings } from "@/models/TeacherSettings";
import { EmailPreference } from "@/models/EmailPreference";
import { checkHardSuppression } from "./suppressions";
import {
  mapTeacherSettingsToPreference,
  buildPlatformDefaultPreference,
  type ResolvedEmailPreference,
} from "./adapters/teacher-settings";

/**
 * Resolve the email preference for a user, role, and school.
 *
 * Resolution order (per spec §9.19):
 * 1. Hard suppression check
 * 2. Role-native source (teachers → TeacherSettings, others → EmailPreference)
 * 3. School defaults
 * 4. Platform defaults
 * 5. Message-class overrides for transactional traffic
 */
export async function resolveEmailPreference(
  userId: string,
  role: string,
  schoolId: string | null,
  email?: string,
): Promise<{
  preference: ResolvedEmailPreference;
  suppressed: boolean;
  suppressionReason?: string;
}> {
  if (email) {
    const suppression = await checkHardSuppression(email, schoolId);
    if (suppression) {
      return {
        preference: buildPlatformDefaultPreference(role),
        suppressed: true,
        suppressionReason: suppression.reason,
      };
    }
  }

  if (role === "teacher" && schoolId) {
    const teacherSettings = await TeacherSettings.findOne({
      userId,
      schoolId,
    }).lean();

    if (teacherSettings) {
      return {
        preference: mapTeacherSettingsToPreference(teacherSettings),
        suppressed: false,
      };
    }
  }

  if (role !== "teacher") {
    const emailPref = await EmailPreference.findOne({
      userId,
      ...(schoolId ? { schoolId } : {}),
      role,
    }).lean();

    if (emailPref) {
      return {
        preference: {
          source: "email_preference",
          role,
          channels: {
            email: emailPref.channels?.email ?? true,
            inApp: emailPref.channels?.inApp ?? true,
            whatsapp: emailPref.channels?.whatsapp ?? false,
            sms: emailPref.channels?.sms ?? false,
          },
          categories: {
            attendance: emailPref.email?.immediate?.attendance ?? true,
            academics: emailPref.email?.immediate?.academics ?? true,
            announcements: emailPref.email?.immediate?.announcements ?? true,
            billingReminders:
              emailPref.email?.immediate?.billingReminders ?? true,
            manualMessages:
              emailPref.email?.immediate?.manualMessages ?? true,
            lessonNoteReview:
              emailPref.email?.immediate?.lessonNoteReview ?? true,
          },
          digest: {
            daily: emailPref.email?.digest?.daily ?? false,
            weekly: emailPref.email?.digest?.weekly ?? false,
          },
          urgentOnly: emailPref.email?.urgentOnly ?? false,
          quietHours: {
            enabled: emailPref.email?.quietHours?.enabled ?? false,
            startTime: emailPref.email?.quietHours?.startTime ?? "21:00",
            endTime: emailPref.email?.quietHours?.endTime ?? "06:30",
          },
          optOutCategories: emailPref.email?.optOutCategories ?? [],
        },
        suppressed: false,
      };
    }
  }

  return {
    preference: buildPlatformDefaultPreference(role),
    suppressed: false,
  };
}

/**
 * Check whether a specific message category is allowed for a user.
 * Transactional messages bypass preference checks.
 */
export function isCategoryAllowed(
  preference: ResolvedEmailPreference,
  category: string,
  isTransactional: boolean,
): boolean {
  if (isTransactional) return true;

  if (!preference.channels.email) return false;

  if (preference.optOutCategories.includes(category)) return false;

  const categoryMap = preference.categories as Record<string, boolean>;
  if (category in categoryMap) {
    return categoryMap[category] !== false;
  }

  return true;
}
