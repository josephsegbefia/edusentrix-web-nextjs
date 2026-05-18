import "server-only";

import mongoose from "mongoose";
import {
  assertLessonsFeatureEnabled,
  assertLessonsModuleEnabled,
  type LessonsModuleSettings,
} from "@/lib/lessons/settings";

export type LessonsModuleGate = {
  ok: true;
  settings: LessonsModuleSettings;
};

export type LessonsModuleGateFail = {
  ok: false;
  status: number;
  error: string;
};

export async function gateLessonsModule(
  schoolId: mongoose.Types.ObjectId | string,
): Promise<LessonsModuleGate | LessonsModuleGateFail> {
  const result = await assertLessonsModuleEnabled(
    typeof schoolId === "string" ? new mongoose.Types.ObjectId(schoolId) : schoolId,
  );
  if (!result.ok) {
    return { ok: false, status: result.status, error: result.error };
  }
  return { ok: true, settings: result.settings };
}

export function gateLessonsFeature(
  settings: LessonsModuleSettings,
  feature: keyof LessonsModuleSettings,
  label: string,
): { ok: true } | LessonsModuleGateFail {
  const result = assertLessonsFeatureEnabled(settings, feature, label);
  if (!result.ok) {
    return { ok: false, status: result.status, error: result.error };
  }
  return { ok: true };
}

export function isLessonNoteApprovedForDelivery(status: string): boolean {
  return status === "approved" || status === "published";
}
