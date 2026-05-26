import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import type { LearnMobileStudentContext } from "@/lib/learn/mobile-auth";
import {
  loadMobileStudentBundle,
  serializeMobileLoginStudent,
} from "@/lib/learn/mobile-student-profile";
import { getStudentLearnAccess } from "@/lib/learn/access";
import { generateDailyQuestBoardForStudent } from "@/lib/learn/daily-quest";
import { LearnActivityEvent, type ILearnActivityEvent } from "@/models/LearnActivityEvent";
import { LessonFlashcardDeck } from "@/models/LessonFlashcardDeck";
import {
  defaultSinceDays,
  findLatestCoveredLessonSession,
} from "@/lib/learn/covered-lesson-sessions";
import { DailyQuestItem } from "@/models/DailyQuestItem";
import { LessonSession } from "@/models/LessonSession";
import { StudentFlashcardProgress } from "@/models/StudentFlashcardProgress";
import { SubjectOffering } from "@/models/SubjectOffering";

const WEEKLY_GOAL_MINUTES = 90;
const XP_PER_QUEST = 80;
const XP_PER_FLASHCARD = 12;
const XP_PER_ACTIVITY = 10;
const XP_PER_LEVEL = 300;

const LEVEL_TITLES = [
  "Bright Starter",
  "Curious Explorer",
  "Steady Learner",
  "Revision Hero",
  "Topic Champion",
];

type SessionRow = {
  _id: Types.ObjectId;
  title: string;
  subjectOfferingId: Types.ObjectId;
  durationMinutes: number;
  scheduledDate: Date;
};

type OfferingRow = {
  _id: Types.ObjectId;
  displayName: string;
  shortName?: string;
};

type ActivityRow = Pick<
  ILearnActivityEvent,
  "eventType" | "occurredAt" | "durationSeconds" | "topic" | "metadata" | "score"
>;

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function xpForEvent(event: ActivityRow): number {
  const metaXp =
    typeof event.metadata?.xpAwarded === "number" ? event.metadata.xpAwarded : null;
  if (metaXp !== null) return metaXp;
  if (event.eventType === "quest_completed") return XP_PER_QUEST;
  if (event.eventType === "flashcard_reviewed") return XP_PER_FLASHCARD;
  return XP_PER_ACTIVITY;
}

function computeStreakDays(activityDates: Date[], now = new Date()): number {
  if (activityDates.length === 0) return 0;

  const dayKeys = new Set(activityDates.map((d) => startOfDay(d).toISOString()));
  const sorted = [...dayKeys].sort((a, b) => (a < b ? 1 : -1));

  const today = startOfDay(now);
  const latest = startOfDay(new Date(sorted[0]));
  const diffDays = Math.floor((today.getTime() - latest.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays > 1) return 0;

  let streak = 0;
  let cursor = latest;
  for (const key of sorted) {
    const day = startOfDay(new Date(key));
    if (day.getTime() !== cursor.getTime()) break;
    streak += 1;
    cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
  }
  return streak;
}

function formatRecentWin(event: ActivityRow): string {
  const topic = event.topic?.trim();
  switch (event.eventType) {
    case "quest_completed":
      return topic ? `Completed quest: ${topic}` : "Completed a learning quest";
    case "flashcard_reviewed":
      return topic ? `Reviewed flashcards for ${topic}` : "Reviewed flashcards";
    case "revision_session":
      return topic ? `Finished revision: ${topic}` : "Finished a revision session";
    case "exam_prep_practice":
      return "Practiced for an upcoming test";
    case "explore_with_leo":
      return "Explored a topic with Leo";
    case "language_practice":
      return topic ? `Practiced ${topic}` : "Practiced a Ghanaian language";
    default:
      return "Made progress in EduSentrix Learn";
  }
}

function levelFromXp(totalXp: number) {
  const level = Math.max(1, Math.floor(totalXp / XP_PER_LEVEL) + 1);
  const levelTitle = LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)];
  const nextLevelXp = level * XP_PER_LEVEL;
  return { level, levelTitle, nextLevelXp };
}

async function resolveOfferingMap(
  schoolId: Types.ObjectId,
  offeringIds: Types.ObjectId[]
) {
  if (offeringIds.length === 0) return new Map<string, string>();

  const offerings = await SubjectOffering.find({
    _id: { $in: offeringIds },
    schoolId,
  })
    .select("displayName shortName")
    .lean<OfferingRow[]>();

  return new Map(
    offerings.map((row) => [String(row._id), row.shortName || row.displayName || "Subject"])
  );
}

