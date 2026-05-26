import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { getStudentLearnAccess } from "@/lib/learn/access";
import type { LearnMobileStudentContext } from "@/lib/learn/mobile-auth";
import { recordLearnMobileActivity } from "@/lib/learn/mobile-activity";
import {
  generateDailyQuestBoardForStudent,
  updateDailyQuestBoardProgress,
} from "@/lib/learn/daily-quest";
import { DailyQuestAttempt } from "@/models/DailyQuestAttempt";
import { DailyQuestBoard, type IDailyQuestBoard } from "@/models/DailyQuestBoard";
import { DailyQuestItem, type IDailyQuestItem } from "@/models/DailyQuestItem";
import { RevisionBankItem } from "@/models/RevisionBankItem";

type QuestBoardResult<T> =
  | { ok: true; data: T; meta?: Record<string, unknown> }
  | { ok: false; code: string; message: string; status: number };

type QuestAnswerInput = { questionId: string; optionId: string };

const SECTION_LABELS = {
  core_reviews: {
    title: "Core Reviews",
    description: "Start here. These protect your daily learning streak.",
    displayOrder: 1,
  },
  quick_checks: {
    title: "Quick Checks",
    description: "Short practice for lessons that need a light refresh.",
    displayOrder: 2,
  },
  catch_up: {
    title: "Catch-Up",
    description: "A calm way to finish older work without overload.",
    displayOrder: 3,
  },
  leo_rescue: {
    title: "Leo Rescue",
    description: "Extra support for a weak spot Leo noticed.",
    displayOrder: 4,
  },
  bonus_explore: {
    title: "Bonus Explore",
    description: "Optional adventures after your reviews are handled.",
    displayOrder: 5,
  },
  completed: {
    title: "Completed",
    description: "Finished items from today.",
    displayOrder: 6,
  },
} as const;

function id(value?: Types.ObjectId | null) {
  return value ? String(value) : undefined;
}

function iso(value?: Date | null) {
  return value ? value.toISOString() : undefined;
}

function sectionTypeForItem(item: Pick<IDailyQuestItem, "type" | "lifecycle" | "status">) {
  if (item.status === "completed") return "completed";
  if (item.type === "weak_spot_rescue") return "leo_rescue";
  if (item.type === "explore_unlock") return "bonus_explore";
  if (item.lifecycle === "catch_up" || item.type === "catch_up_review" || item.type === "spaced_repetition") {
    return "catch_up";
  }
  if (item.type === "quick_check") return "quick_checks";
  return "core_reviews";
}

function serializeItemSummary(item: IDailyQuestItem) {
  return {
    id: String(item._id),
    boardId: String(item.boardId),
    type: item.type,
    lessonId: id(item.lessonId),
    subjectId: id(item.subjectId) ?? "",
    subjectName: item.subjectName,
    title: item.title,
    description: item.description,
    estimatedMinutes: item.estimatedMinutes,
    xpReward: item.xpReward,
    status: item.status,
    lifecycle: item.lifecycle,
    required: item.required,
    weight: item.weight,
    completionPercent: item.completionPercent,
    priorityReason: item.priorityReason,
    priorityLabel: item.priorityLabel,
    lastActivityAt: iso(item.lastActivityAt),
    completedAt: iso(item.completedAt),
    canUnlockExplore: item.explore.canUnlockExplore,
    exploreAdventureId: id(item.explore.adventureId),
  };
}

