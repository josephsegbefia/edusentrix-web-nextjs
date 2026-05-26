import { Types } from "mongoose";
import { Homework } from "@/models/Homework";
import { loadCoveredLessonSessionById } from "@/lib/learn/covered-lesson-sessions";
import {
  LEO_STUDENT_FLASHCARD_MAX,
  resolveSessionFlashcardsForStudent,
} from "@/lib/learn/leo-session-flashcards";
import { LessonSession } from "@/models/LessonSession";
import { SubjectOffering } from "@/models/SubjectOffering";
import { Teacher } from "@/models/Teacher";
import { User } from "@/models/User";

export const QUEST_XP_REWARD = 80;
const LETTERS = ["A", "B", "C", "D"] as const;

type SessionRow = {
  _id: Types.ObjectId;
  title: string;
  subjectOfferingId: Types.ObjectId;
  scheduledDate: Date;
  ownerTeacherId: Types.ObjectId;
  durationMinutes: number;
  planNotes?: string | null;
  contentBlocks?: Array<{ bodyHtml?: string }>;
};

type FlashcardRow = {
  _id: Types.ObjectId;
  front: string;
  back: string;
  order: number;
};

type QuizQuestion = {
  id: string;
  prompt: string;
  options: Array<{ id: string; letter: string; label: string }>;
  correctOptionId: string;
  explanation: string;
};

export type DailyQuestPayload = {
  id: string;
  title: string;
  subjectName: string;
  estimatedMinutes: number;
  xpReward: number;
  intro: string;
  recap: {
    lessonTitle: string;
    teacherName: string;
    coveredDate: string;
    summary: string;
  };
  flashcards: Array<{ id: string; front: string; back: string }>;
  quizQuestions: QuizQuestion[];
};

function buildQuestId(sessionId: Types.ObjectId | string) {
  return `session-${String(sessionId)}`;
}

function stripHtml(html: string, maxLen = 220) {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 1)}…`;
}

function formatCoveredDate(date: Date) {
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays <= 0) return "Covered today";
  if (diffDays === 1) return "Covered yesterday";
  if (diffDays < 7) return "Covered this week";
  return `Covered ${date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
}

async function teacherDisplayName(teacherId: Types.ObjectId) {
  const teacher = await Teacher.findById(teacherId).select("userId").lean<{ userId?: Types.ObjectId } | null>();
  if (!teacher?.userId) return "Your teacher";
  const user = await User.findById(teacher.userId)
    .select("firstName lastName name")
    .lean<{ firstName?: string; lastName?: string; name?: string } | null>();
  if (!user) return "Your teacher";
  const fromParts = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return fromParts || user.name?.trim() || "Your teacher";
}

async function subjectNameForOffering(schoolId: Types.ObjectId, offeringId: Types.ObjectId) {
  const row = await SubjectOffering.findOne({ _id: offeringId, schoolId })
    .select("displayName shortName")
    .lean<{ displayName?: string; shortName?: string } | null>();
  return row?.shortName || row?.displayName || "your class";
}

function buildQuizFromContentBlocks(session: SessionRow): QuizQuestion[] {
  const snippets = (session.contentBlocks ?? [])
    .map((block) => stripHtml(block.bodyHtml ?? "", 140))
    .filter((text) => text.length >= 24)
    .slice(0, 3);

  if (snippets.length === 0) {
    const summary = stripHtml(
      `Your class covered ${session.title}. Revise the main ideas from your lesson.`,
      140
    );
    if (summary.length < 20) return [];
    snippets.push(summary);
  }

  return snippets.slice(0, 2).map((snippet, index) => ({
    id: `content-${index}`,
    prompt: `What did your class learn about ${session.title}?`,
    options: [
      { id: `content-${index}-a`, letter: "A", label: snippet },
      {
        id: `content-${index}-b`,
        letter: "B",
        label: "We have not covered this topic yet.",
      },
      {
        id: `content-${index}-c`,
        letter: "C",
        label: "I need to check my class notes.",
      },
      {
        id: `content-${index}-d`,
        letter: "D",
        label: "None of these match what we learned.",
      },
    ],
    correctOptionId: `content-${index}-a`,
    explanation: snippet,
  }));
}

function buildQuizFromFlashcards(cards: FlashcardRow[]): QuizQuestion[] {
  if (cards.length === 0) return [];

  const pool = cards.slice(0, 8);
  const questions: QuizQuestion[] = [];

  for (let index = 0; index < Math.min(pool.length, 5); index += 1) {
    const card = pool[index];
    const distractors = pool
      .filter((c) => String(c._id) !== String(card._id))
      .map((c) => c.back)
      .slice(0, 3);

    while (distractors.length < 3 && pool.length > 1) {
      distractors.push(pool[(index + distractors.length + 1) % pool.length].back);
    }

    const optionsRaw = [card.back, ...distractors.slice(0, 3)];
    const rotateBy = index % optionsRaw.length;
    const rotated = [...optionsRaw.slice(rotateBy), ...optionsRaw.slice(0, rotateBy)];

    const options = rotated.map((label, optIndex) => ({
      id: `q${index}-opt-${optIndex}`,
      letter: LETTERS[optIndex],
      label: label.slice(0, 180),
    }));

    const correctOptionId =
      options.find((opt) => opt.label === card.back)?.id ?? `q${index}-opt-0`;

    questions.push({
      id: `q-${String(card._id)}`,
      prompt: `Which answer best matches: ${card.front.slice(0, 160)}?`,
      options,
      correctOptionId,
      explanation: card.back.slice(0, 280),
    });
  }

  return questions;
}