async function buildWeakTopic(input: {
  schoolId: Types.ObjectId;
  studentId: Types.ObjectId;
  classGroupId: Types.ObjectId;
  fallbackSubject?: string;
  fallbackTopic?: string;
}) {
  const weakCards = await StudentFlashcardProgress.countDocuments({
    schoolId: input.schoolId,
    studentId: input.studentId,
    status: "needs_review",
  });

  if (weakCards > 0) {
    const sample = await StudentFlashcardProgress.findOne({
      schoolId: input.schoolId,
      studentId: input.studentId,
      status: "needs_review",
    })
      .sort({ updatedAt: -1 })
      .select("deckId")
      .lean<{ deckId: Types.ObjectId } | null>();

    if (sample?.deckId) {
      const deck = await LessonFlashcardDeck.findOne({
        _id: sample.deckId,
        schoolId: input.schoolId,
      })
        .select("title subjectOfferingId")
        .lean<{ title?: string; subjectOfferingId?: Types.ObjectId } | null>();

      let subjectName = input.fallbackSubject || "Revision";
      if (deck?.subjectOfferingId) {
        const map = await resolveOfferingMap(input.schoolId, [deck.subjectOfferingId]);
        subjectName = map.get(String(deck.subjectOfferingId)) || subjectName;
      }

      return {
        subjectName,
        topicName: deck?.title || "Topics needing practice",
        confidencePercent: Math.max(25, 100 - Math.min(weakCards * 8, 70)),
        reason: "Some flashcards need another practice round.",
        suggestedActionLabel: "Revise weak spot",
      };
    }
  }

  if (input.fallbackTopic && input.fallbackSubject) {
    return {
      subjectName: input.fallbackSubject,
      topicName: input.fallbackTopic,
      confidencePercent: 55,
      reason: "Your latest class lesson is a great place to strengthen understanding.",
      suggestedActionLabel: "Revise this topic",
    };
  }

  return null;
}

async function buildTodayQuestBoardSummary(input: {
  schoolId: Types.ObjectId;
  studentId: Types.ObjectId;
  accountId: Types.ObjectId;
  classGroupId: Types.ObjectId;
  gradeId?: Types.ObjectId | null;
}) {
  const result = await generateDailyQuestBoardForStudent({
    schoolId: input.schoolId,
    studentId: input.studentId,
    userId: input.accountId,
    classGroupId: input.classGroupId,
    gradeId: input.gradeId ?? null,
  });

  const recommended = result.board.recommendedNextItemId
    ? await DailyQuestItem.findOne({
        _id: result.board.recommendedNextItemId,
        schoolId: input.schoolId,
        studentId: input.studentId,
      })
        .select("_id subjectName title")
        .lean<{ _id: Types.ObjectId; subjectName: string; title: string } | null>()
    : null;

  return {
    id: String(result.board._id),
    title: "Today's Quest with Leo",
    status: result.board.status,
    completionPercent: result.board.completionPercent,
    completedItems: result.board.completedItems,
    totalItems: result.board.totalItems,
    totalEstimatedMinutes: result.board.totalEstimatedMinutes,
    xpEarned: result.board.xpEarned,
    totalXpAvailable: result.board.totalXpAvailable,
    recommendedNextItemId: result.board.recommendedNextItemId
      ? String(result.board.recommendedNextItemId)
      : undefined,
    recommendedNextLabel: recommended
      ? `${recommended.subjectName} - ${recommended.title}`
      : undefined,
    streakProtected: result.board.rewards.streakProtected,
  };
}

