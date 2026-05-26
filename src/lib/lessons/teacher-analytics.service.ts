import type { Types } from "mongoose";
import { LessonSession } from "@/models/LessonSession";
import { LessonDelivery } from "@/models/LessonDelivery";
import { LessonDeliveryReflection } from "@/models/LessonDeliveryReflection";
import { LessonFlashcard } from "@/models/LessonFlashcard";
import { LessonFlashcardDeck } from "@/models/LessonFlashcardDeck";
import { Homework } from "@/models/Homework";
import { Submission } from "@/models/Submission";
import { StudentFlashcardProgress } from "@/models/StudentFlashcardProgress";
import { StudentSessionProgress } from "@/models/StudentSessionProgress";
import { endOfUtcDay, startOfUtcDay } from "./admin-analytics.service";
import {
  getV2CoverageAnalytics,
  type V2CoverageAnalytics,
} from "@/lib/lessons/lessons-v2-coverage-analytics";

export type TeacherLessonAnalyticsResult = {
  range: { from: string; to: string };
  myLessons: {
    createdInRange: number;
    createdInRangeByStatus: { draft: number; published: number; archived: number };
    publishedEventsInRange: number;
    draftsPending: number;
    reflectionsCompletedInRange: number;
  };
  curriculumCompletionInRange: {
    publishedLessonsInRange: number;
    studentSlotsTotal: number;
    completionsForPublishedLessonsInRange: number;
    coveragePercent: number | null;
  };
  flashcards: {
    totalCards: number;
    reviewSessionsInRange: number;
    activeStudentsInRange: number;
  };
  studentLessons: {
    engagementsInRange: number;
    distinctStudentsInRange: number;
    completionsInRange: number;
    distinctStudentsCompletedInRange: number;
    completionRateAmongEngagementsPercent: number | null;
    learnerCompletionRatePercent: number | null;
  };
  v2Coverage: V2CoverageAnalytics;
  lessonTasks: {
    linkedTasksCreatedInRange: number;
    linkedTasksPublishedInRange: number;
    linkedQuizCountInRange: number;
    linkedAssignmentCountInRange: number;
    submissionsInRange: number;
    distinctLearnersSubmittedInRange: number;
    gradedSubmissionsInRange: number;
    averageScorePercentInRange: number | null;
  };
};

/**
 * Analytics scoped to one teacher's sessions, reflections, decks, and linked student progress.
 * All queries use the v2 LessonSession / LessonDelivery / StudentSessionProgress models.
 */
