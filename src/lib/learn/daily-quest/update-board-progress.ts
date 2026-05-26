import "server-only";

import { Types } from "mongoose";
import {
  DailyQuestBoard,
  type DailyQuestBoardStatus,
  type IDailyQuestBoard,
} from "@/models/DailyQuestBoard";
import { DailyQuestItem, type IDailyQuestItem } from "@/models/DailyQuestItem";

export type UpdateDailyQuestBoardProgressResult = {
  board: IDailyQuestBoard;
  items: IDailyQuestItem[];
};

function weightedRequiredCompletion(input: {
  requiredItems: IDailyQuestItem[];
  totalRequiredWeight: number;
}) {
  if (input.totalRequiredWeight <= 0) return 100;

  const weightedProgress = input.requiredItems.reduce((sum, item) => {
    const itemProgress = item.status === "completed" ? 100 : item.completionPercent;
    return sum + item.weight * Math.min(100, Math.max(0, itemProgress));
  }, 0);

  return Math.round(weightedProgress / input.totalRequiredWeight);
}

function completedRequiredWeight(requiredItems: IDailyQuestItem[]) {
  return requiredItems
    .filter((item) => item.status === "completed")
    .reduce((sum, item) => sum + item.weight, 0);
}

function nextItem(items: IDailyQuestItem[]) {
  return (
    items.find((item) => item.status !== "completed" && item.required) ??
    items.find((item) => item.status !== "completed") ??
    null
  );
}

function resolveBoardStatus(input: {
  currentStatus: DailyQuestBoardStatus;
  completedItems: number;
  totalItems: number;
  requiredCompletionPercent: number;
  streakProtectionPercent: number;
  hasOptionalIncomplete: boolean;
}) {
  if (input.totalItems > 0 && input.completedItems >= input.totalItems) {
    return "completed_with_bonus";
  }

  if (input.requiredCompletionPercent >= 100) {
    return input.hasOptionalIncomplete ? "completed" : "completed_with_bonus";
  }

  if (input.requiredCompletionPercent >= input.streakProtectionPercent) {
    return "streak_protected";
  }

  if (input.completedItems > 0 || input.currentStatus === "in_progress") {
    return "in_progress";
  }

  return "not_started";
}

export async function updateDailyQuestBoardProgress(
  boardId: Types.ObjectId
): Promise<UpdateDailyQuestBoardProgressResult | null> {
  const [board, items] = await Promise.all([
    DailyQuestBoard.findById(boardId),
    DailyQuestItem.find({ boardId }).sort({ displayOrder: 1 }),
  ]);

  if (!board) return null;

  const completedItems = items.filter((item) => item.status === "completed");
  const requiredItems = items.filter((item) => item.required);
  const completedRequiredItems = requiredItems.filter((item) => item.status === "completed");
  const totalRequiredWeight = requiredItems.reduce((sum, item) => sum + item.weight, 0);
  const requiredCompletionPercent = weightedRequiredCompletion({
    requiredItems,
    totalRequiredWeight,
  });
  const hasOptionalIncomplete = items.some((item) => !item.required && item.status !== "completed");
  const recommendedNext = nextItem(items);

  board.completedItems = completedItems.length;
  board.totalItems = items.length;
  board.requiredItems = requiredItems.length;
  board.completedRequiredItems = completedRequiredItems.length;
  board.completedRequiredWeight = completedRequiredWeight(requiredItems);
  board.totalRequiredWeight = totalRequiredWeight;
  board.completionPercent = requiredCompletionPercent;
  board.requiredCompletionPercent = requiredCompletionPercent;
  board.totalEstimatedMinutes = items.reduce((sum, item) => sum + item.estimatedMinutes, 0);
  board.totalXpAvailable = items.reduce((sum, item) => sum + item.xpReward, 0);
  board.xpEarned = completedItems.reduce((sum, item) => sum + item.xpAwarded, 0);
  board.recommendedNextItemId = recommendedNext?._id ?? null;
  board.rewards.baseXp = board.totalXpAvailable;
  board.rewards.streakProtected = requiredCompletionPercent >= board.streakProtectionPercent;
  board.rewards.perfectDayAvailable = hasOptionalIncomplete || items.length > 0;
  board.status = resolveBoardStatus({
    currentStatus: board.status,
    completedItems: completedItems.length,
    totalItems: items.length,
    requiredCompletionPercent,
    streakProtectionPercent: board.streakProtectionPercent,
    hasOptionalIncomplete,
  });

  await board.save();
  return { board, items };
}
