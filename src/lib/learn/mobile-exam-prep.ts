import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import type { LearnMobileStudentContext } from "@/lib/learn/mobile-auth";
import { getStudentLearnAccess } from "@/lib/learn/access";
import { recordLearnMobileActivity } from "@/lib/learn/mobile-activity";
import { buildRevisionQuestionsFromFlashcards, type RevisionQuestion } from "@/lib/learn/mobile-revision";
import { publishedStudentDeckQuery } from "@/lib/learn/student-deck-access";
import { Homework } from "@/models/Homework";
import { LearnActivityEvent } from "@/models/LearnActivityEvent";
import { LessonFlashcard } from "@/models/LessonFlashcard";
import { LessonFlashcardDeck } from "@/models/LessonFlashcardDeck";
import { LessonSession } from "@/models/LessonSession";
import { Subject } from "@/models/Subject";
import { Submission } from "@/models/Submission";

const LETTERS = ["A", "B", "C", "D"] as const;
const PRACTICE_DURATION_SECONDS = 600;

type HomeworkRow = {
  _id: Types.ObjectId;
  title: string;
  subjectId: Types.ObjectId;
  dueDate: Date;
  type: string;
  questions: Array<{
    id: string;
    prompt: string;
    explanation?: string;
    choices: Array<{ id: string; text: string; isCorrect: boolean }>;
  }>;
  sourceSessionId?: Types.ObjectId | null;
};

type ExamPracticeQuestion = {
  id: string;
  prompt: string;
  options: Array<{ id: string; letter: string; label: string }>;
  correctOptionId: string;
  explanation: string;
  topicId: string;
};

