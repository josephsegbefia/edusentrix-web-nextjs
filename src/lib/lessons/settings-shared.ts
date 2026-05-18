/** Client-safe lessons module settings (types, defaults, pure guards). */

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
  requireApprovedLessonNoteToPublish: true,
  allowTeacherPublishWithoutReview: false,
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

export function assertLessonsFeatureEnabled(
  settings: LessonsModuleSettings,
  feature: keyof LessonsModuleSettings,
  label: string,
) {
  if (!settings.enabled || !settings[feature]) {
    return { ok: false as const, status: 403, error: `${label} is disabled` };
  }
  return { ok: true as const };
}
