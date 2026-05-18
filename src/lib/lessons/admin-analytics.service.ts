import type { Types } from "mongoose";
import mongoose from "mongoose";
import { Lesson } from "@/models/Lesson";
import { LessonFlashcard } from "@/models/LessonFlashcard";
import { LessonReflection } from "@/models/LessonReflection";
import { StudentFlashcardProgress } from "@/models/StudentFlashcardProgress";
import { Teacher } from "@/models/Teacher";
import { User } from "@/models/User";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";
import { StudentLessonProgress } from "@/models/StudentLessonProgress";
import { getCurriculumCompletionForPublishedLessonsInRange } from "@/lib/lessons/lesson-analytics-curriculum-coverage";
import { Homework } from "@/models/Homework";
import { Submission } from "@/models/Submission";
import { LessonCollaborationComment } from "@/models/LessonCollaborationComment";
import {
  getV2CoverageAnalytics,
  type V2CoverageAnalytics,
} from "@/lib/lessons/lessons-v2-coverage-analytics";

export type LessonAnalyticsResult = {
  range: { from: string; to: string };
  createdInRange: {
    total: number;
    byStatus: { draft: number; published: number; archived: number };
  };
  /** Lessons whose `publishedAt` fell in the range (including republish events). */
  publishedEventsInRange: number;
  /** All lessons currently in `draft` (snapshot counts). */
  currentDraftsTotal: number;
  /** Reflections marked completed with `updatedAt` in range. */
  reflectionsCompletedInRange: number;
  topTeachers: Array<{ teacherId: string; name: string; count: number }>;
  classCoverage: Array<{ classGroupId: string; label: string; publishedLessonsInRange: number }>;
  /** Roster-weighted completion vs lessons published in the range (see curriculum coverage helper). */
  curriculumCompletionInRange: {
    publishedLessonsInRange: number;
    studentSlotsTotal: number;
    completionsForPublishedLessonsInRange: number;
    coveragePercent: number | null;
  };
  flashcards: {
    totalCards: number;
    /** Progress rows with `lastReviewedAt` in range (proxy for review activity). */
    reviewSessionsInRange: number;
    /** Distinct students with review activity in range. */
    activeStudentsInRange: number;
  };
  /** Student lesson reads: rows with `lastActivityAt` in range (a student opened a lesson at least once in the window). */
  studentLessons: {
    engagementsInRange: number;
    distinctStudentsInRange: number;
    /** Rows with `completionStatus === completed` and `completedAt` in range. */
    completionsInRange: number;
    distinctStudentsCompletedInRange: number;
    /**
     * Share of student–lesson progress rows with activity in the range that were marked completed in the range (0–100).
     * Null when there were no engagements in the range.
     */
    completionRateAmongEngagementsPercent: number | null;
    /**
     * Share of distinct students with any lesson activity in the range who marked at least one lesson studied in the range (0–100).
     * Null when there were no active learners in the range.
     */
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
    teacherRanking: Array<{
      teacherId: string;
      name: string;
      linkedTasksCreatedInRange: number;
      submissionsInRange: number;
      gradedSubmissionsInRange: number;
      averageScorePercentInRange: number | null;
    }>;
    classRanking: Array<{
      classGroupId: string;
      label: string;
      linkedTasksCreatedInRange: number;
      submissionsInRange: number;
    }>;
  };
  v2Coverage: V2CoverageAnalytics;
  collaboration: {
    lessonsWithCollaboratorsTotal: number;
    lessonsUpdatedByCollaboratorsInRange: number;
    commentsCreatedInRange: number;
    commentsResolvedInRange: number;
    openCommentsNow: number;
    hotspots: Array<{
      lessonId: string;
      lessonTitle: string;
      openCommentsNow: number;
    }>;
  };
};

export function startOfUtcDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

export function endOfUtcDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(23, 59, 59, 999);
  return x;
}

export function defaultLessonAnalyticsRange(): { from: Date; to: Date } {
  const to = endOfUtcDay(new Date());
  const from = startOfUtcDay(new Date(to.getTime() - 29 * 24 * 60 * 60 * 1000));
  return { from, to };
}

