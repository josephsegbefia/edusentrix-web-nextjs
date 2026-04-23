import mongoose from "mongoose";
import type { ISchoolSettings } from "@/models/SchoolSettings";
import { SchoolSettings } from "@/models/SchoolSettings";
import { SchoolDailySchedule, type ISchoolDailySchedule } from "@/models/SchoolDailySchedule";
import { getResolvedScheduleSettings } from "@/lib/timetable/scheduleSettings";
import { schoolSettingsToScheduleInput } from "@/lib/timetable/schoolSettingsScheduleInput";
import { buildResolvedFromSchoolDailyConfig } from "@/lib/timetable/dailyScheduleTimetable";

/**
 * Resolved period bands for a class's grade on a given weekday (school + breaks + overrides).
 */
export async function loadResolvedScheduleForSchoolDay(
  schoolId: mongoose.Types.ObjectId,
  gradeId: mongoose.Types.ObjectId,
  dayOfWeek: number
) {
  const dailyDoc = await SchoolDailySchedule.findOne({ schoolId })
    .select("config")
    .lean<Pick<ISchoolDailySchedule, "config"> | null>();
  if (dailyDoc?.config) {
    const fromDaily = buildResolvedFromSchoolDailyConfig(
      dailyDoc.config,
      String(gradeId),
      dayOfWeek
    );
    if (fromDaily?.isConfigured) return fromDaily;
  }

  const doc = (await SchoolSettings.findOne({ schoolId })
    .lean()) as ISchoolSettings | null;
  if (!doc) return null;
  const input = schoolSettingsToScheduleInput(doc);
  const resolved = getResolvedScheduleSettings(input, String(gradeId), dayOfWeek);
  return resolved.isConfigured ? resolved : null;
}