function serializeBoard(board: IDailyQuestBoard, items: IDailyQuestItem[]) {
  const sections = Object.entries(SECTION_LABELS)
    .map(([type, label]) => {
      const sectionItems = items
        .filter((item) => sectionTypeForItem(item) === type)
        .sort((left, right) => left.displayOrder - right.displayOrder)
        .map(serializeItemSummary);

      return {
        id: type,
        type,
        ...label,
        items: sectionItems,
      };
    })
    .filter((section) => section.items.length > 0);

  const recommended = items.find((item) => String(item._id) === String(board.recommendedNextItemId));

  return {
    id: String(board._id),
    date: board.date,
    title: "Today's Quest with Leo",
    greeting:
      board.totalItems > 0
        ? `${board.completedItems} of ${board.totalItems} reviews complete`
        : "Your quest board will appear after class lessons are ready.",
    status: board.status,
    completionPercent: board.completionPercent,
    requiredCompletionPercent: board.requiredCompletionPercent,
    streakProtectionPercent: board.streakProtectionPercent,
    completedItems: board.completedItems,
    totalItems: board.totalItems,
    requiredItems: board.requiredItems,
    completedRequiredItems: board.completedRequiredItems,
    completedRequiredWeight: board.completedRequiredWeight,
    totalRequiredWeight: board.totalRequiredWeight,
    totalEstimatedMinutes: board.totalEstimatedMinutes,
    totalXpAvailable: board.totalXpAvailable,
    xpEarned: board.xpEarned,
    recommendedNextItemId: id(board.recommendedNextItemId),
    recommendedNextLabel: recommended
      ? `${recommended.subjectName} - ${recommended.title}`
      : undefined,
    backlogPressure: board.backlogPressure,
    sections,
    rewards: {
      baseXp: board.rewards.baseXp,
      bonusXp: board.rewards.bonusXp,
      streakProtected: board.rewards.streakProtected,
      streakMessage: board.rewards.streakProtected
        ? "Your learning streak is protected today."
        : "Finish the core reviews to protect your streak.",
      perfectDayAvailable: board.rewards.perfectDayAvailable,
    },
  };
}

function itemIntro(item: IDailyQuestItem) {
  if (item.type === "weak_spot_rescue") {
    return "Leo picked this rescue round to help you rebuild confidence before moving on.";
  }
  if (item.type === "quick_check") {
    return "A short check-in: review the recap, flip the cards, then answer the quiz.";
  }
  return "Review the lesson recap, warm up with flashcards, then finish the quiz.";
}

function serializeItemDetail(item: IDailyQuestItem, result?: unknown) {
  return {
    ...serializeItemSummary(item),
    intro: itemIntro(item),
    lessonMeta: {
      lessonTitle: item.recap?.lessonTitle ?? item.title,
      teacherName: item.recap?.teacherName,
      coveredDate: item.recap?.coveredDate ?? "Today",
      source: item.source.sourceType === "revision_bank" ? "revision_bank" : "teacher_lesson",
    },
    recap: item.recap ?? {
      lessonTitle: item.title,
      coveredDate: "Today",
      summary: item.description,
    },
    flashcards: item.flashcards ?? [],
    quizQuestions: item.quizQuestions ?? [],
    result,
  };
}

async function loadBoardItems(boardId: Types.ObjectId) {
  return DailyQuestItem.find({ boardId }).sort({ displayOrder: 1 }).lean<IDailyQuestItem[]>();
}

async function ensureAccess(context: LearnMobileStudentContext) {
  const access = await getStudentLearnAccess({
    schoolId: context.schoolId,
    studentId: context.studentId,
    accountId: context.accountId,
  });

  if (!access.hasAccess) {
    return {
      ok: false as const,
      code: access.schoolEligible ? "LEARN_ACCESS_REQUIRED" : "SCHOOL_NOT_ELIGIBLE",
      message: access.blockedReason || "EduSentrix Learn access is required.",
      status: 403,
    };
  }

  if (!context.classGroupId) {
    return {
      ok: false as const,
      code: "NO_STUDENT_PROFILE",
      message: "Student class group not found.",
      status: 404,
    };
  }

  return { ok: true as const, classGroupId: context.classGroupId };
}

export async function resolveTodayQuestBoard(
  context: LearnMobileStudentContext
): Promise<QuestBoardResult<ReturnType<typeof serializeBoard>>> {
  await connectToDatabase();

  const access = await ensureAccess(context);
  if (!access.ok) return access;

  try {
    const result = await generateDailyQuestBoardForStudent({
      schoolId: context.schoolId,
      studentId: context.studentId,
      userId: context.accountId,
      classGroupId: access.classGroupId,
      gradeId: context.gradeId,
    });
    const items = await loadBoardItems(result.board._id);

    return {
      ok: true,
      data: serializeBoard(result.board, items),
      meta: { generated: result.created, source: "backend_daily_quest_board_v1" },
    };
  } catch (error) {
    console.error("[learn/mobile/quests/board]", error);
    return {
      ok: false,
      code: "QUEST_BOARD_UNAVAILABLE",
      message: "Daily Quest Board is not available yet.",
      status: 500,
    };
  }
}