function mapHomeworkQuestions(
  questions: Array<{
    id: string;
    prompt: string;
    explanation?: string;
    choices: Array<{ id: string; text: string; isCorrect: boolean }>;
  }>
): QuizQuestion[] {
  return questions.slice(0, 6).map((question, index) => {
    const choices = question.choices.slice(0, 4);
    const options = choices.map((choice, optIndex) => ({
      id: choice.id || `hw-${index}-opt-${optIndex}`,
      letter: LETTERS[optIndex] ?? "D",
      label: choice.text,
    }));
    const correct = choices.find((c) => c.isCorrect);
    const correctOptionId =
      options.find((opt) => opt.label === correct?.text)?.id ??
      options[0]?.id ??
      `hw-${index}-opt-0`;

    return {
      id: question.id || `hw-q-${index}`,
      prompt: question.prompt,
      options,
      correctOptionId,
      explanation: question.explanation || "Review your class notes to see why this answer fits.",
    };
  });
}

export async function loadQuestSession(input: {
  schoolId: Types.ObjectId;
  classGroupId: Types.ObjectId;
  sessionId: Types.ObjectId;
}) {
  return loadCoveredLessonSessionById<SessionRow>({
    sessionId: input.sessionId,
    schoolId: input.schoolId,
    classGroupId: input.classGroupId,
    select:
      "_id title subjectOfferingId scheduledDate ownerTeacherId durationMinutes contentBlocks planNotes",
  });
}

export async function buildDailyQuestForSession(input: {
  schoolId: Types.ObjectId;
  classGroupId: Types.ObjectId;
  studentId: Types.ObjectId;
  session: SessionRow;
}): Promise<DailyQuestPayload> {
  const subjectName = await subjectNameForOffering(
    input.schoolId,
    input.session.subjectOfferingId
  );
  const teacherName = await teacherDisplayName(input.session.ownerTeacherId);
  const firstBlock = input.session.contentBlocks?.[0]?.bodyHtml;
  const summary = firstBlock
    ? stripHtml(firstBlock)
    : `Your class covered ${input.session.title}. Revise the key ideas with flashcards and a short quiz.`;

  const resolved = await resolveSessionFlashcardsForStudent({
    schoolId: input.schoolId,
    classGroupId: input.classGroupId,
    studentId: input.studentId,
    session: input.session as unknown as Parameters<
      typeof resolveSessionFlashcardsForStudent
    >[0]["session"],
    cardLimit: LEO_STUDENT_FLASHCARD_MAX,
    generateIfMissing: true,
  });

  const flashcards: FlashcardRow[] = resolved?.cards ?? [];
  const flashcardSource = resolved?.source;

  const homework = await Homework.findOne({
    schoolId: input.schoolId,
    sourceSessionId: input.session._id,
    status: "published",
    classGroupIds: input.classGroupId,
    type: { $in: ["quiz", "practice"] },
    "questions.0": { $exists: true },
  })
    .select("questions")
    .lean<{ questions?: Array<{
      id: string;
      prompt: string;
      explanation?: string;
      choices: Array<{ id: string; text: string; isCorrect: boolean }>;
    }> } | null>();

  let quizQuestions = homework?.questions?.length
    ? mapHomeworkQuestions(homework.questions)
    : buildQuizFromFlashcards(flashcards);

  if (quizQuestions.length === 0 && flashcards.length > 0) {
    quizQuestions = buildQuizFromFlashcards(flashcards);
  }

  if (quizQuestions.length === 0) {
    quizQuestions = buildQuizFromContentBlocks(input.session);
  }

  const questId = buildQuestId(input.session._id);

  return {
    id: questId,
    title: `${input.session.title} Boost`,
    subjectName,
    estimatedMinutes: Math.min(Math.max(input.session.durationMinutes || 10, 5), 25),
    xpReward: QUEST_XP_REWARD,
    intro:
      flashcardSource === "leo_student"
        ? `Leo prepared flashcards from ${input.session.title}. Revise them, then finish a short practice quiz.`
        : `Revise ${input.session.title}, warm up with flashcards, then finish a short practice quiz.`,
    recap: {
      lessonTitle: input.session.title,
      teacherName,
      coveredDate: formatCoveredDate(input.session.scheduledDate),
      summary,
    },
    flashcards: flashcards.map((card) => ({
      id: String(card._id),
      front: card.front,
      back: card.back,
    })),
    quizQuestions,
  };
}
