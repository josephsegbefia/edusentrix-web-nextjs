export const TEACHING_SLIDE_TYPES = [
  "title",
  "content_block",
  "activity",
  "check",
  "discussion",
  "exit_ticket",
  "resource",
  "timer",
  "plan_notes",
] as const;

export type TeachingSlideType = (typeof TEACHING_SLIDE_TYPES)[number];

export type TeachingSlide = {
  id: string;
  type: TeachingSlideType;
  title: string;
  bodyHtml?: string | null;
  speakerNotes?: string | null;
  contentBlockId?: string | null;
  estimatedMinutes?: number | null;
  resourceUrl?: string | null;
  timerMinutes?: number | null;
};

export type TeachingDeck = {
  slides: TeachingSlide[];
  builtAt: string;
  sourceContentVersion: number;
};

export type SessionTeachContextResponse = {
  success: boolean;
  error?: string;
  data?: {
    session: {
      id: string;
      title: string;
      scheduledDate: string;
      startTime: string;
      endTime: string;
      durationMinutes: number;
      planNotes: string | null;
    };
    deck: TeachingDeck;
    delivery: {
      id: string;
      status: string;
      startedAt: string | null;
      endedAt: string | null;
      completedAt: string | null;
      attendanceBeforeId: string | null;
      attendanceAfterId: string | null;
    };
    enableTeachingMode: boolean;
  };
};
