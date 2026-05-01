import { useMutation } from "@tanstack/react-query";

export type LeoLessonDraftRequest =
  | { kind: "summary"; lessonNoteId: string }
  | { kind: "flashcards"; lessonNoteId: string; maxCards?: number }
  | { kind: "practice"; lessonId: string; questionCount?: number }
  | { kind: "activities"; lessonId: string }
  | { kind: "simplify"; lessonNoteId: string }
  | { kind: "differentiate"; lessonNoteId: string }
  | { kind: "parentSummary"; lessonNoteId: string }
  | { kind: "quality"; lessonNoteId: string };

export type LeoLessonDraftResponse = {
  success: boolean;
  isDraft?: boolean;
  disclaimer?: string;
  data: unknown;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  error?: string;
};

function buildLeoRequest(input: LeoLessonDraftRequest): { url: string; body: Record<string, unknown> } {
  switch (input.kind) {
    case "summary":
      return {
        url: "/api/leo/lessons/generate-summary",
        body: { lessonNoteId: input.lessonNoteId },
      };
    case "flashcards":
      return {
        url: "/api/leo/lessons/generate-flashcards",
        body: {
          lessonNoteId: input.lessonNoteId,
          ...(input.maxCards != null ? { maxCards: input.maxCards } : {}),
        },
      };
    case "practice":
      return {
        url: "/api/leo/lessons/generate-practice-questions",
        body: {
          lessonId: input.lessonId,
          ...(input.questionCount != null ? { questionCount: input.questionCount } : {}),
        },
      };
    case "activities":
      return {
        url: "/api/leo/lessons/suggest-activities",
        body: { lessonId: input.lessonId },
      };
    case "simplify":
      return {
        url: "/api/leo/lessons/simplify-for-learners",
        body: { lessonNoteId: input.lessonNoteId },
      };
    case "parentSummary":
      return {
        url: "/api/leo/lessons/generate-parent-summary",
        body: { lessonNoteId: input.lessonNoteId },
      };
    case "differentiate":
      return {
        url: "/api/leo/lessons/generate-differentiated-materials",
        body: { lessonNoteId: input.lessonNoteId },
      };
    case "quality":
      return {
        url: "/api/leo/lessons/check-quality",
        body: { lessonNoteId: input.lessonNoteId },
      };
  }
}

async function postLeoDraft(input: LeoLessonDraftRequest): Promise<LeoLessonDraftResponse> {
  const { url, body } = buildLeoRequest(input);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) as LeoLessonDraftResponse | null;
  if (!res.ok || !json?.success) {
    const msg = json?.error || "Leo request failed";
    throw new Error(msg);
  }
  return json;
}

/** Teacher-only Leo drafts for lessons (spec §13.8); does not publish anything. */
export function useLeoLessonDraftMutation() {
  return useMutation({
    mutationFn: postLeoDraft,
  });
}