async function teacherDisplayNames(
  schoolId: Types.ObjectId,
  teacherIds: Types.ObjectId[]
): Promise<Map<string, string>> {
  const uniq = [...new Set(teacherIds.map(String))].map((s) => new mongoose.Types.ObjectId(s));
  if (uniq.length === 0) return new Map();

  const teachers = (await Teacher.find({
    _id: { $in: uniq },
    schoolId,
  })
    .select("userId")
    .lean()) as Array<{ _id: Types.ObjectId; userId: Types.ObjectId }>;

  const userIds = teachers.map((t) => t.userId).filter(Boolean);
  const users = (await User.find({ _id: { $in: userIds } })
    .select("firstName lastName email name")
    .lean()) as Array<{
    _id: Types.ObjectId;
    name?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
  }>;

  const userLabel = new Map<string, string>();
  for (const u of users) {
    const name =
      (u.name && String(u.name).trim()) ||
      [u.firstName, u.lastName].filter(Boolean).join(" ").trim() ||
      u.email ||
      "Teacher";
    userLabel.set(String(u._id), name);
  }

  const out = new Map<string, string>();
  for (const t of teachers) {
    const label = userLabel.get(String(t.userId)) || "Teacher";
    out.set(String(t._id), label);
  }
  for (const id of uniq) {
    if (!out.has(String(id))) out.set(String(id), "Teacher");
  }
  return out;
}

async function classLabels(
  schoolId: Types.ObjectId,
  classGroupIds: Types.ObjectId[]
): Promise<Map<string, string>> {
  const uniq = [...new Set(classGroupIds.map(String))].map((s) => new mongoose.Types.ObjectId(s));
  if (uniq.length === 0) return new Map();

  const groups = (await ClassGroup.find({
    _id: { $in: uniq },
    schoolId,
  })
    .select("name gradeId")
    .lean()) as Array<{ _id: Types.ObjectId; name: string; gradeId?: Types.ObjectId }>;

  const gradeIds = [...new Set(groups.map((g) => g.gradeId).filter(Boolean) as Types.ObjectId[])];
  const grades =
    gradeIds.length > 0
      ? ((await Grade.find({ _id: { $in: gradeIds } })
          .select("name")
          .lean()) as Array<{ _id: Types.ObjectId; name: string }>)
      : [];
  const gradeName = new Map(grades.map((g) => [String(g._id), g.name]));

  const out = new Map<string, string>();
  for (const g of groups) {
    const gn = g.gradeId ? gradeName.get(String(g.gradeId)) : undefined;
    out.set(String(g._id), gn ? `${gn} ${g.name}`.trim() : g.name);
  }
  return out;
}

