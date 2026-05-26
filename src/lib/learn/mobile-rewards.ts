import "server-only";

import { connectToDatabase } from "@/db/connectToDatabase";
import type { LearnMobileStudentContext } from "@/lib/learn/mobile-auth";
import { getStudentLearnAccess } from "@/lib/learn/access";
import {
  ActivityRow,
  computeStreakDays,
  computeBestStreakDays,
  formatActivityWin,
  levelFromXp,
  xpForEvent,
} from "@/lib/learn/mobile-learn-progress";
import {
  loadMobileStudentBundle,
  serializeMobileLoginStudent,
} from "@/lib/learn/mobile-student-profile";
import { LearnActivityEvent } from "@/models/LearnActivityEvent";

type BadgeDef = {
  id: string;
  name: string;
  description: string;
  category: "streak" | "mastery" | "quest" | "improvement" | "exam_prep";
  earnedWhen: (stats: ActivityStats) => boolean;
  progressWhen: (stats: ActivityStats) => number;
};

type ActivityStats = {
  streakDays: number;
  questCount: number;
  flashcardCount: number;
  revisionCount: number;
  examPrepCount: number;
  languageCount: number;
  exploreCount: number;
  exploreCompletedCount: number;
};

const BADGE_DEFS: BadgeDef[] = [
  {
    id: "badge-streak-3",
    name: "3-Day Spark",
    description: "Practiced for three days in a row.",
    category: "streak",
    earnedWhen: (s) => s.streakDays >= 3,
    progressWhen: (s) => Math.min(100, Math.round((s.streakDays / 3) * 100)),
  },
  {
    id: "badge-streak-5",
    name: "5-Day Fire",
    description: "Practiced for five days in a row.",
    category: "streak",
    earnedWhen: (s) => s.streakDays >= 5,
    progressWhen: (s) => Math.min(100, Math.round((s.streakDays / 5) * 100)),
  },
  {
    id: "badge-quest-starter",
    name: "Quest Starter",
    description: "Completed your first learning quest.",
    category: "quest",
    earnedWhen: (s) => s.questCount >= 1,
    progressWhen: (s) => Math.min(100, s.questCount >= 1 ? 100 : 0),
  },
  {
    id: "badge-quest-hero",
    name: "Quest Hero",
    description: "Completed five learning quests.",
    category: "quest",
    earnedWhen: (s) => s.questCount >= 5,
    progressWhen: (s) => Math.min(100, Math.round((s.questCount / 5) * 100)),
  },
  {
    id: "badge-flashcard-focus",
    name: "Flashcard Focus",
    description: "Reviewed flashcards ten times.",
    category: "mastery",
    earnedWhen: (s) => s.flashcardCount >= 10,
    progressWhen: (s) => Math.min(100, Math.round((s.flashcardCount / 10) * 100)),
  },
  {
    id: "badge-revision-hero",
    name: "Revision Hero",
    description: "Finished three revision sessions.",
    category: "improvement",
    earnedWhen: (s) => s.revisionCount >= 3,
    progressWhen: (s) => Math.min(100, Math.round((s.revisionCount / 3) * 100)),
  },
  {
    id: "badge-exam-ready",
    name: "Exam Ready",
    description: "Completed two exam prep practice sessions.",
    category: "exam_prep",
    earnedWhen: (s) => s.examPrepCount >= 2,
    progressWhen: (s) => Math.min(100, Math.round((s.examPrepCount / 2) * 100)),
  },
  {
    id: "badge-language-learner",
    name: "Language Learner",
    description: "Practiced a Ghanaian language twice.",
    category: "improvement",
    earnedWhen: (s) => s.languageCount >= 2,
    progressWhen: (s) => Math.min(100, Math.round((s.languageCount / 2) * 100)),
  },
  {
    id: "badge-curious-path",
    name: "Curious Path",
    description: "Completed three Explore missions with Leo.",
    category: "mastery",
    earnedWhen: (s) => s.exploreCompletedCount >= 3,
    progressWhen: (s) =>
      Math.min(100, Math.round((s.exploreCompletedCount / 3) * 100)),
  },
];

function buildStats(monthEvents: ActivityRow[]): ActivityStats {
  const counts = {
    questCount: 0,
    flashcardCount: 0,
    revisionCount: 0,
    examPrepCount: 0,
    languageCount: 0,
    exploreCount: 0,
    exploreCompletedCount: 0,
  };

  for (const event of monthEvents) {
    if (event.eventType === "quest_completed") counts.questCount += 1;
    if (event.eventType === "flashcard_reviewed") counts.flashcardCount += 1;
    if (event.eventType === "revision_session") counts.revisionCount += 1;
    if (event.eventType === "exam_prep_practice") counts.examPrepCount += 1;
    if (event.eventType === "language_practice") counts.languageCount += 1;
    if (event.eventType === "explore_with_leo") {
      counts.exploreCount += 1;
      if (event.metadata?.phase === "completed") {
        counts.exploreCompletedCount += 1;
      }
    }
  }

  const streakDays = computeStreakDays(
    monthEvents.filter((e) => e.eventType !== "login").map((e) => e.occurredAt)
  );

  return { streakDays, ...counts };
}

