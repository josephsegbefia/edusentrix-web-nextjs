import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import type { LearnMobileStudentContext } from "@/lib/learn/mobile-auth";
import { getStudentLearnAccess } from "@/lib/learn/access";
import { recordLearnMobileActivity } from "@/lib/learn/mobile-activity";
import {
  loadMobileStudentBundle,
  serializeMobileLoginStudent,
} from "@/lib/learn/mobile-student-profile";
import { loadQuestSession } from "@/lib/learn/mobile-quest";
import {
  resolveSessionFlashcardsForStudent,
  type ResolvedSessionFlashcards,
} from "@/lib/learn/leo-session-flashcards";
import { Homework } from "@/models/Homework";
import { LearnActivityEvent } from "@/models/LearnActivityEvent";
import { LessonFlashcard } from "@/models/LessonFlashcard";
import { LessonFlashcardDeck } from "@/models/LessonFlashcardDeck";
import {
  defaultSinceDays,
  findCoveredLessonSessions,
} from "@/lib/learn/covered-lesson-sessions";
import { LessonSession, type ILessonSession } from "@/models/LessonSession";
import { StudentFlashcardProgress } from "@/models/StudentFlashcardProgress";
import { SubjectOffering } from "@/models/SubjectOffering";
import { Submission } from "@/models/Submission";

const LETTERS = ["A", "B", "C", "D"] as const;

type SessionRow = {
  _id: Types.ObjectId;
  title: string;
  subjectOfferingId: Types.ObjectId;
  scheduledDate: Date;
  durationMinutes: number;
  ownerTeacherId: Types.ObjectId;
  planNotes?: string | null;
  contentBlocks?: ILessonSession["contentBlocks"];
};

type FlashcardRow = {
  _id: Types.ObjectId;
  front: string;
  back: string;
  order: number;
};

export type RevisionQuestion = {
  id: string;
  type: "mcq" | "short_answer" | "true_false";
  prompt: string;
  options?: string[];
  correctAnswer: string;
  hint?: string;
  explanation: string;
};

async function assertRevisionAccess(context: LearnMobileStudentContext) {
  const access = await getStudentLearnAccess({
    schoolId: context.schoolId,
    studentId: context.studentId,
    accountId: context.accountId,
  });

  if (!access.hasAccess) {
    return {
      ok: false as const,
      code: access.schoolEligible ? "LEARN_ACCESS_REQUIRED" : "SCHOOL_NOT_ELIGIBLE",
      message: access.blockedReason || "Learn access required.",
      status: 403,
    };
  }

  if (!context.classGroupId) {
    return {
      ok: false as const,
      code: "NO_STUDENT_PROFILE",
      message: "Class group not found.",
      status: 404,
    };
  }

  return { ok: true as const };
}

