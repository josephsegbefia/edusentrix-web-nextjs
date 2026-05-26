import type { Types } from "mongoose";
import type {
  DailyQuestItemType,
  DailyQuestPriorityReason,
} from "@/models/DailyQuestItem";
import type { RevisionBankItemReason } from "@/models/RevisionBankItem";

export const DAILY_QUEST_SCORE = {
  taughtToday: 60,
  teacherPriority: 35,
  weakTopic: 40,
  notReviewed: 25,
  spacedRepetitionDue: 20,
  foundationalTopic: 15,
  startedButIncomplete: 25,
  quickCheckOlderThanOneDayPenalty: -25,
  oldQuestPenaltyPerSchoolDay: -8,
  overloadPenalty: -20,
} as const;

export const DAILY_QUEST_LIMITS = {
  maxCoreReviews: 3,
  maxQuickChecks: 5,
  maxCatchUpItems: 2,
  maxCatchUpWeight: 3,
  maxLeoRescueItems: 1,
  maxBonusExploreItems: 1,
} as const;

export type DailyQuestCandidateSource =
  | "covered_lesson"
  | "unfinished_item"
  | "revision_bank"
  | "weak_attempt"
  | "teacher_priority";

export type DailyQuestCandidate = {
  id: string;
  source: DailyQuestCandidateSource;
  itemType: DailyQuestItemType;
  priorityReason: DailyQuestPriorityReason;
  priorityScore: number;
  priorityLabel: string;
  required: boolean;
  weight: number;
  estimatedMinutes: number;
  xpReward: number;
  schoolId: Types.ObjectId;
  studentId: Types.ObjectId;
  classGroupId: Types.ObjectId;
  gradeId?: Types.ObjectId | null;
  lessonId?: Types.ObjectId | null;
  subjectOfferingId?: Types.ObjectId | null;
  subjectId?: Types.ObjectId | null;
  subjectName: string;
  title: string;
  description: string;
  sourceBoardId?: Types.ObjectId | null;
  sourceItemId?: Types.ObjectId | null;
  coveredAt?: Date | null;
  teacherId?: Types.ObjectId | null;
  conceptTags?: string[];
  revisionReason?: RevisionBankItemReason;
};

export type BuildDailyQuestCandidatesInput = {
  schoolId: Types.ObjectId;
  studentId: Types.ObjectId;
  classGroupId: Types.ObjectId;
  gradeId?: Types.ObjectId | null;
  academicYearId?: Types.ObjectId | null;
  termId?: Types.ObjectId | null;
  date?: Date;
  timezone?: string;
};

export type DailyQuestCandidateBuildResult = {
  candidates: DailyQuestCandidate[];
  meta: {
    coveredLessonCount: number;
    unfinishedItemCount: number;
    revisionBankCount: number;
    weakAttemptCount: number;
    teacherPriorityCount: number;
  };
};

export type SelectedDailyQuestCandidate = DailyQuestCandidate & {
  sectionType: "core_reviews" | "quick_checks" | "catch_up" | "leo_rescue" | "bonus_explore";
  displayOrder: number;
};