function buildBadges(stats: ActivityStats) {
  return BADGE_DEFS.map((def) => {
    const earned = def.earnedWhen(stats);
    return {
      id: def.id,
      name: def.name,
      description: def.description,
      category: def.category,
      status: earned ? ("earned" as const) : ("locked" as const),
      progressPercent: earned ? 100 : def.progressWhen(stats),
    };
  });
}

function buildWeeklyWins(weekEvents: ActivityRow[]) {
  const questXp = weekEvents
    .filter((e) => e.eventType === "quest_completed")
    .reduce((sum, e) => sum + xpForEvent(e), 0);
  const flashcardXp = weekEvents
    .filter((e) => e.eventType === "flashcard_reviewed")
    .reduce((sum, e) => sum + xpForEvent(e), 0);
  const revisionXp = weekEvents
    .filter((e) => e.eventType === "revision_session" || e.eventType === "exam_prep_practice")
    .reduce((sum, e) => sum + xpForEvent(e), 0);

  const wins: Array<{ id: string; title: string; description: string; xpEarned: number }> = [];

  const questCount = weekEvents.filter((e) => e.eventType === "quest_completed").length;
  if (questCount > 0) {
    wins.push({
      id: "win-quests",
      title: `${questCount} quest${questCount === 1 ? "" : "s"} completed`,
      description: "You kept showing up for short learning sessions.",
      xpEarned: questXp,
    });
  }

  const flashcardCount = weekEvents.filter((e) => e.eventType === "flashcard_reviewed").length;
  if (flashcardCount > 0) {
    wins.push({
      id: "win-flashcards",
      title: "Flashcard practice",
      description: `You reviewed cards ${flashcardCount} time${flashcardCount === 1 ? "" : "s"} this week.`,
      xpEarned: flashcardXp,
    });
  }

  const revisionCount = weekEvents.filter(
    (e) => e.eventType === "revision_session" || e.eventType === "exam_prep_practice"
  ).length;
  if (revisionCount > 0) {
    wins.push({
      id: "win-revision",
      title: "Revision momentum",
      description: "You strengthened topics before your next class check.",
      xpEarned: revisionXp,
    });
  }

  if (wins.length === 0 && weekEvents.length > 0) {
    const sample = weekEvents[0];
    wins.push({
      id: "win-progress",
      title: "Learning progress",
      description: formatActivityWin(sample),
      xpEarned: xpForEvent(sample),
    });
  }

  return wins;
}

export async function buildMobileRewards(context: LearnMobileStudentContext) {
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

  if (!bundle) {
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

  const [weekEvents, monthEvents] = await Promise.all([
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
      eventType: { $ne: "login" },
    })
      .sort({ occurredAt: -1 })
      .limit(200)
      .lean<ActivityRow[]>(),
  ]);

  const monthXp = monthEvents.reduce((sum, e) => sum + xpForEvent(e), 0);
  const weekXp = weekEvents.reduce((sum, e) => sum + xpForEvent(e), 0);
  const { level, levelTitle, nextLevelXp } = levelFromXp(monthXp);
  const stats = buildStats(monthEvents);
  const badges = buildBadges(stats);
  const earnedBadges = badges.filter((b) => b.status === "earned");
  const latestUnlock = earnedBadges.length > 0 ? earnedBadges[earnedBadges.length - 1] : null;

  const profile = serializeMobileLoginStudent(bundle);
  const displayName = profile.displayName || profile.firstName || "Learner";
  const streakDays = stats.streakDays;
  const bestDays = computeBestStreakDays(
    monthEvents.map((e) => e.occurredAt)
  );

  return {
    ok: true as const,
    data: {
      student: { displayName, level, levelTitle },
      xp: { current: monthXp, nextLevel: nextLevelXp, weekly: weekXp },
      streak: {
        days: streakDays,
        bestDays: Math.max(bestDays, streakDays),
        status:
          streakDays > 0
            ? "One more quest keeps your learning streak alive."
            : "Start a quest today to begin your streak.",
      },
      latestUnlock,
      badges,
      weeklyWins: buildWeeklyWins(weekEvents),
    },
  };
}
