import mongoose from "mongoose";
import type { ISchoolSettings } from "@/models/SchoolSettings";
import { SchoolSettings } from "@/models/SchoolSettings";
import { getResolvedScheduleSettings } from "@/lib/timetable/scheduleSettings";
import { schoolSettingsToScheduleInput } from "@/lib/timetable/schoolSettingsScheduleInput";

/**
 * Resolved period bands for a class's grade on a given weekday (school + breaks + overrides).
 */
export async function loadResolvedScheduleForSchoolDay(
  schoolId: mongoose.Types.ObjectId,
  gradeId: mongoose.Types.ObjectId,
  dayOfWeek: number
) {
  const doc = (await SchoolSettings.findOne({ schoolId })
    .lean()) as ISchoolSettings | null;
  if (!doc) return null;
  const input = schoolSettingsToScheduleInput(doc);
  const resolved = getResolvedScheduleSettings(input, String(gradeId), dayOfWeek);
  return resolved.isConfigured ? resolved : null;
}