export async function getLessonAnalytics(
  schoolId: Types.ObjectId,
  from: Date,
  to: Date
): Promise<LessonAnalyticsResult> {
  const fromD = startOfUtcDay(from);
  const toD = endOfUtcDay(to);

  const matchSchool = { schoolId };

  const [
    statusAgg,
    publishedCount,
    draftsTotal,
    reflectionsDone,
    teacherAgg,
    classAgg,
    totalCards,
    reviewSessions,
    activeStudentsAgg,
    lessonViewEngagementRows,
    lessonViewDistinctStudents,
    lessonCompletionsInRange,
    lessonCompletionsDistinctStudents,
    linkedTasksCreatedInRange,
    linkedTasksPublishedInRange,
    linkedTaskTypeAgg,
    linkedHomeworkIds,
    lessonsWithCollaboratorsTotal,
    lessonsUpdatedByCollaboratorsInRange,
    commentsCreatedInRange,
    commentsResolvedInRange,
    openCommentsNow,
    taskTeacherAgg,
    taskClassAgg,
    hotspotAgg,
  ] = await Promise.all([
    Lesson.aggregate<{
      _id: string;
      count: number;
    }>([
      {
        $match: {
          ...matchSchool,
          createdAt: { $gte: fromD, $lte: toD },
        },
      },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Lesson.countDocuments({
      ...matchSchool,
      publishedAt: { $gte: fromD, $lte: toD },
    }),
    Lesson.countDocuments({ ...matchSchool, status: "draft" }),
    LessonReflection.countDocuments({
      ...matchSchool,
      completed: true,
      updatedAt: { $gte: fromD, $lte: toD },
    }),
    Lesson.aggregate<{ _id: Types.ObjectId; count: number }>([
      {
        $match: {
          ...matchSchool,
          createdAt: { $gte: fromD, $lte: toD },
        },
      },
      { $group: { _id: "$teacherId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 15 },
    ]),
    Lesson.aggregate<{ _id: Types.ObjectId; count: number }>([
      {
        $match: {
          ...matchSchool,
          status: "published",
          publishedAt: { $gte: fromD, $lte: toD },
        },
      },
      { $group: { _id: "$classGroupId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 25 },
    ]),
    LessonFlashcard.countDocuments(matchSchool),
    StudentFlashcardProgress.countDocuments({
      ...matchSchool,
      lastReviewedAt: { $gte: fromD, $lte: toD },
    }),
    StudentFlashcardProgress.aggregate<{ count: number }>([
      {
        $match: {
          ...matchSchool,
          lastReviewedAt: { $gte: fromD, $lte: toD },
        },
      },
      { $group: { _id: "$studentId" } },
      { $count: "count" },
    ]),
    StudentLessonProgress.countDocuments({
      ...matchSchool,
      lastActivityAt: { $gte: fromD, $lte: toD },
    }),
    StudentLessonProgress.aggregate<{ count: number }>([
      {
        $match: {
          ...matchSchool,
          lastActivityAt: { $gte: fromD, $lte: toD },
        },
      },
      { $group: { _id: "$studentId" } },
      { $count: "count" },
    ]),
    StudentLessonProgress.countDocuments({
      ...matchSchool,
      completionStatus: "completed",
      completedAt: { $gte: fromD, $lte: toD },
    }),
    StudentLessonProgress.aggregate<{ count: number }>([
      {
        $match: {
          ...matchSchool,
          completionStatus: "completed",
          completedAt: { $gte: fromD, $lte: toD },
        },
      },
      { $group: { _id: "$studentId" } },
      { $count: "count" },
    ]),
    Homework.countDocuments({
      ...matchSchool,
      sourceLessonId: { $exists: true, $ne: null },
      createdAt: { $gte: fromD, $lte: toD },
    }),
    Homework.countDocuments({
      ...matchSchool,
      sourceLessonId: { $exists: true, $ne: null },
      status: "published",
      publishedAt: { $gte: fromD, $lte: toD },
    }),
    Homework.aggregate<{ _id: string; n: number }>([
      {
        $match: {
          ...matchSchool,
          sourceLessonId: { $exists: true, $ne: null },
          createdAt: { $gte: fromD, $lte: toD },
        },
      },
      { $group: { _id: "$type", n: { $sum: 1 } } },
    ]),
    Homework.find({
      ...matchSchool,
      sourceLessonId: { $exists: true, $ne: null },
    }).distinct("_id"),
    Lesson.countDocuments({
      ...matchSchool,
      "collaboratorTeacherIds.0": { $exists: true },
    }),
    Lesson.countDocuments({
      ...matchSchool,
      "collaboratorTeacherIds.0": { $exists: true },
      updatedAt: { $gte: fromD, $lte: toD },
    }),
    LessonCollaborationComment.countDocuments({
      ...matchSchool,
      createdAt: { $gte: fromD, $lte: toD },
    }),
    LessonCollaborationComment.countDocuments({
      ...matchSchool,
      status: "resolved",
      resolvedAt: { $gte: fromD, $lte: toD },
    }),
    LessonCollaborationComment.countDocuments({
      ...matchSchool,
      status: "open",
    }),
    Homework.aggregate<{
      _id: Types.ObjectId;
      linkedTasksCreatedInRange: number;
    }>([
      {
        $match: {
          ...matchSchool,
          sourceLessonId: { $exists: true, $ne: null },
          createdAt: { $gte: fromD, $lte: toD },
        },
      },
      { $group: { _id: "$teacherId", linkedTasksCreatedInRange: { $sum: 1 } } },
      { $sort: { linkedTasksCreatedInRange: -1 } },
      { $limit: 10 },
    ]),
    Homework.aggregate<{
      _id: Types.ObjectId;
      linkedTasksCreatedInRange: number;
    }>([
      {
        $match: {
          ...matchSchool,
          sourceLessonId: { $exists: true, $ne: null },
          createdAt: { $gte: fromD, $lte: toD },
        },
      },
      { $unwind: "$classGroupIds" },
      { $group: { _id: "$classGroupIds", linkedTasksCreatedInRange: { $sum: 1 } } },
      { $sort: { linkedTasksCreatedInRange: -1 } },
      { $limit: 10 },
    ]),
    LessonCollaborationComment.aggregate<{ _id: Types.ObjectId; openCommentsNow: number }>([
      { $match: { ...matchSchool, status: "open" } },
      { $group: { _id: "$lessonId", openCommentsNow: { $sum: 1 } } },
      { $sort: { openCommentsNow: -1 } },
      { $limit: 10 },
    ]),
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

  const teacherIds = teacherAgg.map((t) => t._id);
  const classIds = classAgg.map((c) => c._id);

  const [teacherNames, classLabelMap, curriculumCompletionInRange] = await Promise.all([
    teacherDisplayNames(schoolId, teacherIds),
    classLabels(schoolId, classIds),
    getCurriculumCompletionForPublishedLessonsInRange(schoolId, fromD, toD),
  ]);

  const rankingTeacherIds = taskTeacherAgg.map((row) => row._id);
  const rankingClassIds = taskClassAgg.map((row) => row._id);
  const [rankingTeacherNames, rankingClassLabels] = await Promise.all([
    teacherDisplayNames(schoolId, rankingTeacherIds),
    classLabels(schoolId, rankingClassIds),
  ]);

  const topTeachers = teacherAgg.map((t) => ({
    teacherId: String(t._id),
    name: teacherNames.get(String(t._id)) || "Teacher",
    count: t.count,
  }));

  const classCoverage = classAgg.map((c) => ({
    classGroupId: String(c._id),
    label: classLabelMap.get(String(c._id)) || "Class",
    publishedLessonsInRange: c.count,
  }));

  const activeStudentsInRange = activeStudentsAgg[0]?.count ?? 0;
  const linkedQuizCountInRange = linkedTaskTypeAgg.find((r) => r._id === "quiz")?.n ?? 0;
  const linkedAssignmentCountInRange = linkedTaskTypeAgg
    .filter((r) => r._id === "assignment" || r._id === "project" || r._id === "practice")
    .reduce((sum, r) => sum + r.n, 0);

  const [submissionsInRange, learnersSubmittedAgg, gradedSubmissionsAgg] = await Promise.all([
    Submission.countDocuments({
      ...matchSchool,
      homeworkId: { $in: linkedHomeworkIds.length > 0 ? linkedHomeworkIds : [] },
      submittedAt: { $gte: fromD, $lte: toD },
      status: { $in: ["submitted", "late", "graded", "returned"] },
    }),
    Submission.aggregate<{ count: number }>([
      {
        $match: {
          ...matchSchool,
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
          ...matchSchool,
          homeworkId: { $in: linkedHomeworkIds.length > 0 ? linkedHomeworkIds : [] },
          gradedAt: { $gte: fromD, $lte: toD },
          status: "graded",
          score: { $type: "number" },
        },
      },
      { $group: { _id: null, avgScore: { $avg: "$score" }, gradedCount: { $sum: 1 } } },
      { $project: { _id: 0, avgScore: 1, gradedCount: 1 } },
    ]),
  ]);
  const distinctLearnersSubmittedInRange = learnersSubmittedAgg[0]?.count ?? 0;
  const gradedSubmissionsInRange = gradedSubmissionsAgg[0]?.gradedCount ?? 0;
  const averageScorePercentInRange =
    gradedSubmissionsAgg[0]?.avgScore != null
      ? Math.max(0, Math.min(100, Math.round(gradedSubmissionsAgg[0].avgScore)))
      : null;

  const taskRankingHomeworkIds = linkedHomeworkIds.length > 0 ? linkedHomeworkIds : [];
  const [teacherSubmissionAgg, teacherGradedAgg, classSubmissionAgg] = await Promise.all([
    Submission.aggregate<{ _id: Types.ObjectId; submissionsInRange: number }>([
      {
        $match: {
          ...matchSchool,
          homeworkId: { $in: taskRankingHomeworkIds },
          submittedAt: { $gte: fromD, $lte: toD },
          status: { $in: ["submitted", "late", "graded", "returned"] },
        },
      },
      {
        $lookup: {
          from: "homeworks",
          localField: "homeworkId",
          foreignField: "_id",
          as: "homework",
        },
      },
      { $unwind: "$homework" },
      { $group: { _id: "$homework.teacherId", submissionsInRange: { $sum: 1 } } },
    ]),
    Submission.aggregate<{ _id: Types.ObjectId; gradedSubmissionsInRange: number; avgScore: number | null }>([
      {
        $match: {
          ...matchSchool,
          homeworkId: { $in: taskRankingHomeworkIds },
          gradedAt: { $gte: fromD, $lte: toD },
          status: "graded",
          score: { $type: "number" },
        },
      },
      {
        $lookup: {
          from: "homeworks",
          localField: "homeworkId",
          foreignField: "_id",
          as: "homework",
        },
      },
      { $unwind: "$homework" },
      {
        $group: {
          _id: "$homework.teacherId",
          gradedSubmissionsInRange: { $sum: 1 },
          avgScore: { $avg: "$score" },
        },
      },
    ]),
    Submission.aggregate<{ _id: Types.ObjectId; submissionsInRange: number }>([
      {
        $match: {
          ...matchSchool,
          homeworkId: { $in: taskRankingHomeworkIds },
          submittedAt: { $gte: fromD, $lte: toD },
          status: { $in: ["submitted", "late", "graded", "returned"] },
        },
      },
      {
        $lookup: {
          from: "homeworks",
          localField: "homeworkId",
          foreignField: "_id",
          as: "homework",
        },
      },
      { $unwind: "$homework" },
      { $unwind: "$homework.classGroupIds" },
      { $group: { _id: "$homework.classGroupIds", submissionsInRange: { $sum: 1 } } },
    ]),
  ]);

  const teacherSubmissionMap = new Map(teacherSubmissionAgg.map((row) => [String(row._id), row.submissionsInRange]));
  const teacherGradedMap = new Map(
    teacherGradedAgg.map((row) => [
      String(row._id),
      {
        gradedSubmissionsInRange: row.gradedSubmissionsInRange,
        averageScorePercentInRange:
          row.avgScore != null ? Math.max(0, Math.min(100, Math.round(row.avgScore))) : null,
      },
    ])
  );
  const classSubmissionMap = new Map(classSubmissionAgg.map((row) => [String(row._id), row.submissionsInRange]));

  const teacherRanking = taskTeacherAgg.map((row) => {
    const graded = teacherGradedMap.get(String(row._id));
    return {
      teacherId: String(row._id),
      name: rankingTeacherNames.get(String(row._id)) || "Teacher",
      linkedTasksCreatedInRange: row.linkedTasksCreatedInRange,
      submissionsInRange: teacherSubmissionMap.get(String(row._id)) ?? 0,
      gradedSubmissionsInRange: graded?.gradedSubmissionsInRange ?? 0,
      averageScorePercentInRange: graded?.averageScorePercentInRange ?? null,
    };
  });

  const classRanking = taskClassAgg.map((row) => ({
    classGroupId: String(row._id),
    label: rankingClassLabels.get(String(row._id)) || "Class",
    linkedTasksCreatedInRange: row.linkedTasksCreatedInRange,
    submissionsInRange: classSubmissionMap.get(String(row._id)) ?? 0,
  }));

  const hotspotLessonIds = hotspotAgg.map((row) => row._id);
  const hotspotLessons = hotspotLessonIds.length
    ? await Lesson.find({ _id: { $in: hotspotLessonIds }, schoolId })
        .select("_id title")
        .lean()
    : [];
  const hotspotTitleMap = new Map(
    hotspotLessons.map((row: { _id: Types.ObjectId; title?: string }) => [
      String(row._id),
      row.title || "Lesson",
    ])
  );
  const hotspots = hotspotAgg.map((row) => ({
    lessonId: String(row._id),
    lessonTitle: hotspotTitleMap.get(String(row._id)) || "Lesson",
    openCommentsNow: row.openCommentsNow,
  }));

  const distinctLessonViewers = lessonViewDistinctStudents[0]?.count ?? 0;

  const completionsInRange = lessonCompletionsInRange;
  const distinctStudentsCompletedInRange = lessonCompletionsDistinctStudents[0]?.count ?? 0;

  const completionRateAmongEngagementsPercent =
    lessonViewEngagementRows > 0
      ? Math.min(
          100,
          Math.round((100 * completionsInRange) / lessonViewEngagementRows)
        )
      : null;

  const learnerCompletionRatePercent =
    distinctLessonViewers > 0
      ? Math.min(
          100,
          Math.round((100 * distinctStudentsCompletedInRange) / distinctLessonViewers)
        )
      : null;

  const v2Coverage = await getV2CoverageAnalytics({ schoolId, from: fromD, to: toD });

  return {
    range: { from: fromD.toISOString(), to: toD.toISOString() },
    v2Coverage,
    createdInRange: { total: createdTotal, byStatus },
    publishedEventsInRange: publishedCount,
    currentDraftsTotal: draftsTotal,
    reflectionsCompletedInRange: reflectionsDone,
    topTeachers,
    classCoverage,
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
      teacherRanking,
      classRanking,
    },
    collaboration: {
      lessonsWithCollaboratorsTotal,
      lessonsUpdatedByCollaboratorsInRange,
      commentsCreatedInRange,
      commentsResolvedInRange,
      openCommentsNow,
      hotspots,
    },
  };
}
