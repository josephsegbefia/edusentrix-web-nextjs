import "server-only";

import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { buildDailyQuestForSession, loadQuestSession } from "@/lib/learn/mobile-quest";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import {
  DailyQuestBoard,
  type DailyQuestBacklogPressure,
  type IDailyQuestBoard,
} from "@/models/DailyQuestBoard";
import {
  DailyQuestItem,
  type DailyQuestFlashcardContent,
  type DailyQuestQuizQuestionContent,
  type DailyQuestRecapContent,
} from "@/models/DailyQuestItem";
import {
  DAILY_QUEST_LIMITS,
  type BuildDailyQuestCandidatesInput,
  type DailyQuestCandidate,
  type SelectedDailyQuestCandidate,
} from "./daily-quest-types";
import { buildDailyQuestCandidates } from "./build-daily-quest-candidates";
import { classifyMissedQuestItems } from "./classify-missed-quest-items";

type AcademicPeriodRow = {
  _id: Types.ObjectId;
};

type GenerateDailyQuestBoardInput = Omit<
  BuildDailyQuestCandidatesInput,
  "academicYearId" | "termId"
> & {
  userId?: Types.ObjectId | null;
  academicYearId?: Types.ObjectId | null;
  termId?: Types.ObjectId | null;
};

export type GenerateDailyQuestBoardResult = {
  board: IDailyQuestBoard;
  created: boolean;
};

