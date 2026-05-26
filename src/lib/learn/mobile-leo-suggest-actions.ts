import "server-only";

import type { LearnMobileStudentContext } from "@/lib/learn/mobile-auth";
import type { MobileTutorMode, MobileTutorSuggestedAction } from "@/lib/learn/mobile-tutor";

export type LeoContextSnapshot = {
  source?: string;
  mode?: string;
  subjectId?: string;
  lessonId?: string;
  questItemId?: string;
  exploreAdventureId?: string;
  revisionTopicId?: string;
  examAttemptId?: string;
  hasStudentAttempted?: boolean;
};

function actionsForSource(source?: string): MobileTutorSuggestedAction[] {
  switch (source) {
    case "daily_quest_item":
    case "daily_quest_board":
      return [
        { label: "Retry quiz", prompt: "Give me one similar practice question.", mode: "quiz" },
        { label: "Explain simply", prompt: "Explain this topic in simple words.", mode: "explain" },
        { label: "Open Explore", prompt: "Help me explore this topic safely.", mode: "explain" },
      ];
    case "explore":
      return [
        { label: "Go deeper", prompt: "Why does this topic matter in real life?", mode: "explain" },
        { label: "Quick check", prompt: "Ask me one short check question.", mode: "quiz" },
      ];
    case "revision":
    case "weak_topic":
      return [
        { label: "Memory trick", prompt: "Give me a memory trick for this topic.", mode: "revise" },
        { label: "Practice plan", prompt: "What should I revise next?", mode: "revise" },
      ];
    case "exam_prep":
      return [
        { label: "Revise weak topic", prompt: "What should I revise first for my test?", mode: "exam_prep" },
        { label: "Similar question", prompt: "Give me one more practice question.", mode: "quiz" },
      ];
    case "language":
      return [
        { label: "Use in sentence", prompt: "Help me use this word in my own sentence.", mode: "explain" },
      ];
    case "audio_learning":
      return [
        { label: "Summarize", prompt: "Summarize the main ideas simply.", mode: "summarize" },
      ];
    default:
      return [
        { label: "Explain simply", prompt: "Explain this in simple words.", mode: "explain" },
        { label: "Quiz me", prompt: "Ask me one practice question.", mode: "quiz" },
        { label: "Give a hint", prompt: "Give me a hint without the full answer.", mode: "hint" },
      ];
  }
}

export async function buildMobileLeoSuggestedActions(input: {
  context: LearnMobileStudentContext;
  snapshot?: LeoContextSnapshot;
}): Promise<MobileTutorSuggestedAction[]> {
  return actionsForSource(input.snapshot?.source);
}