async function loadScopedItem(context: LearnMobileStudentContext, itemId: string) {
  if (!Types.ObjectId.isValid(itemId)) return null;
  return DailyQuestItem.findOne({
    _id: new Types.ObjectId(itemId),
    schoolId: context.schoolId,
    studentId: context.studentId,
  });
}

export async function loadQuestItemDetail(
  context: LearnMobileStudentContext,
  itemId: string
): Promise<QuestBoardResult<ReturnType<typeof serializeItemDetail>>> {
  await connectToDatabase();

  const access = await ensureAccess(context);
  if (!access.ok) return access;

  const item = await loadScopedItem(context, itemId);
  if (!item) {
    return { ok: false, code: "QUEST_ITEM_NOT_FOUND", message: "Quest item not found.", status: 404 };
  }

  return { ok: true, data: serializeItemDetail(item) };
}

export async function startQuestItem(
  context: LearnMobileStudentContext,
  itemId: string
): Promise<QuestBoardResult<ReturnType<typeof serializeItemDetail>>> {
  await connectToDatabase();

  const access = await ensureAccess(context);
  if (!access.ok) return access;

  const item = await loadScopedItem(context, itemId);
  if (!item) {
    return { ok: false, code: "QUEST_ITEM_NOT_FOUND", message: "Quest item not found.", status: 404 };
  }

  if (item.status !== "completed") {
    item.status = "in_progress";
    item.startedAt = item.startedAt ?? new Date();
    item.lastActivityAt = new Date();
    item.completionPercent = Math.max(item.completionPercent, 10);
    await item.save();
  }

  await updateDailyQuestBoardProgress(item.boardId);

  return { ok: true, data: serializeItemDetail(item) };
}

export async function updateQuestItemProgress(input: {
  context: LearnMobileStudentContext;
  itemId: string;
  progressPercent: number;
}): Promise<QuestBoardResult<ReturnType<typeof serializeItemDetail>>> {
  await connectToDatabase();

  const access = await ensureAccess(input.context);
  if (!access.ok) return access;

  const item = await loadScopedItem(input.context, input.itemId);
  if (!item) {
    return { ok: false, code: "QUEST_ITEM_NOT_FOUND", message: "Quest item not found.", status: 404 };
  }

  if (item.status !== "completed") {
    item.status = item.status === "not_started" ? "in_progress" : item.status;
    item.completionPercent = Math.max(
      item.completionPercent,
      Math.min(95, Math.max(0, input.progressPercent))
    );
    item.lastActivityAt = new Date();
    await item.save();
    await updateDailyQuestBoardProgress(item.boardId);
  }

  return { ok: true, data: serializeItemDetail(item) };
}

function resultRecommendation(
  item: IDailyQuestItem,
  scorePercent: number,
  boardItems: IDailyQuestItem[]
) {
  const nextItem = boardItems.find((row) => row.status !== "completed");

  if (scorePercent < 70) {
    return {
      type: "leo_rescue" as const,
      itemId: nextItem?.type === "weak_spot_rescue" ? String(nextItem._id) : undefined,
      title: "Do a Leo rescue round",
      description: "Leo can slow this topic down and help you rebuild it.",
    };
  }

  if (item.explore.canUnlockExplore) {
    return {
      type: "explore" as const,
      itemId: String(item._id),
      title: "Unlock a deeper adventure",
      description: "You are ready to explore this lesson in a more playful way.",
    };
  }

  if (nextItem) {
    return {
      type: "next_quest_item" as const,
      itemId: String(nextItem._id),
      title: nextItem.title,
      description: nextItem.description,
    };
  }

  return {
    type: "done_for_today" as const,
    title: "Daily Quest complete",
    description: "You have handled the important reviews for today.",
  };
}

