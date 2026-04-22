import type { ISchoolSettings } from "@/models/SchoolSettings";
import type { ScheduleSettingsInput } from "@/lib/timetable/scheduleSettings";

/**
 * V2 per-day model only. Used by load-resolved-schedule, conflict recompute, and hubs.
 * Legacy bell fields on the document are ignored for resolution.
 */
export function schoolSettingsToScheduleInput(
  doc: ISchoolSettings | null | undefined
): ScheduleSettingsInput {
  if (!doc) {
    return { scheduleModelVersion: 2, daySchedules: [] };
  }
  return {
    scheduleModelVersion: doc.scheduleModelVersion ?? 2,
    workingDays: doc.workingDays,
    daySchedules: doc.daySchedules,
    gradeDayScheduleProfiles: doc.gradeDayScheduleProfiles,
  };
}
