import { useMutation } from "@tanstack/react-query";
import type {
  GenerateSessionContentResponse,
  LessonContentBlock,
  ProposeWeekSplitResponse,
  WeekSplitSessionProposal,
} from "@/types/lesson-content-blocks";

export function useProposeWeekSplit() {
  return useMutation({
    mutationFn: async (body: {
      lessonNoteId: string;
      sessions: Array<{
        timetableSlotId: string;
        timetableSlotIds?: string[];
        sequenceInWeek: number;
        title: string;
        durationMinutes: number;
        scheduledDate?: string;
        startTime?: string;
        endTime?: string;
        periodCount?: number;
        isDoublePeriod?: boolean;
      }>;
    }) => {
      const res = await fetch("/api/leo/lessons/propose-week-split", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => null)) as ProposeWeekSplitResponse | null;
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to propose week split");
      }
      return json;
    },
  });
}

export function useGenerateSessionContent() {
  return useMutation({
    mutationFn: async (body: {
      lessonNoteId: string;
      session: {
        title: string;
        durationMinutes: number;
        noteSectionKeys: string[];
        coverageWeight?: number;
        scheduledDate?: string;
        startTime?: string;
        endTime?: string;
        periodCount?: number;
        isDoublePeriod?: boolean;
        focusSummary?: string;
      };
    }) => {
      const res = await fetch("/api/leo/lessons/generate-session-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => null)) as GenerateSessionContentResponse | null;
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to generate session content");
      }
      return json.data?.contentBlocks ?? ([] as LessonContentBlock[]);
    },
  });
}

export function useGenerateSessionPractice() {
  return useMutation({
    mutationFn: async (body: { sessionId: string; questionCount?: number }) => {
      const res = await fetch("/api/leo/lessons/generate-session-practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to generate practice");
      }
      const questions = (json.data as { questions?: unknown })?.questions;
      return Array.isArray(questions) ? questions : [];
    },
  });
}

export function useGenerateSessionFlashcards() {
  return useMutation({
    mutationFn: async (body: { sessionId: string; maxCards?: number }) => {
      const res = await fetch("/api/leo/lessons/generate-session-flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to generate flashcards");
      }
      const cards = (json.data as { cards?: Array<{ front: string; back: string }> })?.cards;
      return Array.isArray(cards) ? cards : [];
    },
  });
}

export type { WeekSplitSessionProposal };
