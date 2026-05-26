import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import type { LearnMobileStudentContext } from "@/lib/learn/mobile-auth";
import { getStudentLearnAccess } from "@/lib/learn/access";
import {
  defaultSinceDays,
  findCoveredLessonSessions,
} from "@/lib/learn/covered-lesson-sessions";
import { findReadyExploreAdventure } from "@/lib/learn/explore/explore-generation.service";
import { buildLearnQuestBoardSummary } from "@/lib/learn/mobile-learn-quest-summary";
import { buildMobileLearnWeakTopics } from "@/lib/learn/mobile-learn-weak-topics";
import type {
  MobileLearnNextBestAction,
  MobileLearnLeoRecommendation,
  MobileStudentLearnOverview,
  MobileLearnOverviewEnvelope,
} from "@/lib/learn/mobile-learn-overview.types";
import {
  loadMobileStudentBundle,
  serializeMobileLoginStudent,
} from "@/lib/learn/mobile-student-profile";
import { Homework } from "@/models/Homework";
import { LearnActivityEvent } from "@/models/LearnActivityEvent";
import { LessonFlashcardDeck } from "@/models/LessonFlashcardDeck";
import { RevisionBankItem } from "@/models/RevisionBankItem";
import { StudentFlashcardProgress } from "@/models/StudentFlashcardProgress";
import { SubjectOffering } from "@/models/SubjectOffering";
import { Teacher } from "@/models/Teacher";
import { User } from "@/models/User";

type SessionRow = {
  _id: Types.ObjectId;
  title: string;
  subjectOfferingId?: Types.ObjectId | null;
  scheduledDate: Date;
  ownerTeacherId?: Types.ObjectId | null;
  contentBlocks?: Array<{ bodyHtml?: string }>;
};

