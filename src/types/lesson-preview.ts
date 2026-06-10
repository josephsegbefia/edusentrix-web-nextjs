import type { LessonContentBlock } from "@/types/lesson-content-blocks";

export type LessonPreviewSession = {
  id: string;
  sequenceInWeek: number;
  title: string;
  scheduledDate: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  planNotes?: string | null;
  contentBlocks: LessonContentBlock[];
  contentVersion?: number;
};

export type LessonWeekPreviewResponse = {
  success: boolean;
  error?: string;
  data?: {
    weekPlan: {
      id: string;
      title: string;
      weekLabel: string;
      weekStartDate: string;
      weekEndDate: string;
      classGroupId: string;
      lessonNoteTopic: string | null;
    };
    sessions: LessonPreviewSession[];
  };
};
