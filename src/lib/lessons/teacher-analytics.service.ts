import type { Types } from "mongoose";
import { Lesson } from "@/models/Lesson";
import { LessonFlashcard } from "@/models/LessonFlashcard";
import { LessonFlashcardDeck } from "@/models/LessonFlashcardDeck";
import { LessonReflection } from "@/models/LessonReflection";
import { Homework } from "@/models/Homework";
import { Submission } from "@/models/Submission";
import { StudentFlashcardProgress } from "@/models/StudentFlashcardProgress";
import { StudentLessonProgress } from "@/models/StudentLessonProgress";
import { endOfUtcDay, startOfUtcDay } from "./admin-analytics.service";
import { getCurriculumCompletionForPublishedLessonsInRange } from "@/lib/lessons/lesson-analytics-curriculum-coverage";

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
 * Analytics scoped to one teacher's lessons, reflections, decks, and linked student progress.
 */
export async function getTeacherLessonAnalytics(
  schoolId: Types.ObjectId,
  teacherId: Types.ObjectId,
  from: Date,
  to: Date
): Promise<TeacherLessonAnalyticsResult> {
  const fromD = startOfUtcDay(from);
  const toD = endOfUtcDay(to);

  const matchTeacher = { schoolId, teacherId };

  const [
    statusAgg,
    publishedCount,
    draftsTotal,
    reflectionsDone,
    lessonIds,
    deckIds,
  ] = await Promise.all([
    Lesson.aggregate<{ _id: string; count: number }>([
      {
        $match: {
          ...matchTeacher,
          createdAt: { $gte: fromD, $lte: toD },
        },
      },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Lesson.countDocuments({
      ...matchTeacher,
      publishedAt: { $gte: fromD, $lte: toD },
    }),
    Lesson.countDocuments({ ...matchTeacher, status: "draft" }),
    LessonReflection.countDocuments({
      ...matchTeacher,
      completed: true,
      updatedAt: { $gte: fromD, $lte: toD },
    }),
    Lesson.find(matchTeacher).distinct("_id"),
    LessonFlashcardDeck.find(matchTeacher).distinct("_id"),
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

  const lessonProgressMatch =
    lessonIds.length > 0 ? { lessonId: { $in: lessonIds } } : { lessonId: { $in: [] } };
  const deckMatch =
    deckIds.length > 0 ? { deckId: { $in: deckIds } } : { deckId: { $in: [] } };

  const [
    totalCards,
    reviewSessions,
    activeStudentsAgg,
    lessonViewEngagementRows,
    lessonViewDistinctStudents,
    lessonCompletionsInRange,
    lessonCompletionsDistinctStudents,
    curriculumCompletionInRange,
    linkedTasksCreatedInRange,
    linkedTasksPublishedInRange,
    linkedTaskTypeAgg,
    linkedHomeworkIds,
  ] = await Promise.all([
    lessonIds.length > 0
      ? LessonFlashcard.countDocuments({ schoolId, lessonId: { $in: lessonIds } })
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
    StudentLessonProgress.countDocuments({
      schoolId,
      ...lessonProgressMatch,
      lastActivityAt: { $gte: fromD, $lte: toD },
    }),
    StudentLessonProgress.aggregate<{ count: number }>([
      {
        $match: {
          schoolId,
          ...lessonProgressMatch,
          lastActivityAt: { $gte: fromD, $lte: toD },
        },
      },
      { $group: { _id: "$studentId" } },
      { $count: "count" },
    ]),
    StudentLessonProgress.countDocuments({
      schoolId,
      ...lessonProgressMatch,
      completionStatus: "completed",
      completedAt: { $gte: fromD, $lte: toD },
    }),
    StudentLessonProgress.aggregate<{ count: number }>([
      {
        $match: {
          schoolId,
          ...lessonProgressMatch,
          completionStatus: "completed",
          completedAt: { $gte: fromD, $lte: toD },
        },
      },
      { $group: { _id: "$studentId" } },
      { $count: "count" },
    ]),
    getCurriculumCompletionForPublishedLessonsInRange(schoolId, fromD, toD, teacherId),
    Homework.countDocuments({
      schoolId,
      teacherId,
      sourceLessonId: { $in: lessonIds.length > 0 ? lessonIds : [] },
      createdAt: { $gte: fromD, $lte: toD },
    }),
    Homework.countDocuments({
      schoolId,
      teacherId,
      sourceLessonId: { $in: lessonIds.length > 0 ? lessonIds : [] },
      status: "published",
      publishedAt: { $gte: fromD, $lte: toD },
    }),
    Homework.aggregate<{ _id: string; n: number }>([
      {
        $match: {
          schoolId,
          teacherId,
          sourceLessonId: { $in: lessonIds.length > 0 ? lessonIds : [] },
          createdAt: { $gte: fromD, $lte: toD },
        },
      },
      { $group: { _id: "$type", n: { $sum: 1 } } },
    ]),
    Homework.find({
      schoolId,
      teacherId,
      sourceLessonId: { $in: lessonIds.length > 0 ? lessonIds : [] },
    }).distinct("_id"),
  ]);

  const linkedQuizCountInRange =
    linkedTaskTypeAgg.find((r) => r._id === "quiz")?.n ?? 0;
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
  const distinctLessonViewers = lessonViewDistinctStudents[0]?.count ?? 0;
  const completionsInRange = lessonCompletionsInRange;
  const distinctStudentsCompletedInRange = lessonCompletionsDistinctStudents[0]?.count ?? 0;

  const completionRateAmongEngagementsPercent =
    lessonViewEngagementRows > 0
      ? Math.min(100, Math.round((100 * completionsInRange) / lessonViewEngagementRows))
      : null;

  const learnerCompletionRatePercent =
    distinctLessonViewers > 0
      ? Math.min(
          100,
          Math.round((100 * distinctStudentsCompletedInRange) / distinctLessonViewers)
        )
      : null;

  return {
    range: { from: fromD.toISOString(), to: toD.toISOString() },
    myLessons: {
      createdInRange: createdTotal,
      createdInRangeByStatus: byStatus,
      publishedEventsInRange: publishedCount,
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
      engagementsInRange: lessonViewEngagementRows,
      distinctStudentsInRange: distinctLessonViewers,
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
