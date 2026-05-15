import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { TeacherSettings, type ITeacherSettings } from "@/models/TeacherSettings";
import { User } from "@/models/User";
import { SchoolSettings } from "@/models/SchoolSettings";
import { CommunicationPreference } from "@/models/CommunicationPreference";
import {
  getWhatsAppProviderState,
  type WhatsAppProviderMode,
} from "@/lib/notifications/whatsapp";

const TimeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
const E164LikePhoneRegex = /^\+?[1-9]\d{7,14}$/;

const NOTIFICATION_TYPE_GROUPS = {
  messages: ["direct_message"],
  notices: ["notice", "announcement", "event_notice", "newsletter"],
  submissions: ["lesson_update", "academic_update"],
  escalations: ["emergency_alert", "system_alert"],
  reminders: ["fee_reminder", "attendance_alert", "exam_notice", "video_meeting_invite"],
} as const;

const TeacherSettingsPatchSchema = z.object({
  locale: z.string().min(2).max(15).optional(),
  timezone: z.string().min(2).max(64).optional(),
  notifications: z
    .object({
      inApp: z
        .object({
          messages: z.boolean().optional(),
          notices: z.boolean().optional(),
          submissions: z.boolean().optional(),
          escalations: z.boolean().optional(),
          reminders: z.boolean().optional(),
        })
        .optional(),
      email: z
        .object({
          weeklyDigest: z.boolean().optional(),
          urgentOnly: z.boolean().optional(),
        })
        .optional(),
    })
    .optional(),
  whatsapp: z
    .object({
      phoneNumber: z.string().max(32).nullable().optional(),
      linked: z.boolean().optional(),
      consentGiven: z.boolean().optional(),
      featureFlags: z
        .object({
          attendanceAlerts: z.boolean().optional(),
          noticeBroadcasts: z.boolean().optional(),
          assignmentReminders: z.boolean().optional(),
          submissionUpdates: z.boolean().optional(),
          escalationAlerts: z.boolean().optional(),
          weeklyDigest: z.boolean().optional(),
        })
        .optional(),
      quietHours: z
        .object({
          enabled: z.boolean().optional(),
          startTime: z.string().regex(TimeRegex).optional(),
          endTime: z.string().regex(TimeRegex).optional(),
        })
        .optional(),
    })
    .optional(),
});

type TeacherSettingsDefaults = {
  locale: string;
  timezone: string;
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
    phoneNumber: string | null;
    linked: boolean;
    verified: boolean;
    linkedAt: Date | null;
    verifiedAt: Date | null;
    consentGiven: boolean;
    consentAt: Date | null;
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
    lastTestMessageAt: Date | null;
  };
};

function normalizePhone(input?: string | null) {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  return trimmed.replace(/[\s()-]/g, "");
}

function defaultSettings(phone?: string | null): TeacherSettingsDefaults {
  const normalizedPhone = normalizePhone(phone);
  const linked = Boolean(normalizedPhone);

  return {
    locale: "en-GH",
    timezone: "Africa/Accra",
    notifications: {
      inApp: {
        messages: true,
        notices: true,
        submissions: true,
        escalations: true,
        reminders: true,
      },
      email: {
        weeklyDigest: false,
        urgentOnly: true,
      },
    },
    whatsapp: {
      phoneNumber: normalizedPhone,
      linked,
      verified: false,
      linkedAt: null,
      verifiedAt: null,
      consentGiven: false,
      consentAt: null,
      featureFlags: {
        attendanceAlerts: true,
        noticeBroadcasts: true,
        assignmentReminders: true,
        submissionUpdates: true,
        escalationAlerts: true,
        weeklyDigest: false,
      },
      quietHours: {
        enabled: false,
        startTime: "21:00",
        endTime: "06:30",
      },
      lastTestMessageAt: null,
    },
  };
}

