import mongoose from "mongoose";
import type { ISchoolSettings } from "@/models/SchoolSettings";
import { SchoolSettings } from "@/models/SchoolSettings";
import {
  getResolvedScheduleSettings,
  type ScheduleSettingsInput,
} from "@/lib/timetable/scheduleSettings";

function toScheduleInput(doc: ISchoolSettings): ScheduleSettingsInput {
  return {
    schoolStartTime: doc.schoolStartTime,
    schoolEndTime: doc.schoolEndTime,
    periodDuration: doc.periodDuration,
    periodsPerDay: doc.periodsPerDay,
    periodSlots: doc.periodSlots,
    breaks: doc.breaks || [],
    assembly: doc.assembly
      ? {
          days: doc.assembly.days,
          startTime: doc.assembly.startTime,
          duration: doc.assembly.duration,
        }
      : undefined,
    assemblyDailyOverrides: doc.assemblyDailyOverrides || [],
    assemblyGradeOverrides: doc.assemblyGradeOverrides || [],
    dailyScheduleOverrides: doc.dailyScheduleOverrides,
    gradeScheduleOverrides: doc.gradeScheduleOverrides,
    breakDailyOverrides: doc.breakDailyOverrides || [],
    breakGradeOverrides: doc.breakGradeOverrides || [],
  };
}

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
  const input = toScheduleInput(doc);
  return getResolvedScheduleSettings(input, String(gradeId), dayOfWeek);
}
