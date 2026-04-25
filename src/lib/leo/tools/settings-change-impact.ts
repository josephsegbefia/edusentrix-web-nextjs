import "server-only";
import type { Types } from "mongoose";
import { SchoolSettings } from "@/models/SchoolSettings";
import { TimetableVersion } from "@/models/TimetableVersion";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import type { LeoAssistantDraft } from "@/lib/leo/types";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function dayList(days?: number[] | null) {
  if (!Array.isArray(days) || days.length === 0) return "not configured";
  return days
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    .map((day) => DAY_NAMES[day])
    .join(", ");
}

function wantsArea(message: string, needles: string[]) {
  const text = message.toLowerCase();
  return needles.some((needle) => text.includes(needle));
}

export async function runSettingsChangeImpactTool(args: {
  schoolId: Types.ObjectId;
  userMessage: string;
}): Promise<LeoAssistantDraft> {
  const [settings, currentPeriod] = await Promise.all([
    SchoolSettings.findOne({ schoolId: args.schoolId }).lean(),
    AcademicPeriod.findOne({ schoolId: args.schoolId, isCurrent: true })
      .select("_id term yearLabel")
      .lean(),
  ]);

  if (!settings) {
    return {
      contentText:
        "I could not find school settings yet. Create or save the school settings first, then I can explain likely impacts before you change them.",
      citations: [{ type: "route", label: "School settings", ref: "/admin/settings" }],
      toolsUsed: ["settings_change_impact"],
    };
  }

  const timetableVersionCounts = currentPeriod
    ? await TimetableVersion.aggregate([
        {
          $match: {
            schoolId: args.schoolId,
            academicPeriodId: currentPeriod._id,
            status: { $in: ["draft", "published"] },
          },
        },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ])
    : [];
  const draftCount =
    timetableVersionCounts.find((row) => row._id === "draft")?.count || 0;
  const publishedCount =
    timetableVersionCounts.find((row) => row._id === "published")?.count || 0;

  const lines = [
    `Settings impact snapshot${currentPeriod ? ` for ${currentPeriod.term} ${currentPeriod.yearLabel}` : ""}:`,
  ];

  const includeSchedule =
    wantsArea(args.userMessage, [
      "schedule",
      "timetable",
      "period",
      "periods",
      "break",
      "school day",
      "working days",
    ]) || args.userMessage.trim().length === 0;
  const includeAttendance =
    wantsArea(args.userMessage, ["attendance", "late", "cutoff", "promotion"]);
  const includeNotifications = wantsArea(args.userMessage, [
    "notification",
    "notifications",
    "whatsapp",
    "sms",
    "email",
    "guardian",
  ]);
  const includeFeatures = wantsArea(args.userMessage, [
    "teacher studio",
    "offline",
    "leo",
    "feature",
    "access",
    "privacy",
    "retention",
  ]);

  if (includeSchedule) {
    lines.push(
      "",
      "Timetable and school-day impact:",
      `- Working days are currently ${dayList(settings.workingDays)}.`,
      `- Default day runs ${settings.schoolStartTime || "not set"} to ${settings.schoolEndTime || "not set"} with ${settings.periodDuration || "unset"}-minute periods and ${settings.periodsPerDay || "unset"} periods per day.`,
      `- Breaks configured: ${(settings.breaks || []).length}; grade/day schedule profiles: ${(settings.gradeDayScheduleProfiles || []).length}.`,
      `- Draft timetable versions in the current period: ${draftCount}; published versions: ${publishedCount}. Changing school-day structure can make existing timetable slots look misaligned, so review draft/published timetables after saving.`
    );
  }

  if (includeAttendance) {
    lines.push(
      "",
      "Attendance impact:",
      `- Late arrival cutoff is ${settings.lateArrivalCutoff || "not set"}. Changing it affects how future arrivals are interpreted as late.`,
      `- Minimum attendance threshold is ${settings.minimumAttendancePercent ?? "not set"}%. This can affect promotion/readiness conversations and attendance risk interpretation.`,
      "- Existing attendance records are not rewritten by a settings explanation; users should review reporting expectations after a threshold change."
    );
  }

  if (includeNotifications) {
    const channels = settings.attendanceNotifications?.channels;
    const enabledChannels = [
      channels?.whatsapp ? "WhatsApp" : null,
      channels?.sms ? "SMS" : null,
      channels?.email ? "Email" : null,
    ].filter(Boolean);
    lines.push(
      "",
      "Notification impact:",
      `- Attendance notifications are ${settings.attendanceNotifications?.enabled ? "enabled" : "disabled"}.`,
      `- Enabled channels: ${enabledChannels.length ? enabledChannels.join(", ") : "none"}.`,
      "- Channel changes affect future notification delivery, but do not resend past notifications automatically."
    );
  }

  if (includeFeatures) {
    lines.push(
      "",
      "Feature and access impact:",
      `- Teacher Studio is ${settings.teacherStudio?.enabled ? "enabled" : "disabled"}.`,
      `- Offline mode is ${settings.offlineMode?.enabled ? "enabled" : "disabled"}.`,
      `- Leo access override is ${settings.leo?.accessOverride || "inherit"}; privacy mode is ${settings.leo?.privacyMode || "balanced"}; retention is ${settings.leo?.retentionDays ?? "default"} days.`,
      "- Feature toggles mainly affect what users can see or open; role and entitlement checks may still apply."
    );
  }

  if (!includeSchedule && !includeAttendance && !includeNotifications && !includeFeatures) {
    lines.push(
      "",
      "Ask about a specific setting area, for example: timetable periods, late cutoff, attendance notifications, Teacher Studio, offline mode, or Leo access."
    );
  }

  lines.push(
    "",
    "Safe next action: before saving a structural setting change, check the affected timetable, attendance, and notification surfaces in a non-destructive preview or staging workflow."
  );

  return {
    contentText: lines.join("\n"),
    citations: [
      { type: "record", label: "School settings", ref: "SchoolSettings" },
      { type: "route", label: "Admin settings", ref: "/admin/settings" },
    ],
    toolsUsed: ["settings_change_impact"],
  };
}