function serializeSettings(input: {
  settings: Partial<ITeacherSettings> | null;
  fallbackPhone?: string | null;
  schoolWhatsAppEnabled: boolean;
  provider: {
    mode: WhatsAppProviderMode;
    canSend: boolean;
    message: string;
  };
  account: {
    displayName: string;
    email: string;
    photoUrl?: string;
    homeroomClassName?: string;
  };
}) {
  const defaults = defaultSettings(input.fallbackPhone);
  const settings = input.settings;

  const notifications = {
    inApp: {
      ...defaults.notifications.inApp,
      ...(settings?.notifications?.inApp || {}),
    },
    email: {
      ...defaults.notifications.email,
      ...(settings?.notifications?.email || {}),
    },
  };

  const whatsapp = {
    ...defaults.whatsapp,
    ...(settings?.whatsapp || {}),
    featureFlags: {
      ...defaults.whatsapp.featureFlags,
      ...(settings?.whatsapp?.featureFlags || {}),
    },
    quietHours: {
      ...defaults.whatsapp.quietHours,
      ...(settings?.whatsapp?.quietHours || {}),
    },
  };

  const runtimeBlockers: string[] = [];
  if (!input.schoolWhatsAppEnabled) runtimeBlockers.push("school_channel_disabled");
  if (!whatsapp.linked) runtimeBlockers.push("not_linked");
  if (!whatsapp.phoneNumber) runtimeBlockers.push("no_phone");
  if (!whatsapp.consentGiven) runtimeBlockers.push("consent_not_given");
  if (!input.provider.canSend) runtimeBlockers.push("provider_not_ready");

  return {
    id: settings?._id ? String(settings._id) : null,
    locale: settings?.locale || defaults.locale,
    timezone: settings?.timezone || defaults.timezone,
    notifications,
    whatsapp: {
      phoneNumber: whatsapp.phoneNumber || null,
      linked: Boolean(whatsapp.linked),
      verified: Boolean(whatsapp.verified),
      linkedAt: whatsapp.linkedAt ? new Date(whatsapp.linkedAt).toISOString() : null,
      verifiedAt: whatsapp.verifiedAt ? new Date(whatsapp.verifiedAt).toISOString() : null,
      consentGiven: Boolean(whatsapp.consentGiven),
      consentAt: whatsapp.consentAt ? new Date(whatsapp.consentAt).toISOString() : null,
      featureFlags: whatsapp.featureFlags,
      quietHours: whatsapp.quietHours,
      lastTestMessageAt: whatsapp.lastTestMessageAt
        ? new Date(whatsapp.lastTestMessageAt).toISOString()
        : null,
      runtime: {
        backendEnforced: true,
        canSend: runtimeBlockers.length === 0,
        blockers: runtimeBlockers,
      },
    },
    capabilities: {
      schoolWhatsAppEnabled: input.schoolWhatsAppEnabled,
      whatsappProviderMode: input.provider.mode,
      whatsappProviderReady: input.provider.canSend,
      whatsappProviderMessage: input.provider.message,
    },
    account: input.account,
    updatedAt: settings?.updatedAt ? new Date(settings.updatedAt).toISOString() : null,
  };
}

function disableWhatsAppFeatureFlags(settingsDoc: ITeacherSettings) {
  settingsDoc.whatsapp.featureFlags.attendanceAlerts = false;
  settingsDoc.whatsapp.featureFlags.noticeBroadcasts = false;
  settingsDoc.whatsapp.featureFlags.assignmentReminders = false;
  settingsDoc.whatsapp.featureFlags.submissionUpdates = false;
  settingsDoc.whatsapp.featureFlags.escalationAlerts = false;
  settingsDoc.whatsapp.featureFlags.weeklyDigest = false;
}

