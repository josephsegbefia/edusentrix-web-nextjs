import "server-only";

import { Types } from "mongoose";
import { LearnSubjectJourney, type ILearnSubjectJourney } from "@/models/LearnSubjectJourney";
import { RevisionBankItem } from "@/models/RevisionBankItem";
import { StudentFlashcardProgress } from "@/models/StudentFlashcardProgress";
import {
  computeJourneyCompletion,
  dateKeyForSchoolDay,
  formatCoveredLabel,
  JOURNEY_TIMEZONE,
  STREAK_PROTECTION_PERCENT,
} from "@/lib/learn/todays-journey/journey-step-utils";

export type LearnJourneyOversightTodaysSummary = {
  date: string;
  completionPercent: number;
  subjectsTotal: number;
  subjectsCompleted: number;
  requiredStepsCompleted: number;
  requiredStepsTotal: number;
  streakProtected: boolean;
  message: string;
};

export type LearnJourneyOversightCatchUpItem = {
  subjectName: string;
  topicTitle: string;
  completionPercent: number;
  coveredLabel: string;
};

export type LearnJourneyOversightCatchUp = {
  count: number;
  message: string;
  items: LearnJourneyOversightCatchUpItem[];
};

export type LearnJourneyOversightWeakConcept = {
  id: string;
  subjectName: string;
  title: string;
  reason: string;
};

export type LearnJourneyOversightFlashcardMastery = {
  decksTracked: number;
  cardsReviewed: number;
  cardsMastered: number;
  cardsTotal: number;
  masteryPercent: number;
  message: string;
};

export type LearnStudentJourneyOversight = {
  todaysJourney: LearnJourneyOversightTodaysSummary | null;
  catchUp: LearnJourneyOversightCatchUp;
  weakConcepts: LearnJourneyOversightWeakConcept[];
  flashcardMastery: LearnJourneyOversightFlashcardMastery;
};

export type LearnClassJourneyOversight = {
  date: string;
  studentsWithJourney: number;
  studentsCompleted: number;
  averageCompletionPercent: number;
  totalCatchUpItems: number;
  message: string;
};

export type LearnSchoolJourneyOversight = {
  date: string;
  studentsWithJourney: number;
  studentsCompleted: number;
  averageCompletionPercent: number;
  totalCatchUpItems: number;
  message: string;
};

const REVISION_REASON_LABEL: Record<string, string> = {
  missed_quest: "Saved from a missed journey",
  weak_topic: "Needs more practice",
  spaced_repetition: "Spaced revision",
  teacher_priority: "Teacher priority",
};

function buildTodaysSummary(journeys: ILearnSubjectJourney[]): LearnJourneyOversightTodaysSummary | null {
  if (!journeys.length) return null;

  const requiredStepsCompleted = journeys.reduce(
    (sum, journey) => sum + computeJourneyCompletion(journey.steps).requiredStepsCompleted,
    0
  );
  const requiredStepsTotal = journeys.reduce(
    (sum, journey) => sum + computeJourneyCompletion(journey.steps).requiredStepsTotal,
    0
  );
  const completionPercent =
    requiredStepsTotal === 0
      ? 0
      : Math.round((requiredStepsCompleted / requiredStepsTotal) * 100);
  const subjectsCompleted = journeys.filter((journey) => journey.completionPercent >= 100).length;
  const streakProtected = completionPercent >= STREAK_PROTECTION_PERCENT;

  return {
    date: journeys[0]!.date,
    completionPercent,
    subjectsTotal: journeys.length,
    subjectsCompleted,
    requiredStepsCompleted,
    requiredStepsTotal,
    streakProtected,
    message: streakProtected
      ? "Today's Journey is on track."
      : journeys.length === 1
        ? "One subject journey is active today."
        : `${journeys.length} subject journeys are active today.`,
  };
}

