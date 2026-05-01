import type { ILesson } from "@/models/Lesson";
import type { LessonTeachingModeDto } from "@/types/lessons";

export function formatTeachingModeDto(lesson: ILesson): LessonTeachingModeDto {
  const tm = lesson.teachingMode;
  if (!tm || !Array.isArray(tm.segments)) {
    return { segments: [] };
  }
  return {
    segments: tm.segments.map((s) => ({
      title: s.title,
      durationMinutes: s.durationMinutes ?? null,
      teacherPrompt: s.teacherPrompt ?? null,
      learnerActivity: s.learnerActivity ?? null,
      notes: s.notes ?? null,
    })),
  };
}
