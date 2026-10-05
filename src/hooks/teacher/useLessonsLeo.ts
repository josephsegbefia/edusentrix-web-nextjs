import { useMutation } from "@tanstack/react-query";
import type {
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

export type GenerateSessionContentInput = {
  lessonNoteId: string;
  sessionId?: string;
  session?: {
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
    sequenceInWeek?: number;
    slotDraftId?: string;
    previousSession?: {
      title: string;
      focusSummary?: string;
      keyPointsSummary?: string;
    };
    priorSessions?: Array<{
      title: string;
      focusSummary?: string;
      keyPointsSummary?: string;
    }>;
  };
  weekBatch?: {
    classGroupId: string;
    weekStartDate?: string;
    slots: NonNullable<GenerateSessionContentInput["session"]>[];
  };
  regenerate?: boolean;
};

export type EnqueuedLessonGeneration = {
  jobId: string;
  generationRequestId: string;
  status: string;
};

export type LessonGenerationRequestDto = {
  id: string;
  status: string;
  lastError?: string | null;
  slots: Array<{
    slotDraftId: string;
    title: string;
    status: string;
    contentBlocks: LessonContentBlock[];
    error?: string | null;
  }>;
  job?: { status: string; progressPercent: number; progressMessage: string | null } | null;
};

export async function fetchLessonGenerationRequest(
  generationRequestId: string
): Promise<LessonGenerationRequestDto> {
  const res = await fetch(`/api/leo/lessons/generation-requests/${generationRequestId}`, {
    cache: "no-store",
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    throw new Error(json?.error || "Failed to load generation draft");
  }
  return json.data as LessonGenerationRequestDto;
}

export async function pollLessonGenerationRequest(
  generationRequestId: string,
  options?: { intervalMs?: number; timeoutMs?: number }
): Promise<LessonGenerationRequestDto> {
  const intervalMs = options?.intervalMs ?? 2500;
  const timeoutMs = options?.timeoutMs ?? 8 * 60_000;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const draft = await fetchLessonGenerationRequest(generationRequestId);
    if (draft.status === "succeeded") return draft;
    if (draft.status === "failed" || draft.status === "cancelled") {
      throw new Error(draft.lastError || "Lesson generation failed");
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error("Lesson generation is still running. You can keep working and open it from notifications.");
}

export function useGenerateSessionContent() {
  return useMutation({
    mutationFn: async (body: GenerateSessionContentInput) => {
      const res = await fetch("/api/leo/lessons/generate-session-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
        data?: EnqueuedLessonGeneration;
      } | null;
      if (!res.ok || !json?.success || !json.data) {
        throw new Error(json?.error || "Failed to start lesson generation");
      }
      return json.data;
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

export type GeneratedSessionFlashcardsResult = {
  cards: Array<{ front: string; back: string }>;
  skippedDuplicates: number;
};

export function useGenerateSessionFlashcards() {
  return useMutation({
    mutationFn: async (body: {
      sessionId: string;
      maxCards?: number;
      slotIndex?: number;
      totalSlots?: number;
    }): Promise<GeneratedSessionFlashcardsResult> => {
      const res = await fetch("/api/leo/lessons/generate-session-flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to generate flashcards");
      }
      const payload = json.data as {
        cards?: Array<{ front: string; back: string }>;
        meta?: { skippedDuplicates?: number };
      };
      const cards = Array.isArray(payload?.cards) ? payload.cards : [];
      return {
        cards,
        skippedDuplicates: payload?.meta?.skippedDuplicates ?? 0,
      };
    },
  });
}

export type LessonAssessmentItem = {
  id: string;
  type: "multiple_choice" | "short_answer" | "fill_blank" | "practical_task" | "project";
  title: string;
  question: string;
  options?: string[];
  correctAnswer?: string | null;
  rubric?: string | null;
  estimatedMinutes?: number | null;
  aiGenerated: boolean;
};

export function useGenerateSessionAssessment() {
  return useMutation({
    mutationFn: async (body: {
      sessionId: string;
      count?: number;
      preferredTypes?: string[];
    }) => {
      const res = await fetch("/api/leo/lessons/generate-session-assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to generate assessment");
      }
      const items = (json.data as { assessmentItems?: LessonAssessmentItem[] })?.assessmentItems;
      return Array.isArray(items) ? items : ([] as LessonAssessmentItem[]);
    },
  });
}

export type GeneratedFactCardDraft = {
  fact: string;
  detail: string;
  tags: string[];
  illustrationSuggested?: boolean;
  illustrationPrompt?: string | null;
};

export function useGenerateSessionFactCards() {
  return useMutation({
    mutationFn: async (body: { sessionId: string; count?: number }) => {
      const res = await fetch("/api/leo/lessons/generate-session-fact-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to generate fact cards");
      }
      const payload = json.data as {
        factCards?: GeneratedFactCardDraft[];
        meta?: { skippedDuplicates?: number };
      };
      const cards = Array.isArray(payload?.factCards) ? payload.factCards : [];
      return {
        cards,
        skippedDuplicates: payload?.meta?.skippedDuplicates ?? 0,
      };
    },
  });
}

export function useGenerateBoardNotes() {
  return useMutation({
    mutationFn: async (body: { sessionId: string }) => {
      const res = await fetch("/api/leo/lessons/generate-board-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to generate board notes");
      }
      const bn = (
        json.data as {
          boardNotes?: { contentHtml: string; generatedAt: string; aiGenerated: boolean };
        }
      )?.boardNotes;
      if (!bn?.contentHtml) throw new Error("No board notes returned");
      return bn;
    },
  });
}

export type { WeekSplitSessionProposal };