async function assertExamPrepAccess(context: LearnMobileStudentContext) {
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

export function buildExamId(homeworkId: Types.ObjectId | string) {
  return `exam-${String(homeworkId)}`;
}

export function parseExamId(examId: string): Types.ObjectId | null {
  const match = examId.match(/^exam-([a-f0-9]{24})$/i);
  if (!match?.[1] || !Types.ObjectId.isValid(match[1])) return null;
  return new Types.ObjectId(match[1]);
}

function daysLeft(date: Date, now = new Date()) {
  return Math.max(0, Math.ceil((date.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
}

function topicStatusFromMastery(masteryPercent: number): "ready" | "almost_ready" | "needs_revision" | "not_started" {
  if (masteryPercent >= 75) return "ready";
  if (masteryPercent >= 55) return "almost_ready";
  if (masteryPercent > 0) return "needs_revision";
  return "not_started";
}

function mapHomeworkToPracticeQuestions(
  homework: HomeworkRow,
  topicId: string
): ExamPracticeQuestion[] {
  return homework.questions.slice(0, 8).map((question, index) => {
    const choices = question.choices.slice(0, 4);
    const options = choices.map((choice, optIndex) => ({
      id: choice.id || `exam-${index}-opt-${optIndex}`,
      letter: LETTERS[optIndex] ?? "D",
      label: choice.text,
    }));
    const correct = choices.find((c) => c.isCorrect);
    const correctOptionId =
      options.find((opt) => opt.label === correct?.text)?.id ?? options[0]?.id ?? `exam-${index}-opt-0`;

    return {
      id: question.id || `exam-q-${index}`,
      prompt: question.prompt,
      options,
      correctOptionId,
      explanation: question.explanation || "Review this topic before test day.",
      topicId,
    };
  });
}

function revisionToPracticeQuestions(questions: RevisionQuestion[], topicId: string): ExamPracticeQuestion[] {
  return questions.map((question, index) => {
    const options = (question.options ?? [question.correctAnswer]).slice(0, 4).map((label, optIndex) => ({
      id: `${question.id}-opt-${optIndex}`,
      letter: LETTERS[optIndex] ?? "D",
      label,
    }));
    const correctOptionId =
      options.find((opt) => opt.label === question.correctAnswer)?.id ?? options[0]?.id ?? `${question.id}-opt-0`;

    return {
      id: question.id,
      prompt: question.prompt,
      options,
      correctOptionId,
      explanation: question.explanation,
      topicId,
    };
  });
}

async function loadUpcomingExamHomework(context: LearnMobileStudentContext) {
  const now = new Date();
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 45);

  return Homework.find({
    schoolId: context.schoolId,
    classGroupIds: context.classGroupId,
    status: "published",
    type: { $in: ["quiz", "practice"] },
    dueDate: { $gte: now, $lte: horizon },
    "questions.0": { $exists: true },
  })
    .sort({ dueDate: 1 })
    .limit(5)
    .lean<HomeworkRow[]>();
}

async function subjectName(schoolId: Types.ObjectId, subjectId: Types.ObjectId) {
  const row = await Subject.findOne({ _id: subjectId, schoolId })
    .select("name shortName")
    .lean<{ name?: string; shortName?: string } | null>();
  return row?.shortName || row?.name || "Subject";
}

async function buildTopicsForHomework(
  context: LearnMobileStudentContext,
  homework: HomeworkRow
): Promise<
  Array<{
    id: string;
    title: string;
    masteryPercent: number;
    status: "ready" | "almost_ready" | "needs_revision" | "not_started";
  }>
> {
  const topics: Array<{
    id: string;
    title: string;
    masteryPercent: number;
    status: "ready" | "almost_ready" | "needs_revision" | "not_started";
  }> = [];

  if (homework.sourceSessionId) {
    const session = await LessonSession.findOne({
      _id: homework.sourceSessionId,
      schoolId: context.schoolId,
    })
      .select("title")
      .lean<{ title?: string } | null>();

    const submission = await Submission.findOne({
      schoolId: context.schoolId,
      studentId: context.studentId,
      homeworkId: homework._id,
    })
      .select("score questionResponses")
      .lean<{
        score?: number;
        questionResponses?: Array<{ isCorrect?: boolean }>;
      } | null>();

    let mastery = 45;
    if (submission) {
      const total = homework.questions.length || 1;
      const missed = submission.questionResponses?.filter((r) => r.isCorrect === false).length ?? 0;
      mastery =
        typeof submission.score === "number"
          ? Math.round(submission.score)
          : Math.round(((total - missed) / total) * 100);
    }

    topics.push({
      id: `topic-${String(homework.sourceSessionId)}`,
      title: session?.title || homework.title,
      masteryPercent: mastery,
      status: topicStatusFromMastery(mastery),
    });
  }

  const chunkSize = Math.max(1, Math.ceil(homework.questions.length / 3));
  homework.questions.slice(0, 9).forEach((question, index) => {
    if (index % chunkSize !== 0 && topics.length >= 3) return;
    const pseudoMastery = Math.max(20, 78 - index * 14);
    topics.push({
      id: `topic-q-${question.id}`,
      title: question.prompt.slice(0, 48),
      masteryPercent: pseudoMastery,
      status: topicStatusFromMastery(pseudoMastery),
    });
  });

  return topics.slice(0, 6);
}

async function computeReadiness(
  context: LearnMobileStudentContext,
  homework: HomeworkRow,
  topics: Array<{ masteryPercent: number }>
) {
  const submission = await Submission.findOne({
    schoolId: context.schoolId,
    studentId: context.studentId,
    homeworkId: homework._id,
    status: { $in: ["graded", "submitted", "late"] },
  })
    .select("score")
    .lean<{ score?: number } | null>();

  const practiceEvents = await LearnActivityEvent.find({
    schoolId: context.schoolId,
    studentId: context.studentId,
    eventType: "exam_prep_practice",
    topic: homework.title,
  })
    .sort({ occurredAt: -1 })
    .limit(3)
    .select("score")
    .lean<Array<{ score?: number | null }>>();

  const topicAvg =
    topics.length > 0
      ? Math.round(topics.reduce((sum, t) => sum + t.masteryPercent, 0) / topics.length)
      : 50;

  let readiness = topicAvg;
  if (typeof submission?.score === "number") {
    readiness = Math.round(readiness * 0.5 + submission.score * 0.5);
  }
  if (practiceEvents.length > 0) {
    const last = practiceEvents[0].score;
    if (typeof last === "number") {
      readiness = Math.round(readiness * 0.7 + last * 0.3);
    }
  }

  return Math.max(12, Math.min(96, readiness));
}

async function buildExamPlan(context: LearnMobileStudentContext, homework: HomeworkRow) {
  const subjectNameValue = await subjectName(context.schoolId, homework.subjectId);
  const topics = await buildTopicsForHomework(context, homework);
  const readinessScore = await computeReadiness(context, homework, topics);
  const weakTopics = topics.filter(
    (t) => t.status === "needs_revision" || t.status === "not_started"
  );

  return {
    id: buildExamId(homework._id),
    examTitle: homework.title,
    subjectId: String(homework.subjectId),
    subjectName: subjectNameValue,
    examDate: homework.dueDate.toISOString(),
    readinessScore,
    daysLeft: daysLeft(homework.dueDate),
    topics,
    recommendedActions: [
      {
        id: `action-revise-${String(homework._id)}`,
        title: weakTopics[0] ? `Revise ${weakTopics[0].title}` : "Revise weak topics",
        description: "Review class examples before timed practice.",
        estimatedMinutes: 8,
        actionType: "revise" as const,
      },
      {
        id: `action-practice-${String(homework._id)}`,
        title: "Try timed practice",
        description: "Answer a short quiz under gentle time pressure.",
        estimatedMinutes: 10,
        actionType: "practice" as const,
      },
      {
        id: `action-leo-${String(homework._id)}`,
        title: "Ask Leo for examples",
        description: "Get simple explanations without final-answer shortcuts.",
        estimatedMinutes: 4,
        actionType: "ask_leo" as const,
      },
    ],
    leoStudyTip:
      weakTopics.length > 0
        ? `Leo suggests starting with ${weakTopics[0].title}, then doing a short timed practice.`
        : "Leo suggests one calm timed practice to build confidence before test day.",
  };
}

export async function buildMobileExamPrepList(context: LearnMobileStudentContext) {
  await connectToDatabase();
  const gate = await assertExamPrepAccess(context);
  if (!gate.ok) return gate;

  const rows = await loadUpcomingExamHomework(context);
  if (rows.length === 0) {
    return {
      ok: false as const,
      code: "NO_EXAM_PREP_AVAILABLE",
      message: "No upcoming exam prep available.",
      status: 404,
    };
  }

  const exams = await Promise.all(rows.map((row) => buildExamPlan(context, row)));

  return {
    ok: true as const,
    data: {
      exams,
      primaryExamId: exams[0]?.id ?? null,
    },
  };
}

export async function buildMobileExamPrepDetail(
  context: LearnMobileStudentContext,
  examId: string
) {
  await connectToDatabase();
  const gate = await assertExamPrepAccess(context);
  if (!gate.ok) return gate;

  const homeworkId = parseExamId(examId);
  if (!homeworkId) {
    return {
      ok: false as const,
      code: "NO_EXAM_PREP_AVAILABLE",
      message: "Exam prep not found.",
      status: 404,
    };
  }

  const homework = await Homework.findOne({
    _id: homeworkId,
    schoolId: context.schoolId,
    classGroupIds: context.classGroupId,
    status: "published",
    type: { $in: ["quiz", "practice"] },
  }).lean<HomeworkRow | null>();

  if (!homework) {
    return {
      ok: false as const,
      code: "NO_EXAM_PREP_AVAILABLE",
      message: "Exam prep not found.",
      status: 404,
    };
  }

  return { ok: true as const, data: await buildExamPlan(context, homework) };
}

/** Primary exam plan for the exam prep home screen. */
export async function buildMobileExamPrepPrimary(context: LearnMobileStudentContext) {
  const list = await buildMobileExamPrepList(context);
  if (!list.ok) return list;
  return { ok: true as const, data: list.data.exams[0] };
}

async function buildPracticeQuestionsForExam(
  context: LearnMobileStudentContext,
  homework: HomeworkRow
): Promise<ExamPracticeQuestion[]> {
  if (homework.questions.length > 0) {
    const topicId = homework.sourceSessionId
      ? `topic-${String(homework.sourceSessionId)}`
      : `topic-${String(homework._id)}`;
    return mapHomeworkToPracticeQuestions(homework, topicId);
  }

  if (homework.sourceSessionId && context.classGroupId) {
    const deck = await LessonFlashcardDeck.findOne(
      publishedStudentDeckQuery({
        schoolId: context.schoolId,
        classGroupId: context.classGroupId,
        sessionId: homework.sourceSessionId,
      })
    )
      .select("_id")
      .lean<{ _id: Types.ObjectId } | null>();

    if (deck) {
      const cards = await LessonFlashcard.find({ schoolId: context.schoolId, deckId: deck._id })
        .sort({ order: 1 })
        .limit(12)
        .select("_id front back order")
        .lean<Array<{ _id: Types.ObjectId; front: string; back: string; order: number }>>();

      const revisionQs = buildRevisionQuestionsFromFlashcards(cards);
      return revisionToPracticeQuestions(
        revisionQs,
        `topic-${String(homework.sourceSessionId)}`
      );
    }
  }

  return [];
}

export async function startMobileExamPractice(
  context: LearnMobileStudentContext,
  examId: string
) {
  const detail = await buildMobileExamPrepDetail(context, examId);
  if (!detail.ok) return detail;

  const homeworkId = parseExamId(examId);
  if (!homeworkId) {
    return {
      ok: false as const,
      code: "NO_EXAM_PREP_AVAILABLE",
      message: "Exam prep not found.",
      status: 404,
    };
  }

  const homework = await Homework.findOne({
    _id: homeworkId,
    schoolId: context.schoolId,
    classGroupIds: context.classGroupId,
    status: "published",
  }).lean<HomeworkRow | null>();

  if (!homework) {
    return {
      ok: false as const,
      code: "NO_EXAM_PREP_AVAILABLE",
      message: "Exam prep not found.",
      status: 404,
    };
  }

  const questions = await buildPracticeQuestionsForExam(context, homework);
  if (questions.length === 0) {
    return {
      ok: false as const,
      code: "NO_EXAM_PREP_AVAILABLE",
      message: "Practice questions are not ready yet.",
      status: 404,
    };
  }

  const sessionId = `practice-${examId}-${Date.now()}`;

  await recordLearnMobileActivity({
    schoolId: context.schoolId,
    studentId: context.studentId,
    accountId: context.accountId,
    gradeId: context.gradeId,
    classGroupId: context.classGroupId,
    eventType: "exam_prep_practice",
    topic: homework.title,
    metadata: { phase: "practice_started", sessionId, examId },
  });

  return {
    ok: true as const,
    data: {
      id: sessionId,
      examId,
      durationSeconds: PRACTICE_DURATION_SECONDS,
      questions,
    },
  };
}

export async function submitMobileExamPractice(input: {
  context: LearnMobileStudentContext;
  examId: string;
  answers: Array<{ questionId: string; optionId: string }>;
  elapsedSeconds?: number;
}) {
  const detail = await buildMobileExamPrepDetail(input.context, input.examId);
  if (!detail.ok) return detail;

  const homeworkId = parseExamId(input.examId);
  if (!homeworkId || !input.context.classGroupId) {
    return {
      ok: false as const,
      code: "NO_EXAM_PREP_AVAILABLE",
      message: "Invalid exam prep.",
      status: 400,
    };
  }

  const homework = await Homework.findOne({
    _id: homeworkId,
    schoolId: input.context.schoolId,
    classGroupIds: input.context.classGroupId,
    status: "published",
  }).lean<HomeworkRow | null>();

  if (!homework) {
    return {
      ok: false as const,
      code: "NO_EXAM_PREP_AVAILABLE",
      message: "Exam prep not found.",
      status: 404,
    };
  }

  const questions = await buildPracticeQuestionsForExam(input.context, homework);
  const answerMap = new Map(input.answers.map((a) => [a.questionId, a.optionId]));

  let correctCount = 0;
  for (const question of questions) {
    if (answerMap.get(question.id) === question.correctOptionId) {
      correctCount += 1;
    }
  }

  const totalCount = questions.length;
  const scorePercent = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
  const readinessBefore = detail.data.readinessScore;
  const readinessAfter = Math.min(100, Math.round(readinessBefore * 0.55 + scorePercent * 0.45));
  const weakTopics = detail.data.topics.filter(
    (t) => t.status === "needs_revision" || t.status === "not_started"
  );

  await recordLearnMobileActivity({
    schoolId: input.context.schoolId,
    studentId: input.context.studentId,
    accountId: input.context.accountId,
    gradeId: input.context.gradeId,
    classGroupId: input.context.classGroupId,
    eventType: "exam_prep_practice",
    topic: homework.title,
    score: scorePercent,
    durationSeconds: input.elapsedSeconds ?? null,
    metadata: {
      examId: input.examId,
      correctCount,
      totalCount,
      readinessBefore,
      readinessAfter,
    },
  });

  return {
    ok: true as const,
    data: {
      examId: input.examId,
      scorePercent,
      correctCount,
      totalCount,
      readinessBefore,
      readinessAfter,
      weakTopics,
      recommendedActions: detail.data.recommendedActions,
    },
  };
}
