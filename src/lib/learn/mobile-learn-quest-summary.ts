import { Types } from "mongoose";
import { generateDailyQuestBoardForStudent } from "@/lib/learn/daily-quest";
import { DailyQuestItem } from "@/models/DailyQuestItem";

export async function buildLearnQuestBoardSummary(input: {
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

  const catchUpItems = await DailyQuestItem.countDocuments({
    schoolId: input.schoolId,
    studentId: input.studentId,
    boardId: result.board._id,
    status: { $ne: "completed" },
    $or: [
      { lifecycle: "catch_up" },
      { type: "catch_up_review" },
      { type: "spaced_repetition" },
    ],
  });

  const recommended = result.board.recommendedNextItemId
    ? await DailyQuestItem.findOne({
        _id: result.board.recommendedNextItemId,
        schoolId: input.schoolId,
        studentId: input.studentId,
      })
        .select("_id subjectName title estimatedMinutes")
        .lean<{
          _id: Types.ObjectId;
          subjectName: string;
          title: string;
          estimatedMinutes?: number;
        } | null>()
    : null;

  const boardDate = result.board.boardDate
    ? new Date(result.board.boardDate).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  return {
    boardId: String(result.board._id),
    date: boardDate,
    title: "Today's Quest with Leo",
    completionPercent: result.board.completionPercent,
    completedRequiredItems: result.board.completedItems,
    totalRequiredItems: result.board.totalItems,
    xpEarned: result.board.xpEarned,
    totalXpAvailable: result.board.totalXpAvailable,
    streakProtected: result.board.rewards.streakProtected,
    status: result.board.status,
    nextItem: recommended
      ? {
          id: String(recommended._id),
          title: recommended.title,
          subjectName: recommended.subjectName,
          estimatedMinutes: recommended.estimatedMinutes ?? 5,
          route: "/(student)/quest/[itemId]",
          routeParams: { itemId: String(recommended._id) },
        }
      : undefined,
    catchUpSummary:
      catchUpItems > 0
        ? {
            count: catchUpItems,
            message: `Leo saved ${catchUpItems} important review${catchUpItems === 1 ? "" : "s"} for gentle catch-up.`,
          }
        : undefined,
  };
}
