import mongoose from "mongoose";
import type { ISchoolSettings } from "@/models/SchoolSettings";
import { SchoolSettings } from "@/models/SchoolSettings";
import { getResolvedScheduleSettings } from "@/lib/timetable/scheduleSettings";
import { schoolSettingsToScheduleInput } from "@/lib/timetable/schoolSettingsScheduleInput";
import { buildResolvedFromSchoolDailyConfig } from "@/lib/timetable/dailyScheduleTimetable";
import { pickRawDailyConfigForClassGroup } from "@/lib/school-day/resolveDailyScheduleDoc";
import { loadLatestStoredDailyScheduleDoc } from "@/lib/school-day/loadDailyScheduleDoc";

/**
 * Resolved period bands for a class's grade on a given weekday (school + breaks + overrides).
 */
export async function loadResolvedScheduleForSchoolDay(
  schoolId: mongoose.Types.ObjectId,
  gradeId: mongoose.Types.ObjectId,
  dayOfWeek: number,
  classGroupId?: mongoose.Types.ObjectId | null
) {
  const dailyDoc = await loadLatestStoredDailyScheduleDoc(schoolId);
  const rawConfig = pickRawDailyConfigForClassGroup(
    dailyDoc,
    classGroupId ? String(classGroupId) : null,
    String(gradeId)
  );
  if (rawConfig) {
    const fromDaily = buildResolvedFromSchoolDailyConfig(
      rawConfig,
      String(gradeId),
      dayOfWeek
    );
    if (fromDaily?.isConfigured) return fromDaily;
  }
  if (dailyDoc?.scheduleMode === "grouped") {
    return null;
  }

  const doc = (await SchoolSettings.findOne({ schoolId })
    .lean()) as ISchoolSettings | null;
  if (!doc) return null;
  const input = schoolSettingsToScheduleInput(doc);
  const resolved = getResolvedScheduleSettings(input, String(gradeId), dayOfWeek);
  return resolved.isConfigured ? resolved : null;
}
