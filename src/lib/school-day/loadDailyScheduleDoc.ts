import type mongoose from "mongoose";
import { SchoolDailySchedule } from "@/models/SchoolDailySchedule";

export type SchoolDailyScheduleLeanDoc = {
  config?: unknown;
  scheduleMode?: "unified" | "grouped" | string | null;
  scheduleGroups?: unknown;
};

export function hasStoredDailySchedule(doc: SchoolDailyScheduleLeanDoc | null | undefined) {
  const groups = doc?.scheduleGroups;
  return doc?.config != null || (Array.isArray(groups) && groups.length > 0);
}

export async function loadLatestStoredDailyScheduleDoc(
  schoolId: mongoose.Types.ObjectId
): Promise<SchoolDailyScheduleLeanDoc | null> {
  const docs = (await SchoolDailySchedule.find({ schoolId })
    .sort({ updatedAt: -1, createdAt: -1, _id: -1 })
    .select("config scheduleMode scheduleGroups")
    .lean()
    .exec()) as SchoolDailyScheduleLeanDoc[];

  return docs.find(hasStoredDailySchedule) ?? null;
}
