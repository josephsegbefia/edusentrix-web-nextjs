import type { SessionAssignmentSeedQuestion } from "@/lib/lessons/session-assignment-seed";

type LeoPracticeQuestion = {
  question?: string;
  prompt?: string;
  type?: string;
  options?: string[] | null;
  answer?: string;
};

export function leoPracticeQuestionsToHomeworkSeed(
  raw: unknown,
  max = 12,
): SessionAssignmentSeedQuestion[] {
  if (!raw || typeof raw !== "object") return [];
  const questions = (raw as { questions?: unknown }).questions;
  if (!Array.isArray(questions)) return [];

  const out: SessionAssignmentSeedQuestion[] = [];
  for (let idx = 0; idx < questions.length && out.length < max; idx++) {
    const q = questions[idx] as LeoPracticeQuestion;
    const prompt =
      typeof q.prompt === "string"
        ? q.prompt.trim()
        : typeof q.question === "string"
          ? q.question.trim()
          : "";
    if (!prompt) continue;

    const options = Array.isArray(q.options)
      ? q.options.map((o) => (typeof o === "string" ? o.trim() : "")).filter(Boolean)
      : [];
    const answer = typeof q.answer === "string" ? q.answer.trim() : "";

    if (options.length >= 2 && answer) {
      const choices = options.slice(0, 4).map((text, optionIdx) => ({
        id: `leo_${idx + 1}_choice_${optionIdx + 1}`,
        text,
        isCorrect: text.toLowerCase() === answer.toLowerCase(),
      }));
      if (!choices.some((c) => c.isCorrect) && choices[0]) {
        choices[0] = { ...choices[0], isCorrect: true };
      }
      out.push({
        id: `leo_${idx + 1}`,
        prompt,
        points: 1,
        explanation: null,
        choices,
      });
      continue;
    }

    if (answer) {
      out.push({
        id: `leo_${idx + 1}`,
        prompt,
        points: 1,
        explanation: answer,
        choices: [
          { id: `leo_${idx + 1}_c1`, text: answer, isCorrect: true },
          { id: `leo_${idx + 1}_c2`, text: "—", isCorrect: false },
        ],
      });
    }
  }
  return out;
}
