import "server-only";

import { Types } from "mongoose";
import type { LearnMobileStudentContext } from "@/lib/learn/mobile-auth";
import { getTeacherLearnClassIds, type TeacherLearnContext } from "@/lib/learn/teacher-learn-scope";
import { ClassGroup } from "@/models/ClassGroup";
import { DailyQuestAttempt } from "@/models/DailyQuestAttempt";
import { DailyQuestBoard, type DailyQuestBacklogPressure } from "@/models/DailyQuestBoard";
import { DailyQuestItem } from "@/models/DailyQuestItem";
import { StudentExploreRecord } from "@/models/StudentExploreRecord";
import { Student } from "@/models/Student";

type QuestHistoryBoardRow = {
  _id: Types.ObjectId;
  date: string;
  status: string;
  completionPercent: number;
  requiredCompletionPercent: number;
  completedItems: number;
  totalItems: number;
  xpEarned: number;
  totalXpAvailable: number;
  backlogPressure: DailyQuestBacklogPressure;
  rewards: {
    streakProtected: boolean;
    perfectDayAvailable: boolean;
  };
  recommendedNextItemId?: Types.ObjectId | null;
  createdAt: Date;
};

type CountRow = {
  _id: string;
  count: number;
};

type MissedReviewRow = {
  _id: {
    title: string;
    subjectName: string;
  };
  count: number;
};

type WeakConceptRow = {
  _id: string;
  count: number;
  averageScore: number;
};

type ExploreQueueRow = {
  _id: Types.ObjectId;
  boardId: Types.ObjectId;
  studentId: Types.ObjectId;
  classGroupId: Types.ObjectId;
  subjectName: string;
  title: string;
  explore: {
    unlockStatus: string;
    adventureId?: Types.ObjectId | null;
    unlockReason?: string | null;
  };
  updatedAt: Date;
};

type ParentSummaryBoardRow = {
  _id: Types.ObjectId;
  date: string;
  status: string;
  requiredCompletionPercent: number;
  completedItems: number;
  totalItems: number;
  xpEarned: number;
  backlogPressure: DailyQuestBacklogPressure;
  rewards?: {
    streakProtected?: boolean;
  };
};

type ParentSummaryItemRow = {
  _id: Types.ObjectId;
  boardId: Types.ObjectId;
  subjectName: string;
  title: string;
  status: string;
  completedAt?: Date | null;
  source?: {
    sourceLessonId?: Types.ObjectId | null;
  };
  explore?: {
    unlockStatus?: string;
    adventureId?: Types.ObjectId | null;
  };
};

type SubjectScoreRow = {
  _id: string;
  averageScore: number;
  attempts: number;
};

function startDateForDays(days: number) {
  const start = new Date();
  start.setDate(start.getDate() - Math.max(1, Math.min(days, 90)));
  return start;
}

