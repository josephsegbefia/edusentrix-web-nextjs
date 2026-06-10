export type LessonWeekNotebookSessionRow = {
  id: string;
  sequenceInWeek: number;
  title: string;
  scheduledDate: string;
  startTime: string;
  endTime: string;
  hasNotebookNotes: boolean;
  notebookNotesPublished: boolean;
  notebookNotesHtml: string | null;
  deliveryStatus: string | null;
};

export type LessonWeekNotebookSummaryResponse = {
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
    sessions: LessonWeekNotebookSessionRow[];
    summary: {
      total: number;
      withNotes: number;
      sharedWithStudents: number;
      taught: number;
    };
  };
};