function stripHtml(html: string, maxLen = 180) {
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

function topicStatusForIndex(index: number, total: number): string {
  if (index === total - 1) return "learning";
  if (index === total - 2) return "practicing";
  if (index < total - 3) return "mastered";
  return "locked";
}

async function resolveOfferingMap(schoolId: Types.ObjectId, ids: Types.ObjectId[]) {
  if (ids.length === 0) return new Map<string, string>();
  const rows = await SubjectOffering.find({ _id: { $in: ids }, schoolId })
    .select("displayName shortName")
    .lean<Array<{ _id: Types.ObjectId; displayName: string; shortName?: string }>>();
  return new Map(
    rows.map((r) => [String(r._id), r.shortName || r.displayName || "Subject"])
  );
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

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
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

function selectNextBestAction(input: {
  questBoard: Awaited<ReturnType<typeof buildLearnQuestBoardSummary>> | null;
  urgentAssignment?: { id: string; title: string; subjectName: string; dueLabel: string };
  weakTopic?: { id: string; title: string; subjectName: string; reason: string };
  exploreUnlock?: { id: string; title: string; lessonId: string; subjectId: string };
  examNear?: { title: string; route: string; daysUntil: number };
}): MobileLearnNextBestAction | null {
  const candidates: MobileLearnNextBestAction[] = [];

  if (input.urgentAssignment) {
    candidates.push({
      id: `nba-assignment-${input.urgentAssignment.id}`,
      type: "assignment",
      title: input.urgentAssignment.title,
      subtitle: input.urgentAssignment.dueLabel,
      reason: "This school task is due soon.",
      ctaLabel: "Plan with Leo",
      route: `/(student)/assignments/${input.urgentAssignment.id}`,
      urgency: "high",
      displayPriority: 95,
      leoContext: {
        source: "learn_assignment",
        targetType: "assignment",
        targetId: input.urgentAssignment.id,
        mode: "hint",
      },
    });
  }

  if (input.questBoard && input.questBoard.completionPercent < 100 && input.questBoard.nextItem) {
    candidates.push({
      id: `nba-quest-${input.questBoard.nextItem.id}`,
      type: "quest_item",
      title: input.questBoard.nextItem.title,
      subtitle: `You are ${input.questBoard.completionPercent}% done with today's quest.`,
      reason: "Your Daily Quest Board has the next best step.",
      ctaLabel: input.questBoard.completionPercent > 0 ? "Continue Quest" : "Start Quest",
      route: input.questBoard.nextItem.route,
      routeParams: input.questBoard.nextItem.routeParams,
      estimatedMinutes: input.questBoard.nextItem.estimatedMinutes,
      xpReward: Math.max(20, input.questBoard.totalXpAvailable - input.questBoard.xpEarned),
      urgency: input.questBoard.completionPercent < 40 ? "high" : "normal",
      displayPriority: 100,
      leoContext: {
        source: "learn_overview",
        targetType: "daily_quest_board",
        boardId: input.questBoard.boardId,
      },
    });
  }

  if (input.weakTopic) {
    candidates.push({
      id: `nba-weak-${input.weakTopic.id}`,
      type: "revision",
      title: input.weakTopic.title,
      subtitle: input.weakTopic.subjectName,
      reason: input.weakTopic.reason,
      ctaLabel: "Rescue review",
      route: "/(student)/revision",
      estimatedMinutes: 5,
      urgency: "normal",
      displayPriority: 70,
      leoContext: {
        source: "learn_weak_topic",
        targetType: "weak_topic",
        targetId: input.weakTopic.id,
        mode: "revise",
      },
    });
  }

  if (input.exploreUnlock) {
    candidates.push({
      id: `nba-explore-${input.exploreUnlock.id}`,
      type: "explore",
      title: input.exploreUnlock.title,
      subtitle: "A safe adventure is ready.",
      reason: "You can go deeper from a lesson you covered well.",
      ctaLabel: "Open Explore",
      route: "/(student)/explore",
      routeParams: {
        lessonId: input.exploreUnlock.lessonId,
        subjectId: input.exploreUnlock.subjectId,
        source: "learn_explore_unlock",
      },
      urgency: "low",
      displayPriority: 50,
    });
  }

  if (input.examNear) {
    candidates.push({
      id: "nba-exam-prep",
      type: "exam_prep",
      title: input.examNear.title,
      subtitle: `${input.examNear.daysUntil} days until your test`,
      reason: "A short drill now can boost confidence.",
      ctaLabel: "Start exam prep",
      route: input.examNear.route,
      urgency: input.examNear.daysUntil <= 3 ? "high" : "normal",
      displayPriority: input.examNear.daysUntil <= 7 ? 85 : 45,
    });
  }

  if (candidates.length === 0) {
    return {
      id: "nba-explore-default",
      type: "explore",
      title: "Explore something new with Leo",
      subtitle: "Optional adventures from your class lessons.",
      reason: "You are caught up on required reviews.",
      ctaLabel: "Open Explore",
      route: "/(student)/explore",
      urgency: "low",
      displayPriority: 10,
    };
  }

  return candidates.sort((a, b) => b.displayPriority - a.displayPriority)[0];
}

function buildLeoRecommendations(input: {
  weakTopic?: { id: string; title: string; subjectName: string; reason: string };
  questBoard: Awaited<ReturnType<typeof buildLearnQuestBoardSummary>> | null;
  exploreUnlock?: { id: string; title: string; lessonId: string; subjectId: string };
  assignment?: { id: string; title: string };
  examDays?: number;
}): MobileLearnLeoRecommendation[] {
  const recs: MobileLearnLeoRecommendation[] = [];

  if (input.weakTopic) {
    recs.push({
      id: "leo-weak-topic",
      type: "weak_topic",
      title: `${input.weakTopic.title} needs a quick rescue`,
      message: "Try a 5-minute rescue review with Leo.",
      reason: input.weakTopic.reason,
      ctaLabel: "Ask Leo",
      action: "open_leo",
      targetId: input.weakTopic.id,
      context: {
        source: "learn_overview",
        targetType: "weak_topic",
        mode: "revise",
      },
      priority: "high",
    });
  }

  if (input.questBoard && input.questBoard.completionPercent < 100) {
    recs.push({
      id: "leo-finish-quest",
      type: "daily_quest_next",
      title: "Finish today's quest board",
      message: `${input.questBoard.totalRequiredItems - input.questBoard.completedRequiredItems} more review${input.questBoard.totalRequiredItems - input.questBoard.completedRequiredItems === 1 ? "" : "s"} to go.`,
      reason: "Small steps today make revision easier later.",
      ctaLabel: "View Quest Board",
      action: "open_daily_quest",
      priority: "normal",
    });
  }

  if (input.exploreUnlock) {
    recs.push({
      id: "leo-explore-unlock",
      type: "explore_unlock",
      title: "Go deeper with Explore",
      message: input.exploreUnlock.title,
      reason: "Explore helps you connect lessons to real life.",
      ctaLabel: "Open Explore",
      action: "open_explore",
      targetId: input.exploreUnlock.id,
      context: {
        lessonId: input.exploreUnlock.lessonId,
        subjectId: input.exploreUnlock.subjectId,
        source: "learn_explore_unlock",
      },
      priority: "normal",
    });
  }

  if (input.assignment) {
    recs.push({
      id: "leo-assignment-plan",
      type: "assignment_plan",
      title: "Plan your assignment calmly",
      message: input.assignment.title,
      reason: "Leo can help you understand and plan your own work.",
      ctaLabel: "Ask Leo",
      action: "open_leo",
      targetId: input.assignment.id,
      context: { source: "learn_assignment", mode: "hint" },
      priority: "normal",
    });
  }

  if (input.examDays !== undefined && input.examDays <= 14) {
    recs.push({
      id: "leo-exam-prep",
      type: "exam_prep",
      title: "Exam prep reminder",
      message: `Your test is in ${input.examDays} days.`,
      reason: "Short practice now builds confidence.",
      ctaLabel: "Open exam prep",
      action: "open_exam_prep",
      priority: input.examDays <= 5 ? "high" : "normal",
    });
  }

  return recs.slice(0, 3);
}

function buildMoreLearningModes(): MobileStudentLearnOverview["moreLearningModes"] {
  return [
    {
      id: "mode-ghanaian-languages",
      title: "Ghanaian Languages",
      description: "Practice vocabulary and cultural context.",
      iconName: "chatbubbles",
      status: "enabled",
      badge: "School-selected",
      route: "/(student)/ghanaian-languages",
      displayPriority: 10,
    },
    {
      id: "mode-audio",
      title: "Audio Learning",
      description: "Listen to summaries on the move.",
      iconName: "headset",
      status: "coming_soon",
      badge: "Coming soon",
      route: "/(student)/audio",
      displayPriority: 20,
      featureFlag: "learn.audio.use",
    },
    {
      id: "mode-coding",
      title: "Coding and digital skills",
      description: "Logic games and ICT practice when enabled.",
      iconName: "code-slash",
      status: "locked",
      badge: "Premium",
      route: "/(student)/coding",
      displayPriority: 30,
      featureFlag: "learn.codingModule.use",
    },
    {
      id: "mode-exam-prep",
      title: "Exam Prep",
      description: "Topic drills for upcoming tests.",
      iconName: "school",
      status: "enabled",
      route: "/(student)/exam-prep",
      displayPriority: 5,
    },
  ];
}

export async function buildMobileLearnOverview(
  context: LearnMobileStudentContext
): Promise<
  | { ok: true; data: MobileLearnOverviewEnvelope; meta: Record<string, unknown> }
  | { ok: false; code: string; message: string; status: number }
> {
  await connectToDatabase();

  const access = await getStudentLearnAccess({
    schoolId: context.schoolId,
    studentId: context.studentId,
    accountId: context.accountId,
  });

  if (!access.hasAccess) {
    return {
      ok: false,
      code: access.schoolEligible ? "LEARN_ACCESS_REQUIRED" : "SCHOOL_NOT_ELIGIBLE",
      message: access.blockedReason || "EduSentrix Learn access is required.",
      status: 403,
    };
  }

  if (!context.classGroupId) {
    return {
      ok: false,
      code: "NO_STUDENT_PROFILE",
      message: "Student class group not found.",
      status: 404,
    };
  }

  const bundle = await loadMobileStudentBundle({
    schoolId: context.schoolId,
    studentId: context.studentId,
    accountId: context.accountId,
  });
  if (!bundle) {
    return {
      ok: false,
      code: "NO_STUDENT_PROFILE",
      message: "Student profile not found.",
      status: 404,
    };
  }
  const loginStudent = serializeMobileLoginStudent(bundle);
  const displayName = loginStudent.displayName || loginStudent.firstName || "Learner";
  const className = [loginStudent.gradeName, loginStudent.classGroupName].filter(Boolean).join(" ");
  const dateLabel = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });

  const sessions = await findCoveredLessonSessions<SessionRow>({
    schoolId: context.schoolId,
    classGroupId: context.classGroupId,
    since: defaultSinceDays(60),
    limit: 40,
    select: "_id title subjectOfferingId scheduledDate ownerTeacherId contentBlocks",
  });

  if (sessions.length === 0) {
    const generatedAt = new Date().toISOString();
    const overview: MobileStudentLearnOverview = {
      header: {
        greeting: `Good afternoon, ${displayName}`,
        subtitle: "Your learning path will appear after your teacher adds covered lessons.",
        studentName: displayName,
        className: className || undefined,
        dateLabel,
      },
      todayStats: {
        dateLabel,
        xpEarnedToday: 0,
        streakDays: 0,
        dailyQuestPercent: 0,
        requiredReviewsCompleted: 0,
        requiredReviewsTotal: 0,
        streakProtected: false,
        streakMessage: "Your streak starts when your first review is ready.",
      },
      nextBestAction: null,
      todayQuestBoard: null,
      leoRecommendations: [],
      continueLearning: [],
      practiceAndRevision: {
        weakTopics: [],
        flashcardDecks: [],
        revisionBank: {
          count: 0,
          message: "Revision Bank will fill gently when Leo saves topics for you.",
        },
      },
      assignments: [],
      subjectPaths: [],
      exploreUnlocks: [],
      examPrep: null,
      moreLearningModes: buildMoreLearningModes(),
      generatedAt,
    };

    return {
      ok: true,
      data: {
        overviewVersion: 2,
        data: overview,
      },
      meta: {
        generatedAt,
        source: "backend",
        overviewVersion: 2,
        emptyReason: "NO_COVERED_LESSONS",
      },
    };
  }

  const questSummary = await buildLearnQuestBoardSummary({
    schoolId: context.schoolId,
    studentId: context.studentId,
    accountId: context.accountId,
    classGroupId: context.classGroupId,
    gradeId: context.gradeId,
  });

  const todayStart = startOfDay(new Date());
  const todayEvents = await LearnActivityEvent.find({
    schoolId: context.schoolId,
    studentId: context.studentId,
    occurredAt: { $gte: todayStart },
  })
    .select("eventType occurredAt metadata")
    .lean<Array<{ eventType: string; occurredAt: Date; metadata?: { xpAwarded?: number } }>>();

  const monthEvents = await LearnActivityEvent.find({
    schoolId: context.schoolId,
    studentId: context.studentId,
    occurredAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
  })
    .select("occurredAt eventType")
    .lean<Array<{ occurredAt: Date; eventType: string }>>();

  const xpEarnedToday = todayEvents.reduce((sum, e) => {
    const xp = typeof e.metadata?.xpAwarded === "number" ? e.metadata.xpAwarded : 10;
    return sum + xp;
  }, 0);

  const streakDays = computeStreakDays(
    monthEvents.filter((e) => e.eventType !== "login").map((e) => e.occurredAt)
  );

  const offeringIds = [
    ...new Set(
      sessions
        .map((s) => (s.subjectOfferingId ? String(s.subjectOfferingId) : null))
        .filter((id): id is string => Boolean(id) && Types.ObjectId.isValid(id))
    ),
  ].map((id) => new Types.ObjectId(id));
  const offeringMap = await resolveOfferingMap(context.schoolId, offeringIds);

  const pathsBySubject = new Map<
    string,
    { id: string; subjectName: string; topics: Array<{ id: string; title: string; status: string }> }
  >();

  for (const session of sessions) {
    const subjectKey = session.subjectOfferingId ? String(session.subjectOfferingId) : "unknown";
    const subjectName = offeringMap.get(subjectKey) || "Subject";
    if (!pathsBySubject.has(subjectKey)) {
      pathsBySubject.set(subjectKey, { id: `path-${subjectKey}`, subjectName, topics: [] });
    }
    const path = pathsBySubject.get(subjectKey)!;
    if (path.topics.length < 6) {
      path.topics.push({
        id: `session-${String(session._id)}`,
        title: session.title,
        status: "learning",
      });
    }
  }

  const subjectPaths = [...pathsBySubject.values()].map((path) => {
    const topics = path.topics.map((topic, index) => ({
      ...topic,
      status: topicStatusForIndex(index, path.topics.length),
    }));
    const mastered = topics.filter((t) => t.status === "mastered").length;
    const masteryPercent = topics.length ? Math.round((mastered / topics.length) * 100) : 0;
    const current = topics.find((t) => t.status === "learning" || t.status === "practicing");
    const next = topics.find((t) => t.status === "locked");
    return {
      id: path.id,
      subjectId: path.id.replace("path-", ""),
      subjectName: path.subjectName,
      masteryPercent,
      currentTopic: current
        ? {
            id: current.id,
            title: current.title,
            status:
              current.status === "mastered"
                ? "mastered"
                : current.status === "needs_revision"
                  ? "needs_revision"
                  : "learning",
          }
        : undefined,
      nextTopic: next
        ? { id: next.id, title: next.title, locked: true, lockedReason: "Keep going on your current topic." }
        : undefined,
      weakTopicCount: 0,
      exploreAvailable: true,
      route: "/(student)/learn",
      leoContext: {
        source: "learn_subject_path",
        targetType: "subject_path",
        subjectId: path.id.replace("path-", ""),
      },
    };
  });

  const latest = sessions[0];
  const teacherName = latest.ownerTeacherId
    ? await teacherDisplayName(latest.ownerTeacherId)
    : "Your teacher";
  const firstBlock = latest.contentBlocks?.[0]?.bodyHtml;
  const summary = firstBlock
    ? stripHtml(firstBlock)
    : `Your class covered ${latest.title}. Revise the key ideas with Leo.`;

  const continueLearning = [
    {
      id: `session-${String(latest._id)}`,
      type: "lesson_recap",
      title: latest.title,
      subtitle: `${formatCoveredDate(latest.scheduledDate)} · ${teacherName}`,
      subjectName: latest.subjectOfferingId
        ? offeringMap.get(String(latest.subjectOfferingId)) || "Subject"
        : "Subject",
      progressPercent: 20,
      estimatedMinutes: 8,
      status: "in_progress",
      route: "/(student)/tutor",
      leoContext: {
        source: "learn_overview",
        targetType: "lesson_recap",
        targetId: String(latest._id),
      },
    },
  ];

  const weakTopics = await buildMobileLearnWeakTopics({
    schoolId: context.schoolId,
    studentId: context.studentId,
    classGroupId: context.classGroupId,
    limit: 5,
  });

  const revisionBankRows = await RevisionBankItem.find({
    schoolId: context.schoolId,
    studentId: context.studentId,
    status: "active",
  })
    .sort({ priorityScore: -1 })
    .limit(5)
    .lean<
      Array<{
        _id: Types.ObjectId;
        conceptTitle: string;
        subjectName: string;
      }>
    >();

  const flashcardDecks = await LessonFlashcardDeck.find({
    schoolId: context.schoolId,
    classGroupId: context.classGroupId,
    status: "published",
  })
    .sort({ updatedAt: -1 })
    .limit(3)
    .select("_id title subjectName cardCount")
    .lean<
      Array<{
        _id: Types.ObjectId;
        title: string;
        subjectName?: string;
        cardCount?: number;
      }>
    >();

  const deckSummaries = await Promise.all(
    flashcardDecks.map(async (deck) => {
      const mastered = await StudentFlashcardProgress.countDocuments({
        schoolId: context.schoolId,
        studentId: context.studentId,
        deckId: deck._id,
        status: "mastered",
      });
      const total = deck.cardCount ?? Math.max(mastered, 1);
      return {
        id: String(deck._id),
        title: deck.title,
        subjectName: deck.subjectName || "Subject",
        masteredCards: mastered,
        totalCards: total,
        route: "/(student)/flashcards/[deckId]",
      };
    })
  );

  const now = new Date();
  const homeworkRows = await Homework.find({
    schoolId: context.schoolId,
    status: "published",
    classGroupIds: context.classGroupId,
    dueDate: { $gte: now },
  })
    .sort({ dueDate: 1 })
    .limit(5)
    .select("_id title dueDate subjectId")
    .lean<
      Array<{
        _id: Types.ObjectId;
        title: string;
        dueDate: Date;
        subjectId: Types.ObjectId;
      }>
    >();

  const assignments = await Promise.all(
    homeworkRows.map(async (row) => {
      const subject = await SubjectOffering.findOne({
        schoolId: context.schoolId,
        subjectId: row.subjectId,
      })
        .select("displayName shortName")
        .lean<{ displayName?: string; shortName?: string } | null>();

      const daysUntil = Math.ceil((row.dueDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      const urgency = daysUntil <= 1 ? "high" : daysUntil <= 3 ? "normal" : "low";

      return {
        id: String(row._id),
        title: row.title,
        subjectName: subject?.shortName || subject?.displayName || "Subject",
        dueLabel:
          daysUntil <= 0
            ? "Due today"
            : daysUntil === 1
              ? "Due tomorrow"
              : `Due ${row.dueDate.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}`,
        urgency: urgency as "low" | "normal" | "high",
        status: "not_started",
        route: `/(student)/assignments/${String(row._id)}`,
        leoSupportAllowed: true,
        leoContext: {
          source: "learn_assignment",
          targetType: "assignment",
          targetId: String(row._id),
          mode: "hint",
        },
      };
    })
  );

  const urgentAssignment = assignments.find((a) => a.urgency === "high");
  const primaryWeak = weakTopics[0];
  const revisionNext = revisionBankRows[0];

  let examPrep: MobileStudentLearnOverview["examPrep"] = null;
  const upcoming = homeworkRows[0];
  if (upcoming) {
    const subject = await SubjectOffering.findOne({
      schoolId: context.schoolId,
      subjectId: upcoming.subjectId,
    })
      .select("displayName shortName")
      .lean<{ displayName?: string; shortName?: string } | null>();

    const daysUntil = Math.max(
      0,
      Math.ceil((upcoming.dueDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
    );

    examPrep = {
      active: daysUntil <= 14,
      title: upcoming.title,
      subtitle: `${subject?.shortName || subject?.displayName || "Assessment"} · ${daysUntil} days away`,
      upcomingExamLabel: `${daysUntil} days`,
      readinessPercent: Math.max(35, 100 - daysUntil * 5),
      recommendedAction: "Start a short practice drill",
      route: "/(student)/exam-prep",
      displayPriority: daysUntil <= 7 ? 90 : 50,
    };
  }

  const readyExplore = await findReadyExploreAdventure({
    schoolId: context.schoolId,
    classGroupId: context.classGroupId,
    lessonId: String(latest._id),
    subjectId: latest.subjectOfferingId ? String(latest.subjectOfferingId) : "unknown",
    gradeLevel: bundle.student.gradeName || loginStudent.gradeName || "Primary",
  });

  const exploreUnlocks: MobileStudentLearnOverview["exploreUnlocks"] = [
    {
      id: `unlock-${String(latest._id)}`,
      lessonId: String(latest._id),
      subjectId: latest.subjectOfferingId ? String(latest.subjectOfferingId) : "unknown",
      subjectName: latest.subjectOfferingId
        ? offeringMap.get(String(latest.subjectOfferingId)) || "Subject"
        : "Subject",
      title: `Explore unlocked from ${
        latest.subjectOfferingId ? offeringMap.get(String(latest.subjectOfferingId)) || "class" : "class"
      }`,
      description: `Go deeper into ${latest.title}`,
      status: readyExplore ? "available" : "locked",
      reason: "high_score",
      route: "/(student)/explore",
      routeParams: {
        lessonId: String(latest._id),
        subjectId: latest.subjectOfferingId ? String(latest.subjectOfferingId) : "unknown",
        source: "learn_explore_unlock",
      },
      adventureId: readyExplore ? String(readyExplore._id) : undefined,
    },
  ];

  const exploreForNba = exploreUnlocks.find((u) => u.status === "available");

  const nextBestAction = selectNextBestAction({
    questBoard: questSummary,
    urgentAssignment: urgentAssignment
      ? {
          id: urgentAssignment.id,
          title: urgentAssignment.title,
          subjectName: urgentAssignment.subjectName,
          dueLabel: urgentAssignment.dueLabel,
        }
      : undefined,
    weakTopic: primaryWeak
      ? {
          id: primaryWeak.id,
          title: primaryWeak.title,
          subjectName: primaryWeak.subjectName,
          reason: primaryWeak.reason,
        }
      : undefined,
    exploreUnlock: exploreForNba
      ? {
          id: exploreForNba.id,
          title: exploreForNba.title,
          lessonId: exploreForNba.lessonId,
          subjectId: exploreForNba.subjectId,
        }
      : undefined,
    examNear:
      examPrep?.active && examPrep.upcomingExamLabel
        ? {
            title: examPrep.title,
            route: examPrep.route,
            daysUntil: Number.parseInt(examPrep.upcomingExamLabel, 10) || 7,
          }
        : undefined,
  });

  const leoRecommendations = buildLeoRecommendations({
    weakTopic: primaryWeak
      ? {
          id: primaryWeak.id,
          title: primaryWeak.title,
          subjectName: primaryWeak.subjectName,
          reason: primaryWeak.reason,
        }
      : undefined,
    questBoard: questSummary,
    exploreUnlock: exploreForNba
      ? {
          id: exploreForNba.id,
          title: exploreForNba.title,
          lessonId: exploreForNba.lessonId,
          subjectId: exploreForNba.subjectId,
        }
      : undefined,
    assignment: urgentAssignment
      ? { id: urgentAssignment.id, title: urgentAssignment.title }
      : undefined,
    examDays: examPrep?.active
      ? Number.parseInt(examPrep.upcomingExamLabel ?? "99", 10)
      : undefined,
  });

  const todayQuestBoard = {
    boardId: questSummary.boardId,
    date: questSummary.date,
    title: questSummary.title,
    completionPercent: questSummary.completionPercent,
    completedRequiredItems: questSummary.completedRequiredItems,
    totalRequiredItems: questSummary.totalRequiredItems,
    xpEarned: questSummary.xpEarned,
    totalXpAvailable: questSummary.totalXpAvailable,
    streakProtected: questSummary.streakProtected,
    status: questSummary.status,
    nextItem: questSummary.nextItem,
    catchUpSummary: questSummary.catchUpSummary,
  };

  const overview: MobileStudentLearnOverview = {
    header: {
      greeting: `Good afternoon, ${displayName}`,
      subtitle: "Leo has prepared your learning plan for today.",
      studentName: displayName,
      className: className || undefined,
      dateLabel,
    },
    todayStats: {
      dateLabel,
      xpEarnedToday,
      streakDays,
      dailyQuestPercent: questSummary.completionPercent,
      requiredReviewsCompleted: questSummary.completedRequiredItems,
      requiredReviewsTotal: questSummary.totalRequiredItems,
      streakProtected: questSummary.streakProtected,
      streakMessage: questSummary.streakProtected
        ? "Your streak is safe."
        : "Reach 80% on today's reviews to protect your streak.",
    },
    nextBestAction,
    todayQuestBoard,
    leoRecommendations,
    continueLearning,
    practiceAndRevision: {
      weakTopics,
      flashcardDecks: deckSummaries,
      revisionBank: {
        count: revisionBankRows.length,
        message:
          revisionBankRows.length > 0
            ? `Leo has saved ${revisionBankRows.length} topic${revisionBankRows.length === 1 ? "" : "s"} for light review this week.`
            : "Revision Bank will fill gently when Leo saves topics for you.",
        nextRecommendedTopic: revisionNext
          ? {
              id: String(revisionNext._id),
              title: revisionNext.conceptTitle,
              subjectName: revisionNext.subjectName,
              route: "/(student)/revision",
            }
          : undefined,
      },
      quickPractice:
        primaryWeak && primaryWeak.subjectName
          ? [
              {
                id: "qp-weak",
                title: `5-minute ${primaryWeak.subjectName} sprint`,
                subjectName: primaryWeak.subjectName,
                estimatedMinutes: 5,
                route: "/(student)/revision",
              },
            ]
          : undefined,
    },
    assignments,
    subjectPaths,
    exploreUnlocks,
    examPrep,
    moreLearningModes: buildMoreLearningModes(),
    generatedAt: new Date().toISOString(),
  };

  return {
    ok: true,
    data: {
      overviewVersion: 2,
      data: overview,
    },
    meta: {
      generatedAt: overview.generatedAt,
      source: "backend",
      overviewVersion: 2,
    },
  };
}