function studentDisplayName(student: {
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
}) {
  return [student.firstName, student.middleName, student.lastName]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function getMobileDailyQuestHistory(
  context: LearnMobileStudentContext,
  limit = 14
) {
  const boards = await DailyQuestBoard.find({
    schoolId: context.schoolId,
    studentId: context.studentId,
  })
    .sort({ date: -1, createdAt: -1 })
    .limit(Math.min(Math.max(limit, 1), 30))
    .select(
      "_id date status completionPercent requiredCompletionPercent completedItems totalItems xpEarned totalXpAvailable backlogPressure rewards recommendedNextItemId createdAt"
    )
    .lean<QuestHistoryBoardRow[]>();

  return {
    boards: boards.map((board) => ({
      id: String(board._id),
      date: board.date,
      status: board.status,
      completionPercent: board.completionPercent,
      requiredCompletionPercent: board.requiredCompletionPercent,
      completedItems: board.completedItems,
      totalItems: board.totalItems,
      xpEarned: board.xpEarned,
      totalXpAvailable: board.totalXpAvailable,
      backlogPressure: board.backlogPressure,
      streakProtected: board.rewards.streakProtected,
      perfectDayAvailable: board.rewards.perfectDayAvailable,
      recommendedNextItemId: board.recommendedNextItemId
        ? String(board.recommendedNextItemId)
        : null,
      createdAt: board.createdAt.toISOString(),
    })),
  };
}

async function scopedClassIdsForReview(
  ctx: TeacherLearnContext,
  requestedClassGroupId?: string | null
) {
  const allowedClassIds = await getTeacherLearnClassIds(ctx);
  if (!requestedClassGroupId) return allowedClassIds;
  if (!Types.ObjectId.isValid(requestedClassGroupId)) return [];
  const requested = new Types.ObjectId(requestedClassGroupId);
  return allowedClassIds.some((id) => String(id) === String(requested)) ? [requested] : [];
}

async function loadNameMaps(input: {
  schoolId: Types.ObjectId;
  classGroupIds: Types.ObjectId[];
  studentIds: Types.ObjectId[];
}) {
  const [classes, students] = await Promise.all([
    ClassGroup.find({ _id: { $in: input.classGroupIds }, schoolId: input.schoolId })
      .select("_id name")
      .lean<Array<{ _id: Types.ObjectId; name: string }>>(),
    Student.find({ _id: { $in: input.studentIds }, schoolId: input.schoolId })
      .select("_id firstName middleName lastName")
      .lean<
        Array<{
          _id: Types.ObjectId;
          firstName?: string | null;
          middleName?: string | null;
          lastName?: string | null;
        }>
      >(),
  ]);

  return {
    classMap: new Map(classes.map((row) => [String(row._id), row.name])),
    studentMap: new Map(students.map((row) => [String(row._id), studentDisplayName(row)])),
  };
}

export async function getTeacherDailyQuestReview(
  ctx: TeacherLearnContext,
  filters?: {
    classGroupId?: string | null;
    days?: number;
    limit?: number;
  }
) {
  const classGroupIds = await scopedClassIdsForReview(ctx, filters?.classGroupId);
  const days = Math.max(1, Math.min(filters?.days ?? 14, 90));
  const limit = Math.max(1, Math.min(filters?.limit ?? 20, 50));
  const start = startDateForDays(days);

  if (classGroupIds.length === 0) {
    return {
      rangeDays: days,
      classGroupIds: [],
      totals: {
        boards: 0,
        completedBoards: 0,
        streakProtectedBoards: 0,
        averageCompletionPercent: 0,
        completionRatePercent: 0,
      },
      backlogPressure: [],
      mostMissedReviews: [],
      commonWeakConcepts: [],
      exploreReviewQueue: [],
    };
  }

  const boardMatch = {
    schoolId: ctx.schoolId,
    classGroupId: { $in: classGroupIds },
    createdAt: { $gte: start },
  };

  const [boards, backlogRows, missedRows, weakRows, exploreRows] = await Promise.all([
    DailyQuestBoard.find(boardMatch)
      .select("_id completionPercent requiredCompletionPercent status rewards backlogPressure")
      .lean<
        Array<{
          _id: Types.ObjectId;
          completionPercent: number;
          requiredCompletionPercent: number;
          status: string;
          rewards?: { streakProtected?: boolean };
          backlogPressure: DailyQuestBacklogPressure;
        }>
      >(),
    DailyQuestBoard.aggregate<CountRow>([
      { $match: boardMatch },
      { $group: { _id: "$backlogPressure", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    DailyQuestItem.aggregate<MissedReviewRow>([
      {
        $match: {
          schoolId: ctx.schoolId,
          classGroupId: { $in: classGroupIds },
          updatedAt: { $gte: start },
          status: { $in: ["carried_forward", "moved_to_revision_bank", "expired"] },
        },
      },
      { $group: { _id: { title: "$title", subjectName: "$subjectName" }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]),
    DailyQuestAttempt.aggregate<WeakConceptRow>([
      {
        $match: {
          schoolId: ctx.schoolId,
          submittedAt: { $gte: start },
          "weakConcepts.0": { $exists: true },
        },
      },
      {
        $lookup: {
          from: "dailyquestitems",
          localField: "itemId",
          foreignField: "_id",
          as: "item",
        },
      },
      { $unwind: "$item" },
      { $match: { "item.classGroupId": { $in: classGroupIds } } },
      { $unwind: "$weakConcepts" },
      {
        $group: {
          _id: "$weakConcepts",
          count: { $sum: 1 },
          averageScore: { $avg: "$scorePercent" },
        },
      },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]),
    DailyQuestItem.find({
      schoolId: ctx.schoolId,
      classGroupId: { $in: classGroupIds },
      updatedAt: { $gte: start },
      "explore.unlockStatus": { $in: ["available", "generating", "ready"] },
    })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .select("_id boardId studentId classGroupId subjectName title explore updatedAt")
      .lean<ExploreQueueRow[]>(),
  ]);

  const studentIds = Array.from(
    new Set(exploreRows.map((row) => String(row.studentId)))
  ).map((id) => new Types.ObjectId(id));
  const maps = await loadNameMaps({
    schoolId: ctx.schoolId,
    classGroupIds,
    studentIds,
  });

  const completedBoards = boards.filter((board) =>
    ["completed", "completed_with_bonus"].includes(board.status)
  ).length;
  const streakProtectedBoards = boards.filter(
    (board) => board.rewards?.streakProtected || board.requiredCompletionPercent >= 80
  ).length;
  const averageCompletionPercent =
    boards.length > 0
      ? Math.round(
          boards.reduce((sum, board) => sum + board.requiredCompletionPercent, 0) / boards.length
        )
      : 0;

  return {
    rangeDays: days,
    classGroupIds: classGroupIds.map(String),
    totals: {
      boards: boards.length,
      completedBoards,
      streakProtectedBoards,
      averageCompletionPercent,
      completionRatePercent:
        boards.length > 0 ? Math.round((completedBoards / boards.length) * 100) : 0,
    },
    backlogPressure: backlogRows.map((row) => ({
      pressure: row._id,
      count: row.count,
    })),
    mostMissedReviews: missedRows.map((row) => ({
      title: row._id.title,
      subjectName: row._id.subjectName,
      count: row.count,
    })),
    commonWeakConcepts: weakRows.map((row) => ({
      concept: row._id,
      count: row.count,
      averageScorePercent: Math.round(row.averageScore),
    })),
    exploreReviewQueue: exploreRows.map((row) => ({
      questItemId: String(row._id),
      boardId: String(row.boardId),
      studentId: String(row.studentId),
      studentName: maps.studentMap.get(String(row.studentId)) || "Student",
      classGroupId: String(row.classGroupId),
      classGroupName: maps.classMap.get(String(row.classGroupId)) || "Class",
      subjectName: row.subjectName,
      title: row.title,
      unlockStatus: row.explore.unlockStatus,
      unlockReason: row.explore.unlockReason ?? null,
      adventureId: row.explore.adventureId ? String(row.explore.adventureId) : null,
      updatedAt: row.updatedAt.toISOString(),
    })),
  };
}

export async function getParentDailyQuestSummary(input: {
  schoolId: Types.ObjectId;
  studentId: Types.ObjectId;
  days?: number;
}) {
  const days = Math.max(1, Math.min(input.days ?? 14, 30));
  const start = startDateForDays(days);

  const [student, latestBoard, recentBoards] = await Promise.all([
    Student.findOne({ _id: input.studentId, schoolId: input.schoolId })
      .select("_id firstName middleName lastName")
      .lean<{
        _id: Types.ObjectId;
        firstName?: string | null;
        middleName?: string | null;
        lastName?: string | null;
      } | null>(),
    DailyQuestBoard.findOne({ schoolId: input.schoolId, studentId: input.studentId })
      .sort({ date: -1, createdAt: -1 })
      .select(
        "_id date status requiredCompletionPercent completedItems totalItems xpEarned backlogPressure rewards"
      )
      .lean<ParentSummaryBoardRow | null>(),
    DailyQuestBoard.find({
      schoolId: input.schoolId,
      studentId: input.studentId,
      createdAt: { $gte: start },
    })
      .sort({ date: -1 })
      .select(
        "_id date status requiredCompletionPercent completedItems totalItems xpEarned backlogPressure rewards"
      )
      .lean<ParentSummaryBoardRow[]>(),
  ]);

  if (!student) {
    return {
      ok: false as const,
      code: "STUDENT_NOT_FOUND",
      status: 404,
      friendlyMessage: "We could not find this learner's Daily Quest summary.",
    };
  }

  const boardIds = recentBoards.map((board) => board._id);
  const [reviewedItems, catchUpItems, subjectScores, weakSubjects, exploreItems, exploreRecords] =
    await Promise.all([
      DailyQuestItem.find({
        schoolId: input.schoolId,
        studentId: input.studentId,
        boardId: { $in: boardIds },
        status: "completed",
      })
        .sort({ completedAt: -1, updatedAt: -1 })
        .limit(8)
        .select("_id boardId subjectName title status completedAt source explore")
        .lean<ParentSummaryItemRow[]>(),
      DailyQuestItem.find({
        schoolId: input.schoolId,
        studentId: input.studentId,
        boardId: { $in: boardIds },
        status: { $in: ["carried_forward", "moved_to_revision_bank"] },
      })
        .sort({ updatedAt: -1 })
        .limit(5)
        .select("_id boardId subjectName title status completedAt source explore")
        .lean<ParentSummaryItemRow[]>(),
      DailyQuestAttempt.aggregate<SubjectScoreRow>([
        {
          $match: {
            schoolId: input.schoolId,
            studentId: input.studentId,
            submittedAt: { $gte: start },
          },
        },
        {
          $lookup: {
            from: "dailyquestitems",
            localField: "itemId",
            foreignField: "_id",
            as: "item",
          },
        },
        { $unwind: "$item" },
        {
          $group: {
            _id: "$item.subjectName",
            averageScore: { $avg: "$scorePercent" },
            attempts: { $sum: 1 },
          },
        },
        { $sort: { averageScore: -1, attempts: -1 } },
      ]),
      DailyQuestAttempt.aggregate<SubjectScoreRow>([
        {
          $match: {
            schoolId: input.schoolId,
            studentId: input.studentId,
            submittedAt: { $gte: start },
            $or: [{ scorePercent: { $lt: 70 } }, { "weakConcepts.0": { $exists: true } }],
          },
        },
        {
          $lookup: {
            from: "dailyquestitems",
            localField: "itemId",
            foreignField: "_id",
            as: "item",
          },
        },
        { $unwind: "$item" },
        {
          $group: {
            _id: "$item.subjectName",
            averageScore: { $avg: "$scorePercent" },
            attempts: { $sum: 1 },
          },
        },
        { $sort: { attempts: -1, averageScore: 1 } },
      ]),
      DailyQuestItem.find({
        schoolId: input.schoolId,
        studentId: input.studentId,
        boardId: { $in: boardIds },
        "explore.unlockStatus": { $in: ["available", "ready", "completed"] },
      })
        .sort({ updatedAt: -1 })
        .limit(8)
        .select("_id boardId subjectName title status completedAt source explore")
        .lean<ParentSummaryItemRow[]>(),
      StudentExploreRecord.find({
        schoolId: input.schoolId,
        studentId: input.studentId,
        updatedAt: { $gte: start },
      })
        .sort({ updatedAt: -1 })
        .limit(8)
        .select("adventureId status completedAt quizScorePercent updatedAt")
        .lean<
          Array<{
            adventureId: Types.ObjectId;
            status: string;
            completedAt?: Date | null;
            quizScorePercent?: number | null;
            updatedAt: Date;
          }>
        >(),
    ]);

  const studentName = studentDisplayName(student) || "Your learner";
  const strongest = subjectScores[0] ?? null;
  const needsSupport = weakSubjects[0] ?? subjectScores.at(-1) ?? null;
  const latestCompletion = latestBoard?.requiredCompletionPercent ?? 0;
  const streakProtected = Boolean(latestBoard?.rewards?.streakProtected);
  const completedExploreCount = exploreRecords.filter((record) => record.status === "completed").length;

  return {
    ok: true as const,
    data: {
      student: {
        id: String(student._id),
        name: studentName,
      },
      rangeDays: days,
      latestBoard: latestBoard
        ? {
            id: String(latestBoard._id),
            date: latestBoard.date,
            status: latestBoard.status,
            completionPercent: latestCompletion,
            completedItems: latestBoard.completedItems,
            totalItems: latestBoard.totalItems,
            xpEarned: latestBoard.xpEarned,
            backlogPressure: latestBoard.backlogPressure,
            streakProtected,
            message: streakProtected
              ? `${studentName}'s learning streak is protected.`
              : `${studentName} still has a gentle review path waiting.`,
          }
        : null,
      reviewedLessons: reviewedItems.map((item) => ({
        questItemId: String(item._id),
        subjectName: item.subjectName,
        title: item.title,
        completedAt: item.completedAt?.toISOString?.() ?? null,
      })),
      strongestSubject: strongest
        ? {
            subjectName: strongest._id,
            averageScorePercent: Math.round(strongest.averageScore),
            attempts: strongest.attempts,
          }
        : null,
      needsSupportSubject: needsSupport
        ? {
            subjectName: needsSupport._id,
            averageScorePercent: Math.round(needsSupport.averageScore),
            attempts: needsSupport.attempts,
            message: `${studentName} may benefit from a calm review in ${needsSupport._id}.`,
          }
        : null,
      catchUpSavedForTomorrow: catchUpItems.map((item) => ({
        questItemId: String(item._id),
        subjectName: item.subjectName,
        title: item.title,
        status: item.status,
      })),
      explore: {
        unlockedCount: exploreItems.length,
        completedCount: completedExploreCount,
        items: exploreItems.map((item) => ({
          questItemId: String(item._id),
          subjectName: item.subjectName,
          title: item.title,
          unlockStatus: item.explore?.unlockStatus ?? "available",
          adventureId: item.explore?.adventureId ? String(item.explore.adventureId) : null,
        })),
      },
      parentConversationPrompt:
        reviewedItems.length > 0
          ? `Ask ${studentName}: "Which part of ${reviewedItems[0].title} made the most sense today?"`
          : `Ask ${studentName}: "What is one lesson Leo can help you revise this week?"`,
    },
  };
}
