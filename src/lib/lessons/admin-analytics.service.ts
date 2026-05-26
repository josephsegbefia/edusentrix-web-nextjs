import type { Types } from "mongoose";
import mongoose from "mongoose";
import { LessonSession } from "@/models/LessonSession";
import { LessonDelivery } from "@/models/LessonDelivery";
import { LessonDeliveryReflection } from "@/models/LessonDeliveryReflection";
import { LessonFlashcard } from "@/models/LessonFlashcard";
import { StudentFlashcardProgress } from "@/models/StudentFlashcardProgress";
import { StudentSessionProgress } from "@/models/StudentSessionProgress";
import { Teacher } from "@/models/Teacher";
import { User } from "@/models/User";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";
import { Homework } from "@/models/Homework";
import { Submission } from "@/models/Submission";
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
  /** Deliveries completed in range (v2 proxy for "published events"). */
  publishedEventsInRange: number;
  /** All sessions currently in `draft` (snapshot counts). */
  currentDraftsTotal: number;
  /** Delivery reflections marked completed with `updatedAt` in range. */
  reflectionsCompletedInRange: number;
  topTeachers: Array<{ teacherId: string; name: string; count: number }>;
  classCoverage: Array<{ classGroupId: string; label: string; publishedLessonsInRange: number }>;
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
  /** Collaboration is no longer tracked; zeroed out for backwards-compat. */
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
  const uniq = [...new Set(classGroupIds.map(String))].map(
    (s) => new mongoose.Types.ObjectId(s)
  );
  if (uniq.length === 0) return new Map();

  const groups = (await ClassGroup.find({
    _id: { $in: uniq },
    schoolId,
  })
    .select("name gradeId")
    .lean()) as Array<{ _id: Types.ObjectId; name: string; gradeId?: Types.ObjectId }>;

  const gradeIds = [
    ...new Set(groups.map((g) => g.gradeId).filter(Boolean) as Types.ObjectId[]),
  ];
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
    deliveredInRange,
    draftsTotal,
    reflectionsDone,
    teacherAgg,
    classAgg,
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
    taskTeacherAgg,
    taskClassAgg,
  ] = await Promise.all([
    LessonSession.aggregate<{ _id: string; count: number }>([
      {
        $match: {
          ...matchSchool,
          createdAt: { $gte: fromD, $lte: toD },
        },
      },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    // "Published events" proxy: deliveries completed in range
    LessonDelivery.countDocuments({
      ...matchSchool,
      status: "completed",
      completedAt: { $gte: fromD, $lte: toD },
    }),
    LessonSession.countDocuments({ ...matchSchool, status: "draft" }),
    LessonDeliveryReflection.countDocuments({
      ...matchSchool,
      completed: true,
      updatedAt: { $gte: fromD, $lte: toD },
    }),
    // Top teachers by sessions delivered in range
    LessonDelivery.aggregate<{ _id: Types.ObjectId; count: number }>([
      {
        $match: {
          ...matchSchool,
          status: "completed",
          completedAt: { $gte: fromD, $lte: toD },
        },
      },
      { $group: { _id: "$ownerTeacherId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 15 },
    ]),
    // Class coverage by completed deliveries in range
    LessonDelivery.aggregate<{ _id: Types.ObjectId; count: number }>([
      {
        $match: {
          ...matchSchool,
          status: "completed",
          completedAt: { $gte: fromD, $lte: toD },
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
    StudentSessionProgress.countDocuments({
      ...matchSchool,
      lastActivityAt: { $gte: fromD, $lte: toD },
    }),
    StudentSessionProgress.aggregate<{ count: number }>([
      {
        $match: {
          ...matchSchool,
          lastActivityAt: { $gte: fromD, $lte: toD },
        },
      },
      { $group: { _id: "$studentId" } },
      { $count: "count" },
    ]),
    StudentSessionProgress.countDocuments({
      ...matchSchool,
      completionStatus: "completed",
      completedAt: { $gte: fromD, $lte: toD },
    }),
    StudentSessionProgress.aggregate<{ count: number }>([
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
      sourceSessionId: { $exists: true, $ne: null },
      createdAt: { $gte: fromD, $lte: toD },
    }),
    Homework.countDocuments({
      ...matchSchool,
      sourceSessionId: { $exists: true, $ne: null },
      status: "published",
      publishedAt: { $gte: fromD, $lte: toD },
    }),
    Homework.aggregate<{ _id: string; n: number }>([
      {
        $match: {
          ...matchSchool,
          sourceSessionId: { $exists: true, $ne: null },
          createdAt: { $gte: fromD, $lte: toD },
        },
      },
      { $group: { _id: "$type", n: { $sum: 1 } } },
    ]),
    Homework.find({
      ...matchSchool,
      sourceSessionId: { $exists: true, $ne: null },
    }).distinct("_id") as Promise<Types.ObjectId[]>,
    Homework.aggregate<{ _id: Types.ObjectId; linkedTasksCreatedInRange: number }>([
      {
        $match: {
          ...matchSchool,
          sourceSessionId: { $exists: true, $ne: null },
          createdAt: { $gte: fromD, $lte: toD },
        },
      },
      { $group: { _id: "$teacherId", linkedTasksCreatedInRange: { $sum: 1 } } },
      { $sort: { linkedTasksCreatedInRange: -1 } },
      { $limit: 10 },
    ]),
    Homework.aggregate<{ _id: Types.ObjectId; linkedTasksCreatedInRange: number }>([
      {
        $match: {
          ...matchSchool,
          sourceSessionId: { $exists: true, $ne: null },
          createdAt: { $gte: fromD, $lte: toD },
        },
      },
      { $unwind: "$classGroupIds" },
      { $group: { _id: "$classGroupIds", linkedTasksCreatedInRange: { $sum: 1 } } },
      { $sort: { linkedTasksCreatedInRange: -1 } },
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

  const [teacherNames, classLabelMap, v2Coverage] = await Promise.all([
    teacherDisplayNames(schoolId, teacherIds),
    classLabels(schoolId, classIds),
    getV2CoverageAnalytics({ schoolId, from: fromD, to: toD }),
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
  const distinctStudentsInRange = distinctStudentsAgg[0]?.count ?? 0;
  const distinctStudentsCompletedInRange = completionsDistinctStudentsAgg[0]?.count ?? 0;
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
    Submission.aggregate<{
      _id: Types.ObjectId;
      gradedSubmissionsInRange: number;
      avgScore: number | null;
    }>([
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

  const teacherSubmissionMap = new Map(
    teacherSubmissionAgg.map((row) => [String(row._id), row.submissionsInRange])
  );
  const teacherGradedMap = new Map(
    teacherGradedAgg.map((row) => [
      String(row._id),
      {
        gradedSubmissionsInRange: row.gradedSubmissionsInRange,
        averageScorePercentInRange:
          row.avgScore != null
            ? Math.max(0, Math.min(100, Math.round(row.avgScore)))
            : null,
      },
    ])
  );
  const classSubmissionMap = new Map(
    classSubmissionAgg.map((row) => [String(row._id), row.submissionsInRange])
  );

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

  return {
    range: { from: fromD.toISOString(), to: toD.toISOString() },
    v2Coverage,
    createdInRange: { total: createdTotal, byStatus },
    publishedEventsInRange: deliveredInRange,
    currentDraftsTotal: draftsTotal,
    reflectionsCompletedInRange: reflectionsDone,
    topTeachers,
    classCoverage,
    curriculumCompletionInRange: {
      publishedLessonsInRange: deliveredInRange,
      studentSlotsTotal: engagementsInRange,
      completionsForPublishedLessonsInRange: completionsInRange,
      coveragePercent: completionRateAmongEngagementsPercent,
    },
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
      teacherRanking,
      classRanking,
    },
    // Collaboration removed in v2 — zeroed for backwards compatibility
    collaboration: {
      lessonsWithCollaboratorsTotal: 0,
      lessonsUpdatedByCollaboratorsInRange: 0,
      commentsCreatedInRange: 0,
      commentsResolvedInRange: 0,
      openCommentsNow: 0,
      hotspots: [],
    },
  };
}