function buildCatchUpSummary(journeys: ILearnSubjectJourney[]): LearnJourneyOversightCatchUp {
  const items = journeys.map((journey) => ({
    subjectName: journey.subjectName,
    topicTitle: journey.topicTitle,
    completionPercent: journey.completionPercent,
    coveredLabel: formatCoveredLabel(journey.coveredAt),
  }));

  const count = items.length;
  const message =
    count === 0
      ? "No saved catch-up journeys right now."
      : count === 1
        ? "One saved catch-up journey needs attention."
        : `${count} saved catch-up journeys are waiting calmly.`;

  return { count, message, items };
}

function buildFlashcardMastery(
  rows: Array<{ status: string; deckId: Types.ObjectId }>
): LearnJourneyOversightFlashcardMastery {
  const cardsTotal = rows.length;
  const cardsMastered = rows.filter((row) => row.status === "known").length;
  const cardsReviewed = rows.filter((row) => row.status !== "new").length;
  const decksTracked = new Set(rows.map((row) => String(row.deckId))).size;
  const masteryPercent =
    cardsTotal === 0 ? 0 : Math.round((cardsMastered / cardsTotal) * 100);

  return {
    decksTracked,
    cardsReviewed,
    cardsMastered,
    cardsTotal,
    masteryPercent,
    message:
      cardsTotal === 0
        ? "Flashcard mastery will appear after class flashcard practice."
        : `${cardsMastered} of ${cardsTotal} flashcards marked known.`,
  };
}

export async function getStudentJourneyOversight(input: {
  schoolId: Types.ObjectId;
  studentId: Types.ObjectId;
}): Promise<LearnStudentJourneyOversight> {
  const todayKey = dateKeyForSchoolDay(new Date(), JOURNEY_TIMEZONE);

  const [todayJourneys, catchUpJourneys, revisionItems, flashcardRows] = await Promise.all([
    LearnSubjectJourney.find({
      schoolId: input.schoolId,
      studentId: input.studentId,
      date: todayKey,
    })
      .sort({ displayOrder: 1 })
      .lean<ILearnSubjectJourney[]>(),
    LearnSubjectJourney.find({
      schoolId: input.schoolId,
      studentId: input.studentId,
      completionPercent: { $lt: 100 },
      status: {
        $in: ["available", "not_started", "in_progress", "saved_for_later"],
      },
      $or: [
        { date: { $lt: todayKey } },
        { "catchUp.isCatchUp": true },
        { status: "saved_for_later" },
      ],
    })
      .sort({ priorityScore: -1, updatedAt: -1 })
      .limit(5)
      .lean<ILearnSubjectJourney[]>(),
    RevisionBankItem.find({
      schoolId: input.schoolId,
      studentId: input.studentId,
      status: "active",
    })
      .sort({ priorityScore: -1, updatedAt: -1 })
      .limit(5)
      .select("_id subjectName conceptTitle reason")
      .lean<
        Array<{
          _id: Types.ObjectId;
          subjectName: string;
          conceptTitle: string;
          reason: string;
        }>
      >(),
    StudentFlashcardProgress.find({
      schoolId: input.schoolId,
      studentId: input.studentId,
    })
      .select("status deckId reviewCount")
      .lean<Array<{ status: string; deckId: Types.ObjectId; reviewCount?: number }>>(),
  ]);

  return {
    todaysJourney: buildTodaysSummary(todayJourneys),
    catchUp: buildCatchUpSummary(catchUpJourneys),
    weakConcepts: revisionItems.map((item) => ({
      id: String(item._id),
      subjectName: item.subjectName,
      title: item.conceptTitle,
      reason: REVISION_REASON_LABEL[item.reason] || "Needs revision",
    })),
    flashcardMastery: buildFlashcardMastery(flashcardRows),
  };
}

