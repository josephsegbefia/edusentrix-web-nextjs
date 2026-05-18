"use client";

import { TeacherLessonResourcesPanel } from "@/components/lessons/TeacherLessonResourcesPanel";

type Props = {
  sessionId: string;
  canWrite: boolean;
  studentPublished: boolean;
};

/** Session-scoped resources via dedicated APIs (reuses legacy panel UI). */
export function TeacherSessionResourcesPanel({
  sessionId,
  canWrite,
  studentPublished,
}: Props) {
  return (
    <TeacherLessonResourcesPanel
      lessonId={sessionId}
      canWrite={canWrite}
      lessonStatus={studentPublished ? "published" : "draft"}
      resourceScope="session"
    />
  );
}
