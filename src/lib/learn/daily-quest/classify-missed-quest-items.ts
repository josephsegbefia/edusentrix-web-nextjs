import "server-only";

import { Types } from "mongoose";
import { DailyQuestBoard, type DailyQuestBacklogPressure } from "@/models/DailyQuestBoard";
import { DailyQuestItem, type IDailyQuestItem } from "@/models/DailyQuestItem";
import { RevisionBankItem, type RevisionBankItemReason } from "@/models/RevisionBankItem";

const CATCH_UP_POLICY = {
  maxVisibleCatchUpItemsPerDay: 2,
  maxCatchUpRequiredWeightPerDay: 3,
  maxCatchUpAgeInSchoolDays: 5,
  quickChecksExpireAfterSchoolDays: 1,
} as const;

type MissedQuestClassification = "catch_up" | "revision_bank" | "expired" | "completed";

export type ClassifyMissedQuestItemsInput = {
  schoolId: Types.ObjectId;
  studentId: Types.ObjectId;
  classGroupId: Types.ObjectId;
  today: string;
};

export type ClassifyMissedQuestItemsResult = {
  catchUpCount: number;
  revisionBankCount: number;
  expiredCount: number;
  completedCount: number;
  backlogPressureScore: number;
  backlogPressure: DailyQuestBacklogPressure;
};

