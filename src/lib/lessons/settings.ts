import "server-only";

import mongoose from "mongoose";
import { SchoolSettings } from "@/models/SchoolSettings";

export type LessonsModuleSettings = {
  enabled: boolean;
  requireApprovedLessonNoteToPublish: boolean;
  allowTeacherPublishWithoutReview: boolean;
  enableStudentLessonView: boolean;
  enableFlashcards: boolean;
  enableResources: boolean;
  enableTeachingMode: boolean;
  enableLessonReflection: boolean;
  enableLessonAnalytics: boolean;
  parentSummaryVisibleToParents: boolean;
  enableLeoLessonTools: boolean;
  requireTeacherReviewForAiContent: boolean;
  notifyStudentsOnPublish: boolean;
  notifyParentsOnPublish: boolean;
};

export const DEFAULT_LESSONS_MODULE_SETTINGS: LessonsModuleSettings = {
  enabled: true,
  requireApprovedLessonNoteToPublish: false,
  allowTeacherPublishWithoutReview: true,
  enableStudentLessonView: true,
  enableFlashcards: true,
  enableResources: true,
  enableTeachingMode: true,
  enableLessonReflection: true,
  enableLessonAnalytics: true,
  parentSummaryVisibleToParents: false,
  enableLeoLessonTools: false,
  requireTeacherReviewForAiContent: true,
  notifyStudentsOnPublish: true,
  notifyParentsOnPublish: false,
};

type LessonsSettingsRow = {
  lessonsModule?: Partial<LessonsModuleSettings>;
};

export async function getLessonsModuleSettings(
  schoolId: mongoose.Types.ObjectId
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

export function assertLessonsFeatureEnabled(
  settings: LessonsModuleSettings,
  feature: keyof LessonsModuleSettings,
  label: string
) {
  if (!settings.enabled || !settings[feature]) {
    return { ok: false as const, status: 403, error: `${label} is disabled` };
  }
  return { ok: true as const };
}
