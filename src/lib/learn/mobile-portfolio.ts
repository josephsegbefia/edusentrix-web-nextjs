import "server-only";

import { connectToDatabase } from "@/db/connectToDatabase";
import type { LearnMobileStudentContext } from "@/lib/learn/mobile-auth";
import { getStudentLearnAccess } from "@/lib/learn/access";
import {
  ActivityRow,
  computeStreakDays,
  formatActivityWin,
  levelFromXp,
  timelineTypeFromEvent,
  xpForEvent,
} from "@/lib/learn/mobile-learn-progress";
import {
  loadMobileStudentBundle,
  serializeMobileLoginStudent,
} from "@/lib/learn/mobile-student-profile";
import { LearnActivityEvent } from "@/models/LearnActivityEvent";
import { LessonFlashcardDeck } from "@/models/LessonFlashcardDeck";
import { StudentFlashcardProgress } from "@/models/StudentFlashcardProgress";
import { SubjectOffering } from "@/models/SubjectOffering";

function achievementFromEvent(event: ActivityRow, index: number) {
  const titleMap: Record<string, string> = {
    quest_completed: "Quest completed",
    flashcard_reviewed: "Flashcard focus",
    revision_session: "Revision hero moment",
    exam_prep_practice: "Exam prep practice",
    explore_with_leo: "Explorer badge",
    language_practice: "Language learner",
  };

  return {
    id: `achievement-${event.eventType}-${index}`,
    title: titleMap[event.eventType] ?? "Learning milestone",
    description: formatActivityWin(event),
    earnedAt: event.occurredAt.toISOString(),
    category: mapAchievementCategory(event.eventType),
    evidence: [formatActivityWin(event)],
  };
}

function mapAchievementCategory(
  eventType: ActivityRow["eventType"]
): "streak" | "mastery" | "quiz" | "revision" | "flashcards" | "special" {
  switch (eventType) {
    case "quest_completed":
      return "quiz";
    case "flashcard_reviewed":
      return "flashcards";
    case "revision_session":
    case "exam_prep_practice":
      return "revision";
    default:
      return "special";
  }
}