function dateFromKey(dateKey: string) {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

function ageInSchoolDays(today: string, boardDate: string) {
  const diff = dateFromKey(today).getTime() - dateFromKey(boardDate).getTime();
  return Math.max(0, Math.floor(diff / 86_400_000));
}

function classifyItem(item: IDailyQuestItem, age: number): MissedQuestClassification {
  if (item.status === "completed") return "completed";
  if (item.type === "explore_unlock") return "expired";
  if (item.type === "quick_check" && age > CATCH_UP_POLICY.quickChecksExpireAfterSchoolDays) {
    return "revision_bank";
  }
  if (item.required && age <= 1) return "catch_up";
  if (item.priorityReason === "weak_topic" && age <= CATCH_UP_POLICY.maxCatchUpAgeInSchoolDays) {
    return "catch_up";
  }
  if (age <= CATCH_UP_POLICY.maxCatchUpAgeInSchoolDays) return "revision_bank";
  return "expired";
}

function revisionReasonFor(item: IDailyQuestItem): RevisionBankItemReason {
  if (item.priorityReason === "weak_topic" || item.type === "weak_spot_rescue") {
    return "weak_topic";
  }
  if (item.priorityReason === "teacher_priority") return "teacher_priority";
  if (item.type === "spaced_repetition") return "spaced_repetition";
  return "missed_quest";
}

function conceptTitleFor(item: IDailyQuestItem) {
  return item.recap?.lessonTitle || item.title.replace(/^Quick check:\s*/i, "").replace(/^Review\s+/i, "");
}

function conceptTagsFor(item: IDailyQuestItem) {
  const quizTags = (item.quizQuestions ?? []).flatMap((question) => question.weakConceptTags ?? []);
  return Array.from(new Set([conceptTitleFor(item), ...quizTags].filter(Boolean))).slice(0, 8);
}

async function moveToRevisionBank(item: IDailyQuestItem, priorityScore: number) {
  const existing = await RevisionBankItem.findOne({
    schoolId: item.schoolId,
    studentId: item.studentId,
    sourceBoardId: item.boardId,
    sourceItemId: item._id,
    status: { $in: ["active", "selected_for_board"] },
  }).select("_id");

  if (existing) return false;

  await RevisionBankItem.create({
    schoolId: item.schoolId,
    studentId: item.studentId,
    classGroupId: item.classGroupId,
    subjectOfferingId: item.subjectOfferingId ?? null,
    subjectId: item.subjectId ?? null,
    subjectName: item.subjectName,
    lessonId: item.lessonId ?? null,
    conceptTitle: conceptTitleFor(item),
    conceptTags: conceptTagsFor(item),
    sourceBoardId: item.boardId,
    sourceItemId: item._id,
    reason: revisionReasonFor(item),
    priorityScore,
    status: "active",
  });

  return true;
}

function pressureBand(score: number): DailyQuestBacklogPressure {
  if (score <= 0) return "none";
  if (score <= 3) return "light";
  if (score <= 8) return "moderate";
  return "recovery";
}

function itemPressure(item: IDailyQuestItem, age: number) {
  const requiredWeight = item.required ? item.weight : 0;
  const weakTopicWeight = item.priorityReason === "weak_topic" ? 2 : 0;
  const startedWeight = item.status === "in_progress" ? 1 : 0;
  const daysMissedPenalty = Math.min(age, 4);
  return requiredWeight + weakTopicWeight + startedWeight + daysMissedPenalty;
}

export async function classifyMissedQuestItems(
  input: ClassifyMissedQuestItemsInput
): Promise<ClassifyMissedQuestItemsResult> {
  const oldBoards = await DailyQuestBoard.find({
    schoolId: input.schoolId,
    studentId: input.studentId,
    classGroupId: input.classGroupId,
    date: { $lt: input.today },
    status: { $nin: ["completed", "completed_with_bonus", "closed"] },
  })
    .sort({ date: -1 })
    .select("_id date")
    .lean<Array<{ _id: Types.ObjectId; date: string }>>();

  if (oldBoards.length === 0) {
    return {
      catchUpCount: 0,
      revisionBankCount: 0,
      expiredCount: 0,
      completedCount: 0,
      backlogPressureScore: 0,
      backlogPressure: "none",
    };
  }

  const boardDateById = new Map(oldBoards.map((board) => [String(board._id), board.date]));
  const items = await DailyQuestItem.find({
    schoolId: input.schoolId,
    studentId: input.studentId,
    classGroupId: input.classGroupId,
    boardId: { $in: oldBoards.map((board) => board._id) },
    status: { $nin: ["completed", "expired", "moved_to_revision_bank", "skipped_by_system"] },
  }).sort({ priorityScore: -1, updatedAt: -1 });

  let catchUpCount = 0;
  let catchUpWeight = 0;
  let revisionBankCount = 0;
  let expiredCount = 0;
  let completedCount = 0;
  let backlogPressureScore = 0;

  for (const item of items) {
    const boardDate = boardDateById.get(String(item.boardId)) ?? input.today;
    const age = ageInSchoolDays(input.today, boardDate);
    const classification = classifyItem(item, age);
    backlogPressureScore += itemPressure(item, age);

    if (
      classification === "catch_up" &&
      catchUpCount < CATCH_UP_POLICY.maxVisibleCatchUpItemsPerDay &&
      catchUpWeight + item.weight <= CATCH_UP_POLICY.maxCatchUpRequiredWeightPerDay
    ) {
      item.status = "carried_forward";
      item.lifecycle = "catch_up";
      item.priorityReason = "started_but_incomplete";
      item.priorityLabel = "Saved by Leo";
      item.priorityScore += Math.max(0, 16 - age * 3);
      item.lastActivityAt = new Date();
      await item.save();
      catchUpCount += 1;
      catchUpWeight += item.weight;
      continue;
    }

    if (classification === "completed") {
      completedCount += 1;
      continue;
    }

    if (classification === "expired") {
      item.status = "expired";
      item.lifecycle = "expired";
      item.lastActivityAt = new Date();
      await item.save();
      expiredCount += 1;
      continue;
    }

    const created = await moveToRevisionBank(
      item,
      item.priorityScore + Math.max(5, 24 - age * 2)
    );
    item.status = "moved_to_revision_bank";
    item.lifecycle = "revision_bank";
    item.lastActivityAt = new Date();
    await item.save();
    if (created) revisionBankCount += 1;
  }

  await DailyQuestBoard.updateMany(
    { _id: { $in: oldBoards.map((board) => board._id) } },
    { $set: { status: "closed", closedAt: new Date() } }
  );

  return {
    catchUpCount,
    revisionBankCount,
    expiredCount,
    completedCount,
    backlogPressureScore,
    backlogPressure: pressureBand(backlogPressureScore),
  };
}
