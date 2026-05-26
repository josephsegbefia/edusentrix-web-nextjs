import type { GuidedAdventureContentV2 } from "@/lib/learn/explore/explore-types";
import type { IStudentExploreRecord } from "@/models/StudentExploreRecord";

/** Parent-safe Explore summary — no raw AI or audit metadata. */
export type ExploreParentSummary = {
  adventureId: string;
  studentId: string;
  title: string;
  subjectName: string;
  sourceLessonTitle: string;
  gradeName: string;
  exploredAt: string;
  completionStatus: IStudentExploreRecord["status"];
  whatChildExplored: string;
  thingsLearned: string[];
  possibleStruggle?: string;
  parentConversation?: {
    title: string;
    prompt: string;
  };
  quizSummary?: {
    scorePercent: number;
    correctCount: number;
    totalCount: number;
    message: string;
  };
  encouragement: string;
};

function firstSentences(text: string, maxLength = 220) {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength).trim()}…`;
}

function buildThingsLearned(content: GuidedAdventureContentV2): string[] {
  const items: string[] = [];

  if (content.funFacts?.length) {
    for (const fact of content.funFacts.slice(0, 2)) {
      items.push(firstSentences(fact.fact, 160));
    }
  }

  if (items.length < 3 && content.deepDiveExplanation?.deeperExplanation) {
    items.push(firstSentences(content.deepDiveExplanation.deeperExplanation, 160));
  }

  if (items.length < 3 && content.vocabulary?.length) {
    const word = content.vocabulary[0];
    items.push(`${word.word}: ${firstSentences(word.meaning, 100)}`);
  }

  return items.slice(0, 3);
}

function buildPossibleStruggle(content: GuidedAdventureContentV2): string | undefined {
  const misconception = content.misconceptions?.[0];
  if (!misconception) return undefined;

  return firstSentences(
    `Some learners find this tricky: ${misconception.misconception} Leo helps with: ${misconception.leoCorrection}`,
    240
  );
}

function buildEncouragement(
  status: IStudentExploreRecord["status"],
  quizScorePercent?: number | null
) {
  if (status === "completed") {
    return quizScorePercent != null && quizScorePercent >= 70
      ? "Your child finished this mission well. Celebrate the effort, not only the score."
      : "Your child completed this mission. Praise persistence and ask them to explain one idea in their own words.";
  }

  if (status === "quiz_submitted") {
    return "Your child finished the practice quiz. A short chat about what felt easy or hard can help a lot.";
  }

  if (status === "in_progress") {
    return "Your child started this mission. You can ask what part they enjoyed most so far.";
  }

  return "This mission is ready when your child opens Explore with Leo.";
}

export function buildExploreParentSummary(input: {
  adventureId: string;
  studentId: string;
  title: string;
  subjectName: string;
  sourceLessonTitle: string;
  gradeName: string;
  exploredAt: string;
  record: Pick<
    IStudentExploreRecord,
    "status" | "quizScorePercent" | "correctCount" | "totalCount"
  >;
  content: GuidedAdventureContentV2;
}): ExploreParentSummary {
  const { content, record } = input;

  const summary: ExploreParentSummary = {
    adventureId: input.adventureId,
    studentId: input.studentId,
    title: input.title,
    subjectName: input.subjectName,
    sourceLessonTitle: input.sourceLessonTitle,
    gradeName: input.gradeName,
    exploredAt: input.exploredAt,
    completionStatus: record.status,
    whatChildExplored: firstSentences(
      `${content.intro} ${content.adventureAngle}`,
      280
    ),
    thingsLearned: buildThingsLearned(content),
    encouragement: buildEncouragement(record.status, record.quizScorePercent),
  };

  const struggle = buildPossibleStruggle(content);
  if (struggle) {
    summary.possibleStruggle = struggle;
  }

  if (content.parentConversationPrompt?.prompt) {
    summary.parentConversation = {
      title: content.parentConversationPrompt.title,
      prompt: content.parentConversationPrompt.prompt,
    };
  }

  if (
    (record.status === "quiz_submitted" || record.status === "completed") &&
    record.quizScorePercent != null &&
    record.correctCount != null &&
    record.totalCount != null &&
    record.totalCount > 0
  ) {
    const score = Math.round(record.quizScorePercent);
    summary.quizSummary = {
      scorePercent: score,
      correctCount: record.correctCount,
      totalCount: record.totalCount,
      message:
        score >= 80
          ? "Strong practice quiz — your child remembered the main ideas."
          : score >= 50
            ? "Good effort on the practice quiz — revisiting one fun fact together could help."
            : "The practice quiz was challenging — encourage your child to re-read one section with Leo.",
    };
  }

  return summary;
}