export async function submitQuestItem(input: {
  context: LearnMobileStudentContext;
  itemId: string;
  answers: QuestAnswerInput[];
  elapsedSeconds?: number;
}) {
  await connectToDatabase();

  const access = await ensureAccess(input.context);
  if (!access.ok) return access;

  const item = await loadScopedItem(input.context, input.itemId);
  if (!item) {
    return { ok: false as const, code: "QUEST_ITEM_NOT_FOUND", message: "Quest item not found.", status: 404 };
  }

  const answerMap = new Map(input.answers.map((answer) => [answer.questionId, answer.optionId]));
  const quizQuestions = item.quizQuestions ?? [];
  const answers = quizQuestions.map((question) => {
    const optionId = answerMap.get(question.id) ?? "";
    return {
      questionId: question.id,
      optionId,
      correct: optionId === question.correctOptionId,
    };
  });
  const correctCount = answers.filter((answer) => answer.correct).length;
  const totalCount = quizQuestions.length;
  const scorePercent = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
  const xpAwarded = Math.round((scorePercent / 100) * item.xpReward);
  const weakConcepts = quizQuestions
    .filter((question) => answerMap.get(question.id) !== question.correctOptionId)
    .flatMap((question) => question.weakConceptTags ?? []);
  const misconceptionTags = quizQuestions
    .filter((question) => answerMap.get(question.id) !== question.correctOptionId)
    .flatMap((question) => question.misconceptionTags ?? []);

  const boardBefore = await DailyQuestBoard.findById(item.boardId).select("completionPercent");
  item.status = "completed";
  item.lifecycle = "completed";
  item.completionPercent = 100;
  item.completedAt = new Date();
  item.lastActivityAt = new Date();
  item.xpAwarded = xpAwarded;
  if (scorePercent >= 70 && item.explore.canUnlockExplore) {
    item.explore.unlockStatus = "available";
    item.explore.unlockReason = "score_ready";
  }
  await item.save();

  const recalculated = await updateDailyQuestBoardProgress(item.boardId);
  const boardAfter = recalculated?.board.completionPercent ?? boardBefore?.completionPercent ?? 0;

  if (scorePercent < 70 && weakConcepts.length > 0) {
    await RevisionBankItem.create({
      schoolId: item.schoolId,
      studentId: item.studentId,
      classGroupId: item.classGroupId,
      subjectOfferingId: item.subjectOfferingId ?? null,
      subjectId: item.subjectId ?? null,
      subjectName: item.subjectName,
      lessonId: item.lessonId ?? null,
      conceptTitle: weakConcepts[0],
      conceptTags: weakConcepts,
      sourceBoardId: item.boardId,
      sourceItemId: item._id,
      reason: "weak_topic",
      priorityScore: 40 + (70 - scorePercent),
      status: "active",
    });
  }

  await DailyQuestAttempt.create({
    boardId: item.boardId,
    itemId: item._id,
    schoolId: item.schoolId,
    studentId: item.studentId,
    answers,
    correctCount,
    totalCount,
    scorePercent,
    elapsedSeconds: input.elapsedSeconds ?? null,
    xpAwarded,
    weakConcepts,
    misconceptionTags,
    boardCompletionBefore: boardBefore?.completionPercent ?? 0,
    boardCompletionAfter: boardAfter,
    exploreRecommendation: item.explore.unlockStatus === "available"
      ? {
          shouldUnlock: true,
          mode: "go_deeper",
          reason: "Student scored high enough to unlock Explore.",
        }
      : scorePercent < 70
        ? {
            shouldUnlock: true,
            mode: "leo_rescue",
            reason: "Student needs a rescue adventure for weak concepts.",
          }
        : null,
    submittedAt: new Date(),
  });

  await recordLearnMobileActivity({
    schoolId: input.context.schoolId,
    studentId: input.context.studentId,
    accountId: input.context.accountId,
    gradeId: input.context.gradeId,
    classGroupId: input.context.classGroupId,
    eventType: "quest_completed",
    topic: item.title,
    score: scorePercent,
    durationSeconds: input.elapsedSeconds ?? null,
    metadata: {
      boardId: String(item.boardId),
      itemId: String(item._id),
      correctCount,
      totalCount,
      xpAwarded,
    },
  });

  return {
    ok: true as const,
    data: {
      itemId: String(item._id),
      boardId: String(item.boardId),
      correctCount,
      totalCount,
      scorePercent,
      xpAwarded,
      xpReward: item.xpReward,
      boardCompletionBefore: boardBefore?.completionPercent ?? 0,
      boardCompletionAfter: boardAfter,
      weakConcepts,
      misconceptionTags,
      nextRecommendation: resultRecommendation(item, scorePercent, recalculated?.items ?? []),
    },
  };
}
