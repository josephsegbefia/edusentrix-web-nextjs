export const LESSON_CONTENT_BLOCK_TYPES = [
  "explanation",
  "example",
  "activity",
  "discussion",
  "check",
  "resource_embed",
  "exit_ticket",
  "teacher_note",
  "did_you_know",
] as const;

export type LessonContentBlockType = (typeof LESSON_CONTENT_BLOCK_TYPES)[number];

export const LESSON_CONTENT_BLOCK_LABELS: Record<LessonContentBlockType, string> = {
  explanation: "Explanation",
  example: "Example",
  activity: "Activity",
  discussion: "Discussion",
  check: "Quick check",
  resource_embed: "Resource",
  exit_ticket: "Exit ticket",
  teacher_note: "Teacher note",
  did_you_know: "Did you know",
};

export type LessonContentBlock = {
  id: string;
  type: LessonContentBlockType;
  title?: string | null;
  bodyHtml: string;
  order: number;
  estimatedMinutes?: number | null;
  aiGenerated: boolean;
  teacherReviewed: boolean;
  resourceUrl?: string | null;
};

export type LessonSessionAiMetadata = {
  leoGeneratedAt?: string | null;
  teacherReviewedAllAi?: boolean;
};

export type StudentNotebookNotesDto = {
  contentHtml: string;
  publishedAt: string;
  aiGenerated: boolean;
};

/** Stable student/mobile payload for published sessions */
export type StudentLessonSessionContentDto = {
  sessionId: string;
  title: string;
  contentVersion: number;
  scheduledDate: string;
  blocks: Array<{
    id: string;
    type: LessonContentBlockType;
    title: string | null;
    bodyHtml: string;
    order: number;
    estimatedMinutes: number | null;
  }>;
  notebookNotes?: StudentNotebookNotesDto | null;
};

export type WeekSplitSessionProposal = {
  timetableSlotId: string;
  timetableSlotIds?: string[];
  scheduledDate?: string;
  sequenceInWeek: number;
  title: string;
  noteSectionKeys: string[];
  schemeItemIds: string[];
  coverageWeight: number;
  focusSummary?: string;
};

export type ProposeWeekSplitResponse = {
  success: boolean;
  isDraft?: boolean;
  disclaimer?: string;
  error?: string;
  data?: {
    sessions: WeekSplitSessionProposal[];
  };
};

export type GenerateSessionContentResponse = {
  success: boolean;
  isDraft?: boolean;
  disclaimer?: string;
  error?: string;
  data?: {
    contentBlocks: LessonContentBlock[];
  };
};