async function syncTeacherCommunicationPreference(settingsDoc: ITeacherSettings) {
  const inAppSettings = settingsDoc.notifications?.inApp;
  const mutedTypes = Object.entries(NOTIFICATION_TYPE_GROUPS).flatMap(([key, types]) => {
    const enabled = inAppSettings?.[key as keyof typeof inAppSettings] ?? true;
    return enabled ? [] : [...types];
  });
  const anyInAppEnabled = Object.keys(NOTIFICATION_TYPE_GROUPS).some(
    (key) => inAppSettings?.[key as keyof typeof inAppSettings] ?? true,
  );

  await CommunicationPreference.findOneAndUpdate(
    { schoolId: settingsDoc.schoolId, userId: settingsDoc.userId },
    {
      $set: {
        allowedChannels: anyInAppEnabled ? ["in_app", "email"] : ["email"],
        mutedTypes,
        whatsappConsent: false,
        smsConsent: false,
        quietHours: {
          enabled: false,
          start: null,
          end: null,
        },
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

export async function GET() {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    const providerState = getWhatsAppProviderState();

    const [userRaw, teacherSettingsRaw, schoolSettingsRaw] = await Promise.all([
      User.findById(context.userId)
        .select("firstName lastName email phone avatarUrl")
        .lean(),
      TeacherSettings.findOne({
        schoolId: context.schoolId,
        teacherId: context.teacherId,
      }).lean(),
      SchoolSettings.findOne({ schoolId: context.schoolId })
        .select("attendanceNotifications")
        .lean(),
    ]);

    const user = Array.isArray(userRaw) ? userRaw[0] : userRaw;
    const teacherSettings = Array.isArray(teacherSettingsRaw)
      ? teacherSettingsRaw[0]
      : teacherSettingsRaw;
    const schoolSettings = Array.isArray(schoolSettingsRaw)
      ? schoolSettingsRaw[0]
      : schoolSettingsRaw;

    const schoolAttendanceNotifications =
      (schoolSettings as
        | {
            attendanceNotifications?: {
              enabled?: boolean;
              channels?: { whatsapp?: boolean };
            };
          }
        | null
        | undefined)?.attendanceNotifications;

    const schoolWhatsAppEnabled =
      (schoolAttendanceNotifications?.enabled ?? true) &&
      (schoolAttendanceNotifications?.channels?.whatsapp ?? true);

    const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();

    return Response.json({
      success: true,
      data: serializeSettings({
        settings: (teacherSettings as Partial<ITeacherSettings> | null) || null,
        fallbackPhone: user?.phone || null,
        schoolWhatsAppEnabled,
        provider: {
          mode: providerState.mode,
          canSend: providerState.canSend,
          message: providerState.message,
        },
        account: {
          displayName: displayName || user?.email || "Teacher",
          email: user?.email || "",
          photoUrl: user?.avatarUrl || undefined,
        },
      }),
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to load teacher settings:", e);
    const message = e instanceof Error ? e.message : "Failed to load settings";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    const providerState = getWhatsAppProviderState();

    const body = await req.json().catch(() => null);
    const parsed = TeacherSettingsPatchSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const [userRaw, teacherSettingsDocRaw] = await Promise.all([
      User.findById(context.userId).select("firstName lastName email phone avatarUrl"),
      TeacherSettings.findOne({
        schoolId: context.schoolId,
        teacherId: context.teacherId,
      }),
    ]);

    const user = Array.isArray(userRaw) ? userRaw[0] : userRaw;
    if (!user) {
      return Response.json({ success: false, error: "User not found" }, { status: 404 });
    }

    let teacherSettingsDoc = Array.isArray(teacherSettingsDocRaw)
      ? teacherSettingsDocRaw[0]
      : teacherSettingsDocRaw;

    if (!teacherSettingsDoc) {
      const defaults = defaultSettings(user.phone || null);
      teacherSettingsDoc = new TeacherSettings({
        schoolId: context.schoolId,
        teacherId: context.teacherId,
        userId: context.userId,
        ...defaults,
      });
    }

    const next = parsed.data;

    if (typeof next.locale !== "undefined") {
      teacherSettingsDoc.locale = next.locale;
    }
    if (typeof next.timezone !== "undefined") {
      teacherSettingsDoc.timezone = next.timezone;
    }

    if (next.notifications?.inApp) {
      const inApp = next.notifications.inApp;
      if (typeof inApp.messages !== "undefined") {
        teacherSettingsDoc.notifications.inApp.messages = inApp.messages;
      }
      if (typeof inApp.notices !== "undefined") {
        teacherSettingsDoc.notifications.inApp.notices = inApp.notices;
      }
      if (typeof inApp.submissions !== "undefined") {
        teacherSettingsDoc.notifications.inApp.submissions = inApp.submissions;
      }
      if (typeof inApp.escalations !== "undefined") {
        teacherSettingsDoc.notifications.inApp.escalations = inApp.escalations;
      }
      if (typeof inApp.reminders !== "undefined") {
        teacherSettingsDoc.notifications.inApp.reminders = inApp.reminders;
      }
    }

    if (next.notifications?.email) {
      const email = next.notifications.email;
      if (typeof email.weeklyDigest !== "undefined") {
        teacherSettingsDoc.notifications.email.weeklyDigest = email.weeklyDigest;
      }
      if (typeof email.urgentOnly !== "undefined") {
        teacherSettingsDoc.notifications.email.urgentOnly = email.urgentOnly;
      }
    }

    if (next.whatsapp) {
      const whatsapp = next.whatsapp;

      if (typeof whatsapp.phoneNumber !== "undefined") {
        const normalizedPhone = normalizePhone(whatsapp.phoneNumber);
        if (normalizedPhone && !E164LikePhoneRegex.test(normalizedPhone)) {
          return Response.json(
            {
              success: false,
              error:
                "Invalid WhatsApp number. Use international format, e.g. +233501234567",
            },
            { status: 400 }
          );
        }

        teacherSettingsDoc.whatsapp.phoneNumber = normalizedPhone;

        if (normalizedPhone) {
          teacherSettingsDoc.whatsapp.linked = true;
          teacherSettingsDoc.whatsapp.linkedAt =
            teacherSettingsDoc.whatsapp.linkedAt || new Date();
          if (user.phone !== normalizedPhone) {
            user.phone = normalizedPhone;
            await user.save();
          }
        }
      }

      if (typeof whatsapp.linked !== "undefined") {
        teacherSettingsDoc.whatsapp.linked = whatsapp.linked;

        if (whatsapp.linked) {
          if (!teacherSettingsDoc.whatsapp.phoneNumber) {
            return Response.json(
              {
                success: false,
                error: "Enter a WhatsApp number before linking.",
              },
              { status: 400 }
            );
          }
          teacherSettingsDoc.whatsapp.linkedAt =
            teacherSettingsDoc.whatsapp.linkedAt || new Date();
        } else {
          teacherSettingsDoc.whatsapp.consentGiven = false;
          teacherSettingsDoc.whatsapp.consentAt = null;
          teacherSettingsDoc.whatsapp.verified = false;
          teacherSettingsDoc.whatsapp.verifiedAt = null;
          disableWhatsAppFeatureFlags(teacherSettingsDoc);
        }
      }

      if (typeof whatsapp.consentGiven !== "undefined") {
        if (whatsapp.consentGiven && !teacherSettingsDoc.whatsapp.linked) {
          return Response.json(
            {
              success: false,
              error: "Link your WhatsApp number before enabling power tools.",
            },
            { status: 400 }
          );
        }

        teacherSettingsDoc.whatsapp.consentGiven = whatsapp.consentGiven;
        teacherSettingsDoc.whatsapp.consentAt = whatsapp.consentGiven
          ? teacherSettingsDoc.whatsapp.consentAt || new Date()
          : null;
      }

      if (whatsapp.featureFlags) {
        const flags = whatsapp.featureFlags;
        if (typeof flags.attendanceAlerts !== "undefined") {
          teacherSettingsDoc.whatsapp.featureFlags.attendanceAlerts =
            flags.attendanceAlerts;
        }
        if (typeof flags.noticeBroadcasts !== "undefined") {
          teacherSettingsDoc.whatsapp.featureFlags.noticeBroadcasts =
            flags.noticeBroadcasts;
        }
        if (typeof flags.assignmentReminders !== "undefined") {
          teacherSettingsDoc.whatsapp.featureFlags.assignmentReminders =
            flags.assignmentReminders;
        }
        if (typeof flags.submissionUpdates !== "undefined") {
          teacherSettingsDoc.whatsapp.featureFlags.submissionUpdates =
            flags.submissionUpdates;
        }
        if (typeof flags.escalationAlerts !== "undefined") {
          teacherSettingsDoc.whatsapp.featureFlags.escalationAlerts =
            flags.escalationAlerts;
        }
        if (typeof flags.weeklyDigest !== "undefined") {
          teacherSettingsDoc.whatsapp.featureFlags.weeklyDigest = flags.weeklyDigest;
        }
      }

      if (whatsapp.quietHours) {
        if (typeof whatsapp.quietHours.enabled !== "undefined") {
          teacherSettingsDoc.whatsapp.quietHours.enabled = whatsapp.quietHours.enabled;
        }
        if (typeof whatsapp.quietHours.startTime !== "undefined") {
          teacherSettingsDoc.whatsapp.quietHours.startTime =
            whatsapp.quietHours.startTime;
        }
        if (typeof whatsapp.quietHours.endTime !== "undefined") {
          teacherSettingsDoc.whatsapp.quietHours.endTime = whatsapp.quietHours.endTime;
        }
      }
    }

    if (!teacherSettingsDoc.whatsapp.consentGiven) {
      disableWhatsAppFeatureFlags(teacherSettingsDoc);
    }

    await teacherSettingsDoc.save();
    await syncTeacherCommunicationPreference(teacherSettingsDoc);

    const schoolSettingsRaw = await SchoolSettings.findOne({ schoolId: context.schoolId })
      .select("attendanceNotifications")
      .lean();

    const schoolSettings = Array.isArray(schoolSettingsRaw)
      ? schoolSettingsRaw[0]
      : schoolSettingsRaw;

    const schoolAttendanceNotifications =
      (schoolSettings as
        | {
            attendanceNotifications?: {
              enabled?: boolean;
              channels?: { whatsapp?: boolean };
            };
          }
        | null
        | undefined)?.attendanceNotifications;

    const schoolWhatsAppEnabled =
      (schoolAttendanceNotifications?.enabled ?? true) &&
      (schoolAttendanceNotifications?.channels?.whatsapp ?? true);

    const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();

    return Response.json({
      success: true,
      data: serializeSettings({
        settings: teacherSettingsDoc.toObject() as Partial<ITeacherSettings>,
        fallbackPhone: user.phone || null,
        schoolWhatsAppEnabled,
        provider: {
          mode: providerState.mode,
          canSend: providerState.canSend,
          message: providerState.message,
        },
        account: {
          displayName: displayName || user.email || "Teacher",
          email: user.email || "",
          photoUrl: user.avatarUrl || undefined,
        },
      }),
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to update teacher settings:", e);
    const message = e instanceof Error ? e.message : "Failed to update settings";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
