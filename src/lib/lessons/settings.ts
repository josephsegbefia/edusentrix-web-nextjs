import "server-only";

import mongoose from "mongoose";
import { SchoolSettings } from "@/models/SchoolSettings";
import {
  DEFAULT_LESSONS_MODULE_SETTINGS,
  type LessonsModuleSettings,
} from "@/lib/lessons/settings-shared";

export type { LessonsModuleSettings } from "@/lib/lessons/settings-shared";
export {
  DEFAULT_LESSONS_MODULE_SETTINGS,
  assertLessonsFeatureEnabled,
} from "@/lib/lessons/settings-shared";

type LessonsSettingsRow = {
  lessonsModule?: Partial<LessonsModuleSettings>;
};

export async function getLessonsModuleSettings(
  schoolId: mongoose.Types.ObjectId,
): Promise<LessonsModuleSettings> {
  const row = (await SchoolSettings.findOne({ schoolId })
    .select("lessonsModule")
    .lean()) as LessonsSettingsRow | null;

  return {
    ...DEFAULT_LESSONS_MODULE_SETTINGS,
    ...(row?.lessonsModule ?? {}),
  };
}

export async function assertLessonsModuleEnabled(schoolId: mongoose.Types.ObjectId) {
  const settings = await getLessonsModuleSettings(schoolId);
  if (!settings.enabled) {
    return { ok: false as const, status: 403, error: "Lessons module is disabled" };
  }
  return { ok: true as const, settings };
}