export async function buildMobilePortfolio(context: LearnMobileStudentContext) {
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

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const [events, deckStats] = await Promise.all([
    LearnActivityEvent.find({
      schoolId: context.schoolId,
      studentId: context.studentId,
      occurredAt: { $gte: ninetyDaysAgo },
      eventType: { $ne: "login" },
    })
      .sort({ occurredAt: -1 })
      .limit(120)
      .lean<ActivityRow[]>(),
    StudentFlashcardProgress.aggregate<{
      _id: { toString(): string };
      total: number;
      known: number;
      needsReview: number;
    }>([
      { $match: { schoolId: context.schoolId, studentId: context.studentId } },
      {
        $group: {
          _id: "$deckId",
          total: { $sum: 1 },
          known: {
            $sum: { $cond: [{ $eq: ["$status", "known"] }, 1, 0] },
          },
          needsReview: {
            $sum: { $cond: [{ $in: ["$status", ["needs_review", "learning"]] }, 1, 0] },
          },
        },
      },
      { $sort: { known: -1 } },
      { $limit: 8 },
    ]),
  ]);

  const totalXp = events.reduce((sum, e) => sum + xpForEvent(e), 0);
  const { level, levelTitle } = levelFromXp(totalXp);
  const streakDays = computeStreakDays(events.map((e) => e.occurredAt));
  const questEvents = events.filter((e) => e.eventType === "quest_completed");
  const studyMinutes = Math.round(
    events.reduce((sum, e) => sum + (e.durationSeconds || 180), 0) / 60
  );

  const profile = serializeMobileLoginStudent(bundle);
  const displayName = profile.displayName || profile.firstName || "Learner";

  const deckIds = deckStats.map((row) => row._id);
  const decks =
    deckIds.length > 0
      ? await LessonFlashcardDeck.find({ _id: { $in: deckIds }, schoolId: context.schoolId })
          .select("title subjectOfferingId")
          .lean<
            Array<{
              _id: { toString(): string };
              title: string;
              subjectOfferingId?: { toString(): string };
            }>
          >()
      : [];

  const deckMap = new Map(decks.map((d) => [String(d._id), d]));
  const offeringIds = [
    ...new Set(
      decks
        .map((d) => (d.subjectOfferingId ? String(d.subjectOfferingId) : null))
        .filter(Boolean) as string[]
    ),
  ];

  const offerings =
    offeringIds.length > 0
      ? await SubjectOffering.find({
          _id: { $in: offeringIds },
          schoolId: context.schoolId,
        })
          .select("displayName shortName")
          .lean<Array<{ _id: { toString(): string }; displayName: string; shortName?: string }>>()
      : [];

  const offeringName = new Map(
    offerings.map((o) => [String(o._id), o.shortName || o.displayName || "Subject"])
  );

  const strongestSubjects = deckStats.slice(0, 3).map((row, index) => {
    const deck = deckMap.get(String(row._id));
    const masteryPercent =
      row.total > 0 ? Math.round((row.known / row.total) * 100) : 0;
    const subjectName = deck?.subjectOfferingId
      ? offeringName.get(String(deck.subjectOfferingId)) ?? "Subject practice"
      : "Flashcard practice";

    return {
      id: `subject-${index}`,
      subjectName,
      masteryPercent,
      highlight:
        row.needsReview > 0
          ? "Strong effort — a few cards still need another round."
          : "Great consistency in this subject.",
    };
  });

  const improvedTopics = deckStats
    .filter((row) => row.needsReview > 0 && row.total > 0)
    .slice(0, 3)
    .map((row, index) => {
      const deck = deckMap.get(String(row._id));
      const mastery = Math.round((row.known / row.total) * 100);
      return {
        id: `improved-${index}`,
        title: deck?.title ?? "Topic practice",
        subjectName: deck?.subjectOfferingId
          ? offeringName.get(String(deck.subjectOfferingId)) ?? "Subject"
          : "Subject",
        masteryBefore: Math.max(20, mastery - 12),
        masteryAfter: mastery,
        note: "Your practice is moving in the right direction.",
      };
    });

  const completedQuests = questEvents.slice(0, 8).map((event, index) => ({
    id: `quest-${index}-${event.occurredAt.getTime()}`,
    title: event.topic?.trim() || "Learning quest",
    subjectName:
      typeof event.metadata?.subjectName === "string"
        ? event.metadata.subjectName
        : "Class lesson",
    completedAt: event.occurredAt.toISOString(),
    xpEarned: xpForEvent(event),
  }));

  const achievements = events
    .filter((e) =>
      ["quest_completed", "revision_session", "flashcard_reviewed", "language_practice"].includes(
        e.eventType
      )
    )
    .slice(0, 6)
    .map((event, index) => achievementFromEvent(event, index));

  const timeline = events.slice(0, 12).map((event, index) => ({
    id: `timeline-${index}-${event.occurredAt.getTime()}`,
    title: formatActivityWin(event),
    description: "Saved from your EduSentrix Learn activity.",
    occurredAt: event.occurredAt.toISOString(),
    type: timelineTypeFromEvent(event.eventType),
  }));

  const earnedBadgeCount = achievements.length;

  return {
    ok: true as const,
    data: {
      studentId: profile.studentId,
      summary: {
        displayName,
        schoolName: bundle.school.name,
        gradeName: bundle.grade?.name ?? "Your grade",
        classGroupName: bundle.classGroup?.name ?? "Your class",
        level,
        levelTitle,
        totalXp,
        completedQuests: questEvents.length,
        badgesEarned: earnedBadgeCount,
        studyMinutes,
        currentStreakDays: streakDays,
      },
      achievements,
      completedQuests,
      improvedTopics,
      strongestSubjects,
      workSamples: [
        {
          id: "work-sample-coming-soon",
          title: "Teacher-reviewed work",
          subjectName: "Portfolio",
          status: "coming_soon" as const,
          description: "Saved projects and teacher feedback will appear here later.",
        },
      ],
      timeline,
    },
  };
}