export async function getTeacherLessonAnalytics(
  schoolId: Types.ObjectId,
  teacherId: Types.ObjectId,
  from: Date,
  to: Date
): Promise<TeacherLessonAnalyticsResult> {
  const fromD = startOfUtcDay(from);
  const toD = endOfUtcDay(to);

  const matchTeacher = { schoolId, ownerTeacherId: teacherId };

  const [
    statusAgg,
    deliveredInRange,
    draftsTotal,
    reflectionsDone,
    sessionIds,
    deckIds,
  ] = await Promise.all([
    LessonSession.aggregate<{ _id: string; count: number }>([
      {
        $match: {
          ...matchTeacher,
          createdAt: { $gte: fromD, $lte: toD },
        },
      },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    // "Published events" proxy: deliveries completed by this teacher in range
    LessonDelivery.countDocuments({
      schoolId,
      ownerTeacherId: teacherId,
      status: "completed",
      completedAt: { $gte: fromD, $lte: toD },
    }),
    LessonSession.countDocuments({ ...matchTeacher, status: "draft" }),
    LessonDeliveryReflection.countDocuments({
      schoolId,
      teacherId,
      completed: true,
      updatedAt: { $gte: fromD, $lte: toD },
    }),
    LessonSession.find(matchTeacher).distinct("_id") as Promise<Types.ObjectId[]>,
    LessonFlashcardDeck.find({ schoolId, teacherId }).distinct("_id") as Promise<Types.ObjectId[]>,
  ]);

  const byStatus = { draft: 0, published: 0, archived: 0 };
  let createdTotal = 0;
  for (const row of statusAgg) {
    const k = row._id as keyof typeof byStatus;
    if (k in byStatus) {
      byStatus[k] += row.count;
      createdTotal += row.count;
    }
  }

  const sessionProgressMatch =
    sessionIds.length > 0
      ? { sessionId: { $in: sessionIds } }
      : { sessionId: { $in: [] as Types.ObjectId[] } };
  const deckMatch =
    deckIds.length > 0
      ? { deckId: { $in: deckIds } }
      : { deckId: { $in: [] as Types.ObjectId[] } };

  const [
    totalCards,
    reviewSessions,
    activeStudentsAgg,
    engagementsInRange,
    distinctStudentsAgg,
    completionsInRange,
    completionsDistinctStudentsAgg,
    linkedTasksCreatedInRange,
    linkedTasksPublishedInRange,
    linkedTaskTypeAgg,
    linkedHomeworkIds,
  ] = await Promise.all([
    sessionIds.length > 0
      ? LessonFlashcard.countDocuments({ schoolId, sessionId: { $in: sessionIds } })
      : Promise.resolve(0),
    StudentFlashcardProgress.countDocuments({
      schoolId,
      ...deckMatch,
      lastReviewedAt: { $gte: fromD, $lte: toD },
    }),
    StudentFlashcardProgress.aggregate<{ count: number }>([
      {
        $match: {
          schoolId,
          ...deckMatch,
          lastReviewedAt: { $gte: fromD, $lte: toD },
        },
      },
      { $group: { _id: "$studentId" } },
      { $count: "count" },
    ]),
    StudentSessionProgress.countDocuments({
      schoolId,
      ...sessionProgressMatch,
      lastActivityAt: { $gte: fromD, $lte: toD },
    }),
    StudentSessionProgress.aggregate<{ count: number }>([
      {
        $match: {
          schoolId,
          ...sessionProgressMatch,
          lastActivityAt: { $gte: fromD, $lte: toD },
        },
      },
      { $group: { _id: "$studentId" } },
      { $count: "count" },
    ]),
    StudentSessionProgress.countDocuments({
      schoolId,
      ...sessionProgressMatch,
      completionStatus: "completed",
      completedAt: { $gte: fromD, $lte: toD },
    }),
    StudentSessionProgress.aggregate<{ count: number }>([
      {
        $match: {
          schoolId,
          ...sessionProgressMatch,
          completionStatus: "completed",
          completedAt: { $gte: fromD, $lte: toD },
        },
      },
      { $group: { _id: "$studentId" } },
      { $count: "count" },
    ]),
    Homework.countDocuments({
      schoolId,
      teacherId,
      sourceSessionId: { $in: sessionIds.length > 0 ? sessionIds : [] },
      createdAt: { $gte: fromD, $lte: toD },
    }),
    Homework.countDocuments({
      schoolId,
      teacherId,
      sourceSessionId: { $in: sessionIds.length > 0 ? sessionIds : [] },
      status: "published",
      publishedAt: { $gte: fromD, $lte: toD },
    }),
    Homework.aggregate<{ _id: string; n: number }>([
      {
        $match: {
          schoolId,
          teacherId,
          sourceSessionId: { $in: sessionIds.length > 0 ? sessionIds : [] },
          createdAt: { $gte: fromD, $lte: toD },
        },
      },
      { $group: { _id: "$type", n: { $sum: 1 } } },
    ]),
    Homework.find({
      schoolId,
      teacherId,
      sourceSessionId: { $in: sessionIds.length > 0 ? sessionIds : [] },
    }).distinct("_id") as Promise<Types.ObjectId[]>,
  ]);

  const linkedQuizCountInRange = linkedTaskTypeAgg.find((r) => r._id === "quiz")?.n ?? 0;
  const linkedAssignmentCountInRange = linkedTaskTypeAgg
    .filter((r) => r._id === "assignment" || r._id === "project" || r._id === "practice")
    .reduce((sum, r) => sum + r.n, 0);

  const [submissionsInRange, learnersSubmittedAgg, gradedSubmissionsAgg] = await Promise.all([
    Submission.countDocuments({
      schoolId,
      homeworkId: { $in: linkedHomeworkIds.length > 0 ? linkedHomeworkIds : [] },
      submittedAt: { $gte: fromD, $lte: toD },
      status: { $in: ["submitted", "late", "graded", "returned"] },
    }),
    Submission.aggregate<{ count: number }>([
      {
        $match: {
          schoolId,
          homeworkId: { $in: linkedHomeworkIds.length > 0 ? linkedHomeworkIds : [] },
          submittedAt: { $gte: fromD, $lte: toD },
          status: { $in: ["submitted", "late", "graded", "returned"] },
        },
      },
      { $group: { _id: "$studentId" } },
      { $count: "count" },
    ]),
    Submission.aggregate<{ avgScore: number | null; gradedCount: number }>([
      {
        $match: {
          schoolId,
          homeworkId: { $in: linkedHomeworkIds.length > 0 ? linkedHomeworkIds : [] },
          gradedAt: { $gte: fromD, $lte: toD },
          status: "graded",
          score: { $type: "number" },
        },
      },
      {
        $group: {
          _id: null,
          avgScore: { $avg: "$score" },
          gradedCount: { $sum: 1 },
        },
      },
      { $project: { _id: 0, avgScore: 1, gradedCount: 1 } },
    ]),
  ]);

  const distinctLearnersSubmittedInRange = learnersSubmittedAgg[0]?.count ?? 0;
  const gradedSubmissionsInRange = gradedSubmissionsAgg[0]?.gradedCount ?? 0;
  const averageScorePercentInRange =
    gradedSubmissionsAgg[0]?.avgScore != null
      ? Math.max(0, Math.min(100, Math.round(gradedSubmissionsAgg[0].avgScore)))
      : null;

  const activeStudentsInRange = activeStudentsAgg[0]?.count ?? 0;
  const distinctStudentsInRange = distinctStudentsAgg[0]?.count ?? 0;
  const distinctStudentsCompletedInRange = completionsDistinctStudentsAgg[0]?.count ?? 0;

  const completionRateAmongEngagementsPercent =
    engagementsInRange > 0
      ? Math.min(100, Math.round((100 * completionsInRange) / engagementsInRange))
      : null;

  const learnerCompletionRatePercent =
    distinctStudentsInRange > 0
      ? Math.min(
          100,
          Math.round((100 * distinctStudentsCompletedInRange) / distinctStudentsInRange)
        )
      : null;

  const v2Coverage = await getV2CoverageAnalytics({
    schoolId,
    teacherId,
    from: fromD,
    to: toD,
  });

  // Curriculum completion: v2 coverage provides the same signal via deliveries
  const curriculumCompletionInRange = {
    publishedLessonsInRange: v2Coverage.deliveriesCompletedInRange,
    studentSlotsTotal: engagementsInRange,
    completionsForPublishedLessonsInRange: completionsInRange,
    coveragePercent:
      engagementsInRange > 0
        ? Math.min(100, Math.round((100 * completionsInRange) / engagementsInRange))
        : null,
  };

  return {
    range: { from: fromD.toISOString(), to: toD.toISOString() },
    v2Coverage,
    myLessons: {
      createdInRange: createdTotal,
      createdInRangeByStatus: byStatus,
      publishedEventsInRange: deliveredInRange,
      draftsPending: draftsTotal,
      reflectionsCompletedInRange: reflectionsDone,
    },
    curriculumCompletionInRange,
    flashcards: {
      totalCards,
      reviewSessionsInRange: reviewSessions,
      activeStudentsInRange,
    },
    studentLessons: {
      engagementsInRange,
      distinctStudentsInRange,
      completionsInRange,
      distinctStudentsCompletedInRange,
      completionRateAmongEngagementsPercent,
      learnerCompletionRatePercent,
    },
    lessonTasks: {
      linkedTasksCreatedInRange,
      linkedTasksPublishedInRange,
      linkedQuizCountInRange,
      linkedAssignmentCountInRange,
      submissionsInRange,
      distinctLearnersSubmittedInRange,
      gradedSubmissionsInRange,
      averageScorePercentInRange,
    },
  };
}