export async function buildMobileDashboard(context: LearnMobileStudentContext) {
  await connectToDatabase();

  const access = await getStudentLearnAccess({
    schoolId: context.schoolId,
    studentId: context.studentId,
    accountId: context.accountId,
  });

  if (!access.hasAccess) {
    return {
      ok: false as const,
      code: access.schoolEligible ? "LEARN_ACCESS_REQUIRED" : "SCHOOL_NOT_ELIGIBLE",
      message: access.blockedReason || "EduSentrix Learn access is required.",
      status: 403,
    };
  }

  const bundle = await loadMobileStudentBundle({
    studentId: context.studentId,
    schoolId: context.schoolId,
    accountId: context.accountId,
  });

  if (!bundle || !context.classGroupId) {
    return {
      ok: false as const,
      code: "NO_STUDENT_PROFILE",
      message: "Student profile not found.",
      status: 404,
    };
  }

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 7);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [weekEvents, monthEvents, latestSession] = await Promise.all([
    LearnActivityEvent.find({
      schoolId: context.schoolId,
      studentId: context.studentId,
      occurredAt: { $gte: weekStart },
      eventType: { $ne: "login" },
    })
      .sort({ occurredAt: -1 })
      .limit(100)
      .lean<ActivityRow[]>(),
    LearnActivityEvent.find({
      schoolId: context.schoolId,
      studentId: context.studentId,
      occurredAt: { $gte: thirtyDaysAgo },
    })
      .sort({ occurredAt: -1 })
      .limit(200)
      .lean<ActivityRow[]>(),
    findLatestCoveredLessonSession({
      schoolId: context.schoolId,
      classGroupId: context.classGroupId,
      since: defaultSinceDays(90),
      select: "title subjectOfferingId",
    }),
  ]);

  let questCompletedWeek = 0;
  for (const event of weekEvents) {
    if (event.eventType === "quest_completed") {
      questCompletedWeek += 1;
    }
  }

  let fallbackSubject: string | undefined;
  let fallbackTopic: string | undefined;
  if (latestSession) {
    const map = await resolveOfferingMap(context.schoolId, [latestSession.subjectOfferingId]);
    fallbackSubject = map.get(String(latestSession.subjectOfferingId));
    fallbackTopic = latestSession.title;
  }

  const weakTopic = await buildWeakTopic({
    schoolId: context.schoolId,
    studentId: context.studentId,
    classGroupId: context.classGroupId,
    fallbackSubject,
    fallbackTopic,
  });

  const completedMinutes = Math.round(
    weekEvents.reduce((sum, e) => sum + (e.durationSeconds || 0), 0) / 60
  );
  const monthXp = monthEvents.reduce((sum, e) => sum + xpForEvent(e), 0);
  const weekXp = weekEvents.reduce((sum, e) => sum + xpForEvent(e), 0);
  const { level, levelTitle, nextLevelXp } = levelFromXp(monthXp);

  const streakDays = computeStreakDays(
    monthEvents.filter((e) => e.eventType !== "login").map((e) => e.occurredAt)
  );

  const studentContext = serializeMobileLoginStudent(bundle);
  const loginContext = {
    ...studentContext,
    gradeId: bundle.student.gradeId ? String(bundle.student.gradeId) : undefined,
    classGroupId: bundle.student.classGroupId ? String(bundle.student.classGroupId) : undefined,
    academicYearId: undefined,
    termId: undefined,
    schoolLogoUrl: bundle.school.logo ?? undefined,
  };

  const displayName = loginContext.displayName || loginContext.firstName;
  const todayQuestBoard = await buildTodayQuestBoardSummary({
    schoolId: context.schoolId,
    studentId: context.studentId,
    accountId: context.accountId,
    classGroupId: context.classGroupId,
    gradeId: context.gradeId,
  });
  const greetingMessage =
    todayQuestBoard.totalItems > 0
      ? `Leo has ${todayQuestBoard.totalItems} review${todayQuestBoard.totalItems === 1 ? "" : "s"} ready for today.`
      : "Your learning path will grow as your teachers publish more lessons.";

  const tutorSuggestion =
    latestSession && fallbackSubject
      ? {
          title: "Ask Leo",
          prompt: `Explain ${latestSession.title} with simple examples from everyday life.`,
          mode: "explain" as const,
          subjectName: fallbackSubject,
        }
      : null;

  const recentWins = monthEvents
    .filter((e) => e.eventType !== "login")
    .slice(0, 5)
    .map(formatRecentWin);

  const totalQuests = Math.max(questCompletedWeek + todayQuestBoard.totalItems, 1);

  return {
    ok: true as const,
    data: {
      greeting: {
        displayName,
        message: greetingMessage,
      },
      context: loginContext,
      todayQuestBoard,
      progress: {
        weeklyGoalMinutes: WEEKLY_GOAL_MINUTES,
        completedMinutes: Math.min(completedMinutes, WEEKLY_GOAL_MINUTES),
        masteryPercent: Math.min(
          100,
          Math.round((completedMinutes / WEEKLY_GOAL_MINUTES) * 100)
        ),
        completedQuests: questCompletedWeek,
        totalQuests,
        level,
        levelTitle,
      },
      weakTopic,
      tutorSuggestion,
      streakXp: {
        currentXp: monthXp,
        nextLevelXp,
        weeklyXp: weekXp,
        streakDays,
        streakStatus:
          streakDays > 0
            ? "One short quest keeps your streak glowing."
            : "Start a quest today to begin your streak.",
      },
      recentWins,
    },
    meta: {
      generatedAt: now.toISOString(),
      source: "backend",
    },
  };
}