function stripHtml(html: string, maxLen = 220) {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 1)}…`;
}

function normalizeAnswer(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function severityFromMastery(masteryPercent: number): "needs_practice" | "almost_there" | "getting_stronger" {
  if (masteryPercent < 50) return "needs_practice";
  if (masteryPercent < 72) return "almost_there";
  return "getting_stronger";
}

function recommendedActionFor(
  severity: "needs_practice" | "almost_there" | "getting_stronger",
  hasFlashcards: boolean
): "practice" | "flashcards" | "ask_leo" | "lesson_recap" {
  if (severity === "getting_stronger") return "ask_leo";
  if (severity === "needs_practice" && hasFlashcards) return "flashcards";
  return "practice";
}

export function buildRevisionTopicId(sessionId: Types.ObjectId | string) {
  return `session-${String(sessionId)}`;
}

export function parseRevisionTopicId(topicId: string): { kind: "session"; objectId: Types.ObjectId } | null {
  const match = topicId.match(/^session-([a-f0-9]{24})$/i);
  if (!match?.[1] || !Types.ObjectId.isValid(match[1])) return null;
  return { kind: "session", objectId: new Types.ObjectId(match[1]) };
}

export function buildRevisionSessionId(topicId: string) {
  return `revision-${topicId}`;
}

export function parseRevisionSessionId(sessionId: string): string | null {
  if (!sessionId.startsWith("revision-")) return null;
  return sessionId.slice("revision-".length);
}

async function subjectNameForOffering(schoolId: Types.ObjectId, offeringId: Types.ObjectId) {
  const row = await SubjectOffering.findOne({ _id: offeringId, schoolId })
    .select("displayName shortName")
    .lean<{ displayName?: string; shortName?: string } | null>();
  return row?.shortName || row?.displayName || "Subject";
}

export function buildRevisionQuestionsFromFlashcards(cards: FlashcardRow[]): RevisionQuestion[] {
  if (cards.length === 0) return [];

  const pool = cards.slice(0, 8);
  const questions: RevisionQuestion[] = [];

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
    const options = [...optionsRaw.slice(rotateBy), ...optionsRaw.slice(0, rotateBy)].map((label) =>
      label.slice(0, 180)
    );

    questions.push({
      id: `rev-${String(card._id)}`,
      type: "mcq",
      prompt: `Which answer best matches: ${card.front.slice(0, 160)}?`,
      options,
      correctAnswer: card.back.slice(0, 180),
      hint: "Say the answer out loud before you choose.",
      explanation: card.back.slice(0, 280),
    });
  }

  return questions;
}

function mapHomeworkToRevisionQuestions(
  questions: Array<{
    id: string;
    prompt: string;
    explanation?: string;
    choices: Array<{ id: string; text: string; isCorrect: boolean }>;
  }>
): RevisionQuestion[] {
  return questions.slice(0, 6).map((question, index) => {
    const choices = question.choices.slice(0, 4);
    const correct = choices.find((c) => c.isCorrect) ?? choices[0];
    const options = choices.map((c) => c.text);

    if (options.length === 2 && options.every((o) => /^(true|false)$/i.test(o.trim()))) {
      return {
        id: question.id || `hw-rev-${index}`,
        type: "true_false",
        prompt: question.prompt,
        options: ["True", "False"],
        correctAnswer: correct?.text?.trim() === "False" ? "False" : "True",
        explanation: question.explanation || "Review your class notes for this idea.",
      };
    }

    return {
      id: question.id || `hw-rev-${index}`,
      type: "mcq",
      prompt: question.prompt,
      options,
      correctAnswer: correct?.text || options[0] || "",
      explanation: question.explanation || "Review your class notes for this idea.",
    };
  });
}

type SessionFlashcardInput = {
  _id: Types.ObjectId;
  title: string;
  planNotes?: string | null;
  contentBlocks?: ILessonSession["contentBlocks"];
  ownerTeacherId: Types.ObjectId;
};

function sessionFlashcardCacheKey(
  schoolId: Types.ObjectId,
  studentId: Types.ObjectId,
  sessionId: Types.ObjectId
) {
  return `${String(schoolId)}:${String(studentId)}:${String(sessionId)}`;
}

async function loadSessionFlashcards(
  schoolId: Types.ObjectId,
  classGroupId: Types.ObjectId,
  studentId: Types.ObjectId,
  session: SessionFlashcardInput,
  cache?: Map<string, Promise<ResolvedSessionFlashcards | null>>
) {
  const resolvedCache = cache ?? new Map<string, Promise<ResolvedSessionFlashcards | null>>();
  const key = sessionFlashcardCacheKey(schoolId, studentId, session._id);
  if (!resolvedCache.has(key)) {
    resolvedCache.set(
      key,
      resolveSessionFlashcardsForStudent({
        schoolId,
        classGroupId,
        studentId,
        session,
        cardLimit: 12,
        generateIfMissing: true,
      })
    );
  }

  const resolved = await resolvedCache.get(key)!;

  if (!resolved) {
    return { deckId: null as Types.ObjectId | null, cards: [] as FlashcardRow[] };
  }

  return { deckId: resolved.deckId, cards: resolved.cards as FlashcardRow[] };
}

async function computeSessionMastery(
  context: LearnMobileStudentContext,
  session: SessionRow,
  cards: FlashcardRow[],
  deckId: Types.ObjectId | null
) {
  let quizScorePercent = 70;
  let missedQuestions = 0;
  let trend: "improving" | "steady" | "needs_attention" = "steady";
  let lastPracticedAt: string | undefined;
  let note = "Keep practicing to strengthen this topic.";

  const homework = await Homework.findOne({
    schoolId: context.schoolId,
    sourceSessionId: session._id,
    status: "published",
    classGroupIds: context.classGroupId,
    type: { $in: ["quiz", "practice"] },
  })
    .select("_id questions")
    .lean<{ _id: Types.ObjectId; questions?: Array<{ id: string }> } | null>();

  if (homework) {
    const submission = await Submission.findOne({
      schoolId: context.schoolId,
      studentId: context.studentId,
      homeworkId: homework._id,
      status: { $in: ["graded", "submitted", "late"] },
    })
      .select("score questionResponses submittedAt")
      .lean<{
        score?: number;
        submittedAt?: Date;
        questionResponses?: Array<{ isCorrect?: boolean }>;
      } | null>();

    if (submission) {
      const total = homework.questions?.length || submission.questionResponses?.length || 0;
      const missed =
        submission.questionResponses?.filter((r) => r.isCorrect === false).length ?? 0;
      missedQuestions = missed;
      if (typeof submission.score === "number" && total > 0) {
        quizScorePercent = Math.round(submission.score);
      } else if (total > 0) {
        quizScorePercent = Math.round(((total - missed) / total) * 100);
      }
      if (submission.submittedAt) {
        lastPracticedAt = submission.submittedAt.toISOString();
      }
      note =
        missed > 0
          ? `You missed ${missed} question${missed === 1 ? "" : "s"} on the last class quiz.`
          : "Your last quiz attempt looked strong. One more practice will help it stick.";
      trend = quizScorePercent >= 75 ? "improving" : quizScorePercent < 55 ? "needs_attention" : "steady";
    }
  }

  let flashcardNeeds = 0;
  if (deckId && cards.length > 0) {
    const progress = await StudentFlashcardProgress.find({
      schoolId: context.schoolId,
      studentId: context.studentId,
      deckId,
      flashcardId: { $in: cards.map((c) => c._id) },
    })
      .select("status lastReviewedAt")
      .lean<Array<{ status: string; lastReviewedAt?: Date | null }>>();

    flashcardNeeds = progress.filter((p) => p.status === "needs_review").length;
    const latest = progress
      .map((p) => p.lastReviewedAt)
      .filter(Boolean)
      .sort((a, b) => (b!.getTime() - a!.getTime()))[0];
    if (latest && (!lastPracticedAt || latest > new Date(lastPracticedAt))) {
      lastPracticedAt = latest.toISOString();
    }
  }

  const activity = await LearnActivityEvent.find({
    schoolId: context.schoolId,
    studentId: context.studentId,
    eventType: { $in: ["revision_session", "quest_completed"] },
    topic: session.title,
  })
    .sort({ occurredAt: -1 })
    .limit(3)
    .select("score occurredAt eventType")
    .lean<Array<{ score?: number | null; occurredAt: Date; eventType: string }>>();

  if (activity.length > 0) {
    const scores = activity.map((a) => a.score).filter((s): s is number => typeof s === "number");
    if (scores.length >= 2 && scores[0] > scores[1]) trend = "improving";
    if (scores[0] !== undefined && scores[0] < 55) trend = "needs_attention";
    lastPracticedAt = activity[0].occurredAt.toISOString();
  }

  let masteryPercent = quizScorePercent;
  if (cards.length > 0) {
    const known = cards.length - flashcardNeeds;
    const flashMastery = Math.round((known / cards.length) * 100);
    masteryPercent = Math.round(masteryPercent * 0.6 + flashMastery * 0.4);
  }

  const weaknessScore = Math.max(10, Math.min(95, 100 - masteryPercent + flashcardNeeds * 4));

  return {
    masteryPercent,
    weaknessScore,
    quizScorePercent,
    missedQuestions,
    trend,
    note,
    lastPracticedAt,
    hasFlashcards: cards.length > 0,
    deckId,
  };
}

async function buildTopicFromSession(
  context: LearnMobileStudentContext,
  session: SessionRow,
  flashcardCache: Map<string, Promise<ResolvedSessionFlashcards | null>>
) {
  const subjectName = await subjectNameForOffering(context.schoolId, session.subjectOfferingId);
  const { deckId, cards } = await loadSessionFlashcards(
    context.schoolId,
    context.classGroupId!,
    context.studentId,
    session,
    flashcardCache
  );
  const metrics = await computeSessionMastery(context, session, cards, deckId);
  const severity = severityFromMastery(metrics.masteryPercent);
  const firstBlock = session.contentBlocks?.[0]?.bodyHtml;
  const summary = firstBlock
    ? stripHtml(firstBlock)
    : `Your class covered ${session.title}. A short practice sprint will help the ideas stick.`;

  return {
    id: buildRevisionTopicId(session._id),
    title: session.title,
    subjectId: String(session.subjectOfferingId),
    subjectName,
    weaknessScore: metrics.weaknessScore,
    masteryPercent: metrics.masteryPercent,
    severity,
    reason:
      metrics.missedQuestions > 0
        ? `Recent practice shows ${metrics.missedQuestions} missed check${metrics.missedQuestions === 1 ? "" : "s"} for this topic.`
        : "This topic could use one more focused practice sprint.",
    recommendedAction: recommendedActionFor(severity, metrics.hasFlashcards),
    estimatedMinutes: Math.min(Math.max(session.durationMinutes || 10, 8), 18),
    relatedFlashcardDeckId: deckId ? String(deckId) : undefined,
    lastPracticedAt: metrics.lastPracticedAt,
    recentPerformance: {
      quizScorePercent: metrics.quizScorePercent,
      missedQuestions: metrics.missedQuestions,
      trend: metrics.trend,
      note: metrics.note,
    },
    recap: {
      title: session.title,
      summary,
      keyPoints: [
        "Start with what your teacher covered in class.",
        "Say the answer out loud before checking it.",
        "Mark honest practice so Leo can recommend the next step.",
      ],
    },
  };
}

export async function buildMobileRevisionTopicsList(context: LearnMobileStudentContext) {
  await connectToDatabase();
  const gate = await assertRevisionAccess(context);
  if (!gate.ok) return gate;

  const bundle = await loadMobileStudentBundle({
    schoolId: context.schoolId,
    studentId: context.studentId,
    accountId: context.accountId,
  });

  if (!bundle) {
    return {
      ok: false as const,
      code: "NO_STUDENT_PROFILE",
      message: "Student profile not found.",
      status: 404,
    };
  }

  const sessions = await findCoveredLessonSessions<SessionRow>({
    schoolId: context.schoolId,
    classGroupId: context.classGroupId,
    since: defaultSinceDays(60),
    limit: 12,
    select:
      "_id title subjectOfferingId scheduledDate durationMinutes contentBlocks ownerTeacherId planNotes",
  });

  const flashcardCache = new Map<string, Promise<ResolvedSessionFlashcards | null>>();
  const topics = await Promise.all(
    sessions.map((session) => buildTopicFromSession(context, session, flashcardCache))
  );

  const sorted = topics
    .filter((t) => t.weaknessScore >= 40 || t.masteryPercent < 80)
    .sort((a, b) => b.weaknessScore - a.weaknessScore);

  const finalTopics = sorted.length > 0 ? sorted : topics.slice(0, 4);
  const recommendedTopicId = finalTopics[0]?.id ?? "";

  const profile = serializeMobileLoginStudent(bundle);

  return {
    ok: true as const,
    data: {
      studentContext: {
        studentId: profile.studentId,
        schoolName: profile.schoolName,
        gradeName: profile.gradeName,
        classGroupName: profile.classGroupName,
        termName: profile.termName || "Current term",
      },
      recommendedTopicId,
      topics: finalTopics,
    },
  };
}

export async function buildMobileRevisionTopicDetail(
  context: LearnMobileStudentContext,
  topicId: string
) {
  const list = await buildMobileRevisionTopicsList(context);
  if (!list.ok) return list;

  const topic = list.data.topics.find((t) => t.id === topicId);
  if (!topic) {
    return {
      ok: false as const,
      code: "REVISION_TOPIC_NOT_FOUND",
      message: "Revision topic not found.",
      status: 404,
    };
  }

  return { ok: true as const, data: topic };
}

async function buildQuestionsForTopic(
  context: LearnMobileStudentContext,
  topicId: string,
  flashcardCache?: Map<string, Promise<ResolvedSessionFlashcards | null>>
) {
  const parsed = parseRevisionTopicId(topicId);
  if (!parsed || !context.classGroupId) return [];

  const session = await loadQuestSession({
    schoolId: context.schoolId,
    classGroupId: context.classGroupId,
    sessionId: parsed.objectId,
  });

  if (!session) return [];

  const cache = flashcardCache ?? new Map<string, Promise<ResolvedSessionFlashcards | null>>();
  const { cards } = await loadSessionFlashcards(
    context.schoolId,
    context.classGroupId,
    context.studentId,
    session,
    cache
  );

  const homework = await Homework.findOne({
    schoolId: context.schoolId,
    sourceSessionId: session._id,
    status: "published",
    classGroupIds: context.classGroupId,
    type: { $in: ["quiz", "practice"] },
    "questions.0": { $exists: true },
  })
    .select("questions")
    .lean<{
      questions?: Array<{
        id: string;
        prompt: string;
        explanation?: string;
        choices: Array<{ id: string; text: string; isCorrect: boolean }>;
      }>;
    } | null>();

  if (homework?.questions?.length) {
    return mapHomeworkToRevisionQuestions(homework.questions);
  }

  return buildRevisionQuestionsFromFlashcards(cards);
}

export async function startMobileRevisionSession(
  context: LearnMobileStudentContext,
  topicId: string
) {
  await connectToDatabase();
  const gate = await assertRevisionAccess(context);
  if (!gate.ok) return gate;

  const topicResult = await buildMobileRevisionTopicDetail(context, topicId);
  if (!topicResult.ok) return topicResult;

  const questions = await buildQuestionsForTopic(context, topicId);
  if (questions.length === 0) {
    return {
      ok: false as const,
      code: "REVISION_TOPIC_NOT_FOUND",
      message: "Practice questions are not ready yet.",
      status: 404,
    };
  }

  const sessionId = buildRevisionSessionId(topicId);

  await recordLearnMobileActivity({
    schoolId: context.schoolId,
    studentId: context.studentId,
    accountId: context.accountId,
    gradeId: context.gradeId,
    classGroupId: context.classGroupId,
    eventType: "revision_session",
    topic: topicResult.data.title,
    metadata: { phase: "session_started", sessionId, topicId },
  });

  return {
    ok: true as const,
    data: {
      id: sessionId,
      topicId,
      startedAt: new Date().toISOString(),
      questions,
    },
  };
}

export async function submitMobileRevisionSession(input: {
  context: LearnMobileStudentContext;
  sessionId: string;
  answers: Array<{ questionId: string; answer: string }>;
  elapsedSeconds?: number;
}) {
  await connectToDatabase();
  const gate = await assertRevisionAccess(input.context);
  if (!gate.ok) return gate;

  const topicId = parseRevisionSessionId(input.sessionId);
  if (!topicId) {
    return {
      ok: false as const,
      code: "REVISION_TOPIC_NOT_FOUND",
      message: "Invalid revision session.",
      status: 400,
    };
  }

  const topicResult = await buildMobileRevisionTopicDetail(input.context, topicId);
  if (!topicResult.ok) return topicResult;

  const questions = await buildQuestionsForTopic(input.context, topicId);
  const answerMap = new Map(input.answers.map((a) => [a.questionId, a.answer]));

  let correctCount = 0;
  const improved: string[] = [];
  const stillNeedsWork: string[] = [];

  for (const question of questions) {
    const given = answerMap.get(question.id);
    const normalizedGiven = given ? normalizeAnswer(given) : "";
    const normalizedCorrect = normalizeAnswer(question.correctAnswer);
    const isCorrect =
      normalizedGiven === normalizedCorrect ||
      (question.type === "short_answer" &&
        normalizedGiven.length > 2 &&
        normalizedCorrect.includes(normalizedGiven));

    if (isCorrect) {
      correctCount += 1;
      improved.push(`Strong on: ${question.prompt.slice(0, 72)}`);
    } else {
      stillNeedsWork.push(question.explanation.slice(0, 120));
    }
  }

  const totalCount = questions.length;
  const scorePercent = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
  const masteryBefore = topicResult.data.masteryPercent;
  const masteryAfter = Math.min(100, Math.round(masteryBefore * 0.55 + scorePercent * 0.45));
  const recommendedNextStep = recommendedActionFor(
    severityFromMastery(masteryAfter),
    Boolean(topicResult.data.relatedFlashcardDeckId)
  );

  await recordLearnMobileActivity({
    schoolId: input.context.schoolId,
    studentId: input.context.studentId,
    accountId: input.context.accountId,
    gradeId: input.context.gradeId,
    classGroupId: input.context.classGroupId,
    eventType: "revision_session",
    topic: topicResult.data.title,
    score: scorePercent,
    durationSeconds: input.elapsedSeconds ?? null,
    metadata: {
      sessionId: input.sessionId,
      topicId,
      correctCount,
      totalCount,
      masteryBefore,
      masteryAfter,
    },
  });

  return {
    ok: true as const,
    data: {
      sessionId: input.sessionId,
      topicId,
      scorePercent,
      correctCount,
      totalCount,
      masteryBefore,
      masteryAfter,
      improved: improved.slice(0, 3),
      stillNeedsWork: stillNeedsWork.slice(0, 3),
      recommendedNextStep,
    },
  };
}