function dateKeyForSchoolDay(date: Date, timezone = "Africa/Accra") {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

async function resolveCurrentPeriodIds(input: {
  schoolId: Types.ObjectId;
  academicYearId?: Types.ObjectId | null;
  termId?: Types.ObjectId | null;
}) {
  if (input.academicYearId && input.termId) {
    return { academicYearId: input.academicYearId, termId: input.termId };
  }

  const currentPeriod = await AcademicPeriod.findOne({
    schoolId: input.schoolId,
    isCurrent: true,
  })
    .select("_id")
    .lean<AcademicPeriodRow | null>();

  if (!currentPeriod?._id) {
    throw new Error("Daily Quest Board needs a current academic period.");
  }

  return {
    academicYearId: input.academicYearId ?? currentPeriod._id,
    termId: input.termId ?? currentPeriod._id,
  };
}

function cloneAsQuickCheck(candidate: DailyQuestCandidate): DailyQuestCandidate {
  return {
    ...candidate,
    id: `${candidate.id}:quick-check`,
    itemType: "quick_check",
    required: false,
    weight: 1,
    estimatedMinutes: Math.min(candidate.estimatedMinutes, 5),
    xpReward: Math.min(candidate.xpReward, 14),
    title: candidate.title.startsWith("Quick check:")
      ? candidate.title
      : `Quick check: ${candidate.title.replace(/^Review\s+/i, "")}`,
    description: `A short check-in for ${candidate.subjectName}.`,
  };
}

function selectCandidates(candidates: DailyQuestCandidate[]): SelectedDailyQuestCandidate[] {
  const selected: SelectedDailyQuestCandidate[] = [];
  let displayOrder = 0;

  const add = (
    candidate: DailyQuestCandidate,
    sectionType: SelectedDailyQuestCandidate["sectionType"]
  ) => {
    displayOrder += 1;
    selected.push({ ...candidate, sectionType, displayOrder });
  };

  const corePool = candidates.filter(
    (candidate) =>
      candidate.itemType === "lesson_review" ||
      candidate.priorityReason === "taught_today" ||
      candidate.priorityReason === "teacher_priority"
  );
  const core = corePool.slice(0, DAILY_QUEST_LIMITS.maxCoreReviews);
  core.forEach((candidate) => add(candidate, "core_reviews"));

  const coreIds = new Set(core.map((candidate) => candidate.id));
  const coreOverflow = corePool
    .filter((candidate) => !coreIds.has(candidate.id))
    .map(cloneAsQuickCheck);
  const quickChecks = [
    ...coreOverflow,
    ...candidates.filter((candidate) => candidate.itemType === "quick_check"),
  ].slice(0, DAILY_QUEST_LIMITS.maxQuickChecks);
  quickChecks.forEach((candidate) => add(candidate, "quick_checks"));

  const rescueIds = new Set<string>();
  candidates
    .filter((candidate) => candidate.itemType === "weak_spot_rescue")
    .slice(0, DAILY_QUEST_LIMITS.maxLeoRescueItems)
    .forEach((candidate) => {
      rescueIds.add(candidate.id);
      add(candidate, "leo_rescue");
    });

  let catchUpWeight = 0;
  candidates
    .filter(
      (candidate) =>
        !rescueIds.has(candidate.id) &&
        (candidate.source === "unfinished_item" ||
          candidate.source === "revision_bank" ||
          candidate.itemType === "catch_up_review" ||
          candidate.itemType === "spaced_repetition")
    )
    .slice(0, DAILY_QUEST_LIMITS.maxCatchUpItems + 4)
    .forEach((candidate) => {
      if (
        selected.filter((item) => item.sectionType === "catch_up").length >=
          DAILY_QUEST_LIMITS.maxCatchUpItems ||
        catchUpWeight + candidate.weight > DAILY_QUEST_LIMITS.maxCatchUpWeight
      ) {
        return;
      }
      catchUpWeight += candidate.weight;
      add(candidate, "catch_up");
    });

  return selected;
}

function backlogPressureFor(
  selected: SelectedDailyQuestCandidate[],
  classifiedPressure?: DailyQuestBacklogPressure
): DailyQuestBacklogPressure {
  if (classifiedPressure === "recovery") return "recovery";
  if (classifiedPressure === "moderate") return "moderate";

  const catchUpCount = selected.filter((candidate) => candidate.sectionType === "catch_up").length;
  const rescueCount = selected.filter((candidate) => candidate.sectionType === "leo_rescue").length;
  if (catchUpCount >= 2 || rescueCount >= 1) return "moderate";
  if (classifiedPressure === "light") return "light";
  if (catchUpCount === 1) return "light";
  return "none";
}

function fallbackContent(candidate: SelectedDailyQuestCandidate): {
  recap: DailyQuestRecapContent;
  flashcards: DailyQuestFlashcardContent[];
  quizQuestions: DailyQuestQuizQuestionContent[];
} {
  const concept = candidate.conceptTags?.[0] || candidate.title.replace(/^Fix\s+/i, "");
  const summary = `${concept} is worth revising because it connects to your recent class work. Read the idea, check the example, then answer the short quiz.`;

  return {
    recap: {
      lessonTitle: concept,
      coveredDate: "Revision practice",
      summary,
    },
    flashcards: [
      {
        id: `${candidate.id}-card-main`,
        front: `What should I remember about ${concept}?`,
        back: summary,
      },
      {
        id: `${candidate.id}-card-example`,
        front: `How do I practise ${concept}?`,
        back: "Explain it in your own words, try one example, then check what confused you.",
      },
    ],
    quizQuestions: [
      {
        id: `${candidate.id}-q-main`,
        prompt: `What is the best first step when revising ${concept}?`,
        options: [
          { id: `${candidate.id}-q-main-a`, letter: "A", label: "Read the key idea carefully." },
          { id: `${candidate.id}-q-main-b`, letter: "B", label: "Skip it and guess later." },
          { id: `${candidate.id}-q-main-c`, letter: "C", label: "Only look at the answer." },
          { id: `${candidate.id}-q-main-d`, letter: "D", label: "Close the lesson notes." },
        ],
        correctOptionId: `${candidate.id}-q-main-a`,
        explanation: "A calm first read helps you notice what the idea means before practising.",
        weakConceptTags: candidate.conceptTags ?? [],
        misconceptionTags: [],
      },
    ],
  };
}

async function contentForCandidate(candidate: SelectedDailyQuestCandidate) {
  if (candidate.lessonId) {
    const session = await loadQuestSession({
      schoolId: candidate.schoolId,
      classGroupId: candidate.classGroupId,
      sessionId: candidate.lessonId,
    });

    if (session) {
      const quest = await buildDailyQuestForSession({
        schoolId: candidate.schoolId,
        classGroupId: candidate.classGroupId,
        studentId: candidate.studentId,
        session,
      });

      return {
        recap: quest.recap,
        flashcards: quest.flashcards,
        quizQuestions: quest.quizQuestions.map((question) => ({
          ...question,
          options: question.options.map((option) => ({
            ...option,
            letter: option.letter as "A" | "B" | "C" | "D",
          })),
          weakConceptTags: candidate.conceptTags ?? [],
          misconceptionTags: [],
        })),
      };
    }
  }

  return fallbackContent(candidate);
}

function sourceTypeFor(candidate: SelectedDailyQuestCandidate) {
  if (candidate.source === "revision_bank") return "revision_bank";
  if (candidate.source === "weak_attempt") return "weak_topic";
  return "covered_lesson";
}

export async function generateDailyQuestBoardForStudent(
  input: GenerateDailyQuestBoardInput
): Promise<GenerateDailyQuestBoardResult> {
  await connectToDatabase();

  const timezone = input.timezone ?? "Africa/Accra";
  const boardDate = input.date ?? new Date();
  const date = dateKeyForSchoolDay(boardDate, timezone);

  const existingBoard = await DailyQuestBoard.findOne({
    schoolId: input.schoolId,
    studentId: input.studentId,
    date,
  });

  if (existingBoard) {
    return { board: existingBoard, created: false };
  }

  const periodIds = await resolveCurrentPeriodIds(input);
  const missed = await classifyMissedQuestItems({
    schoolId: input.schoolId,
    studentId: input.studentId,
    classGroupId: input.classGroupId,
    today: date,
  });
  const candidateResult = await buildDailyQuestCandidates({
    ...input,
    ...periodIds,
    date: boardDate,
    timezone,
  });
  const selected = selectCandidates(candidateResult.candidates);

  const totalRequiredWeight = selected
    .filter((candidate) => candidate.required)
    .reduce((sum, candidate) => sum + candidate.weight, 0);
  const totalXpAvailable = selected.reduce((sum, candidate) => sum + candidate.xpReward, 0);
  const backlogPressure = backlogPressureFor(selected, missed.backlogPressure);

  const board = await DailyQuestBoard.create({
    schoolId: input.schoolId,
    studentId: input.studentId,
    userId: input.userId ?? null,
    classGroupId: input.classGroupId,
    gradeId: input.gradeId ?? null,
    academicYearId: periodIds.academicYearId,
    termId: periodIds.termId,
    date,
    timezone,
    status: "not_started",
    completionPercent: 0,
    requiredCompletionPercent: 100,
    streakProtectionPercent: 80,
    completedRequiredWeight: 0,
    totalRequiredWeight,
    completedItems: 0,
    totalItems: selected.length,
    requiredItems: selected.filter((candidate) => candidate.required).length,
    completedRequiredItems: 0,
    totalEstimatedMinutes: selected.reduce(
      (sum, candidate) => sum + candidate.estimatedMinutes,
      0
    ),
    totalXpAvailable,
    xpEarned: 0,
    generatedFromLessonIds: selected
      .map((candidate) => candidate.lessonId)
      .filter(Boolean) as Types.ObjectId[],
    generatedFromBoardIds: selected
      .map((candidate) => candidate.sourceBoardId)
      .filter(Boolean) as Types.ObjectId[],
    recommendedNextItemId: null,
    backlogPressure,
    recoveryModeEnabled: backlogPressure === "recovery",
    generationMeta: {
      strategy: "daily_board_v1",
      generatedAt: new Date(),
      candidateCount: candidateResult.candidates.length,
      selectedCount: selected.length,
      catchUpCount: selected.filter((candidate) => candidate.sectionType === "catch_up").length,
      revisionBankCount: candidateResult.meta.revisionBankCount + missed.revisionBankCount,
      expiredCount: missed.expiredCount,
    },
    rewards: {
      baseXp: totalXpAvailable,
      bonusXp: selected.length > 0 ? 20 : 0,
      streakProtected: false,
      perfectDayAvailable: selected.length > 0,
    },
  });

  const itemDocs = await Promise.all(
    selected.map(async (candidate) => {
      const content = await contentForCandidate(candidate);
      return {
        boardId: board._id,
        schoolId: candidate.schoolId,
        studentId: candidate.studentId,
        classGroupId: candidate.classGroupId,
        gradeId: candidate.gradeId ?? null,
        lessonId: candidate.lessonId ?? null,
        subjectOfferingId: candidate.subjectOfferingId ?? null,
        subjectId: candidate.subjectId ?? null,
        subjectName: candidate.subjectName,
        displayOrder: candidate.displayOrder,
        type: candidate.itemType,
        title: candidate.title,
        description: candidate.description,
        required: candidate.required,
        weight: candidate.weight,
        completionPercent: 0,
        status: "not_started",
        lifecycle: candidate.sectionType === "catch_up" ? "catch_up" : "today_active",
        priorityReason: candidate.priorityReason,
        priorityScore: candidate.priorityScore,
        priorityLabel: candidate.priorityLabel,
        estimatedMinutes: candidate.estimatedMinutes,
        xpReward: candidate.xpReward,
        xpAwarded: 0,
        recap: content.recap,
        flashcards: content.flashcards,
        quizQuestions: content.quizQuestions,
        source: {
          sourceType: sourceTypeFor(candidate),
          sourceLessonId: candidate.lessonId ?? null,
          sourceBoardId: candidate.sourceBoardId ?? null,
          sourceItemId: candidate.sourceItemId ?? null,
          coveredAt: candidate.coveredAt ?? null,
          teacherId: candidate.teacherId ?? null,
        },
        explore: {
          canUnlockExplore: candidate.lessonId
            ? candidate.sectionType === "core_reviews" || candidate.sectionType === "quick_checks"
            : false,
          unlockStatus: "locked",
          adventureId: null,
          unlockReason: null,
        },
      };
    })
  );

  const items = itemDocs.length > 0 ? await DailyQuestItem.insertMany(itemDocs) : [];
  const recommendedNext = items.find((item) => item.required) ?? items[0] ?? null;

  if (recommendedNext) {
    board.recommendedNextItemId = recommendedNext._id;
    await board.save();
  }

  return { board, created: true };
}
