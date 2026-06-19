import "server-only";

import type mongoose from "mongoose";
import { LessonFlashcard } from "@/models/LessonFlashcard";
import { SubjectOffering } from "@/models/SubjectOffering";
import type { ILessonSession } from "@/models/LessonSession";
import { normalizeContentBlocks } from "@/lib/lessons/content-blocks";

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function firstParagraph(text: string, max = 320): string {
  const para = text.split(/\n\n+/)[0]?.trim() || text.trim();
  if (para.length <= max) return para;
  return `${para.slice(0, max).trim()}…`;
}

export type SessionAssignmentSeedQuestion = {
  id: string;
  prompt: string;
  points: number;
  explanation?: string | null;
  choices: Array<{ id: string; text: string; isCorrect: boolean }>;
};

function deriveQuestionsFromFlashcards(
  cards: Array<{ _id: mongoose.Types.ObjectId; front: string; back: string }>,
): SessionAssignmentSeedQuestion[] {
  return cards
    .map((card, idx) => {
      const prompt = card.front?.trim();
      const answer = card.back?.trim();
      if (!prompt || !answer) return null;
      const distractors = cards
        .filter((other) => String(other._id) !== String(card._id))
        .map((other) => other.back?.trim() || "")
        .filter(Boolean)
        .filter((text) => text.toLowerCase() !== answer.toLowerCase())
        .slice(0, 3);
      const options = [answer, ...distractors]
        .filter(
          (value, position, arr) =>
            arr.findIndex((v) => v.toLowerCase() === value.toLowerCase()) === position,
        )
        .slice(0, 4);
      if (options.length < 2) return null;
      return {
        id: `seed_flashcard_${idx + 1}`,
        prompt,
        points: 1,
        explanation: null,
        choices: options.map((text, optionIdx) => ({
          id: `seed_flashcard_${idx + 1}_choice_${optionIdx + 1}`,
          text,
          isCorrect: text.toLowerCase() === answer.toLowerCase(),
        })),
      };
    })
    .filter((q): q is SessionAssignmentSeedQuestion => Boolean(q))
    .slice(0, 8);
}

export async function buildSessionAssignmentSeed(input: {
  schoolId: mongoose.Types.ObjectId;
  session: Pick<ILessonSession, "_id" | "title" | "classGroupId" | "subjectOfferingId" | "planNotes" | "contentBlocks">;
  type: "assignment" | "quiz" | "practice" | "project";
}): Promise<{
  sessionId: string;
  sessionTitle: string;
  title: string;
  instructions: string;
  type: typeof input.type;
  subjectId: string | null;
  classGroupIds: string[];
  maxScore: number;
  questions?: SessionAssignmentSeedQuestion[];
  questionSeedSource?: "none" | "flashcards" | "content";
}> {
  const offering = await SubjectOffering.findOne({
    _id: input.session.subjectOfferingId,
    schoolId: input.schoolId,
  })
    .select("subjectId")
    .lean();

  const subjectId = offering?.subjectId ? String(offering.subjectId) : null;
  const topic = input.session.title?.trim() || "Session";
  const blocks = normalizeContentBlocks(input.session.contentBlocks ?? []);
  const blockText = blocks
    .map((b) => {
      const label = b.title?.trim() || b.type;
      return `${label}: ${stripHtml(b.bodyHtml).slice(0, 600)}`;
    })
    .filter(Boolean)
    .join("\n\n");
  const plan = input.session.planNotes?.trim() || "";
  const sessionRef = `Based on taught session: ${topic}.`;
  const teacherHint = plan
    ? firstParagraph(plan)
    : blockText
      ? firstParagraph(blockText)
      : "";

  const typeLabel =
    input.type === "quiz"
      ? "Quiz"
      : input.type === "practice"
        ? "Practice"
        : input.type === "project"
          ? "Project"
          : "Assignment";

  const title = `${topic} ${typeLabel}`.slice(0, 160);

  let questions: SessionAssignmentSeedQuestion[] = [];
  let questionSeedSource: "none" | "flashcards" | "content" = "none";

  if (input.type === "quiz" || input.type === "practice") {
    const cards = await LessonFlashcard.find({
      schoolId: input.schoolId,
      sessionId: input.session._id,
    })
      .sort({ order: 1, createdAt: 1 })
      .limit(12)
      .select("_id front back")
      .lean();
    const fromCards = deriveQuestionsFromFlashcards(cards);
    if (fromCards.length > 0) {
      questions = fromCards;
      questionSeedSource = "flashcards";
    }
  }

  const instructions = (
    questions.length > 0
      ? `${sessionRef} Complete the question${questions.length === 1 ? "" : "s"} below.`
      : teacherHint
        ? `${sessionRef}\n\n${teacherHint}`
        : sessionRef
  ).slice(0, 8000);

  return {
    sessionId: String(input.session._id),
    sessionTitle: topic,
    title,
    instructions,
    type: input.type,
    subjectId,
    classGroupIds: [String(input.session.classGroupId)],
    maxScore: 100,
    ...(questions.length > 0 ? { questions, questionSeedSource } : {}),
  };
}