export async function getClassJourneyOversight(input: {
  schoolId: Types.ObjectId;
  classGroupId: Types.ObjectId;
  studentIds: Types.ObjectId[];
}): Promise<LearnClassJourneyOversight> {
  const todayKey = dateKeyForSchoolDay(new Date(), JOURNEY_TIMEZONE);
  if (!input.studentIds.length) {
    return {
      date: todayKey,
      studentsWithJourney: 0,
      studentsCompleted: 0,
      averageCompletionPercent: 0,
      totalCatchUpItems: 0,
      message: "No students in this class yet.",
    };
  }

  const [todayJourneys, catchUpCount] = await Promise.all([
    LearnSubjectJourney.find({
      schoolId: input.schoolId,
      classGroupId: input.classGroupId,
      studentId: { $in: input.studentIds },
      date: todayKey,
    })
      .select("studentId completionPercent")
      .lean<Array<{ studentId: Types.ObjectId; completionPercent: number }>>(),
    LearnSubjectJourney.countDocuments({
      schoolId: input.schoolId,
      classGroupId: input.classGroupId,
      studentId: { $in: input.studentIds },
      completionPercent: { $lt: 100 },
      status: {
        $in: ["available", "not_started", "in_progress", "saved_for_later"],
      },
      $or: [
        { date: { $lt: todayKey } },
        { "catchUp.isCatchUp": true },
        { status: "saved_for_later" },
      ],
    }),
  ]);

  const byStudent = new Map<string, number[]>();
  for (const journey of todayJourneys) {
    const key = String(journey.studentId);
    const list = byStudent.get(key) ?? [];
    list.push(journey.completionPercent);
    byStudent.set(key, list);
  }

  const studentAverages = Array.from(byStudent.values()).map((values) =>
    Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
  );
  const studentsWithJourney = studentAverages.length;
  const studentsCompleted = studentAverages.filter((value) => value >= 100).length;
  const averageCompletionPercent = studentAverages.length
    ? Math.round(studentAverages.reduce((sum, value) => sum + value, 0) / studentAverages.length)
    : 0;

  return {
    date: todayKey,
    studentsWithJourney,
    studentsCompleted,
    averageCompletionPercent,
    totalCatchUpItems: catchUpCount,
    message:
      studentsWithJourney === 0
        ? "Today's Journey will appear after lessons are covered."
        : `${studentsCompleted} of ${studentsWithJourney} learners finished today's journeys.`,
  };
}

export async function getSchoolJourneyOversight(
  schoolId: Types.ObjectId
): Promise<LearnSchoolJourneyOversight> {
  const todayKey = dateKeyForSchoolDay(new Date(), JOURNEY_TIMEZONE);

  const [todayJourneys, catchUpCount] = await Promise.all([
    LearnSubjectJourney.find({
      schoolId,
      date: todayKey,
    })
      .select("studentId completionPercent")
      .lean<Array<{ studentId: Types.ObjectId; completionPercent: number }>>(),
    LearnSubjectJourney.countDocuments({
      schoolId,
      completionPercent: { $lt: 100 },
      status: {
        $in: ["available", "not_started", "in_progress", "saved_for_later"],
      },
      $or: [
        { date: { $lt: todayKey } },
        { "catchUp.isCatchUp": true },
        { status: "saved_for_later" },
      ],
    }),
  ]);

  const byStudent = new Map<string, number[]>();
  for (const journey of todayJourneys) {
    const key = String(journey.studentId);
    const list = byStudent.get(key) ?? [];
    list.push(journey.completionPercent);
    byStudent.set(key, list);
  }

  const studentAverages = Array.from(byStudent.values()).map((values) =>
    Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
  );

  return {
    date: todayKey,
    studentsWithJourney: studentAverages.length,
    studentsCompleted: studentAverages.filter((value) => value >= 100).length,
    averageCompletionPercent: studentAverages.length
      ? Math.round(studentAverages.reduce((sum, value) => sum + value, 0) / studentAverages.length)
      : 0,
    totalCatchUpItems: catchUpCount,
    message:
      studentAverages.length === 0
        ? "Today's Journey data will appear as students use EduSentrix Learn."
        : `School average journey progress today: ${Math.round(
            studentAverages.reduce((sum, value) => sum + value, 0) / studentAverages.length
          )}%.`,
  };
}
