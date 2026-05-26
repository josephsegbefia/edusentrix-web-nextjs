import { Schema, model, models, Types, type Model } from "mongoose";

export type DailyQuestBoardStatus =
  | "not_started"
  | "in_progress"
  | "streak_protected"
  | "completed"
  | "completed_with_bonus"
  | "closed";

export type DailyQuestBacklogPressure = "none" | "light" | "moderate" | "recovery";

export interface IDailyQuestBoard {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  studentId: Types.ObjectId;
  userId?: Types.ObjectId | null;
  classGroupId: Types.ObjectId;
  gradeId?: Types.ObjectId | null;
  academicYearId: Types.ObjectId;
  termId: Types.ObjectId;
  date: string;
  timezone: string;
  status: DailyQuestBoardStatus;
  completionPercent: number;
  requiredCompletionPercent: number;
  streakProtectionPercent: number;
  completedRequiredWeight: number;
  totalRequiredWeight: number;
  completedItems: number;
  totalItems: number;
  requiredItems: number;
  completedRequiredItems: number;
  totalEstimatedMinutes: number;
  totalXpAvailable: number;
  xpEarned: number;
  generatedFromLessonIds: Types.ObjectId[];
  generatedFromBoardIds: Types.ObjectId[];
  recommendedNextItemId?: Types.ObjectId | null;
  backlogPressure: DailyQuestBacklogPressure;
  recoveryModeEnabled: boolean;
  generationMeta: {
    strategy: "daily_board_v1";
    generatedAt: Date;
    candidateCount: number;
    selectedCount: number;
    catchUpCount: number;
    revisionBankCount: number;
    expiredCount: number;
  };
  rewards: {
    baseXp: number;
    bonusXp: number;
    streakProtected: boolean;
    perfectDayAvailable: boolean;
  };
  closedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const generationMetaSchema = new Schema<IDailyQuestBoard["generationMeta"]>(
  {
    strategy: {
      type: String,
      enum: ["daily_board_v1"],
      default: "daily_board_v1",
      required: true,
    },
    generatedAt: { type: Date, required: true, default: () => new Date() },
    candidateCount: { type: Number, default: 0, min: 0 },
    selectedCount: { type: Number, default: 0, min: 0 },
    catchUpCount: { type: Number, default: 0, min: 0 },
    revisionBankCount: { type: Number, default: 0, min: 0 },
    expiredCount: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const dailyQuestRewardsSchema = new Schema<IDailyQuestBoard["rewards"]>(
  {
    baseXp: { type: Number, default: 0, min: 0 },
    bonusXp: { type: Number, default: 0, min: 0 },
    streakProtected: { type: Boolean, default: false },
    perfectDayAvailable: { type: Boolean, default: false },
  },
  { _id: false }
);

const dailyQuestBoardSchema = new Schema<IDailyQuestBoard>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    classGroupId: {
      type: Schema.Types.ObjectId,
      ref: "ClassGroup",
      required: true,
      index: true,
    },
    gradeId: { type: Schema.Types.ObjectId, ref: "Grade", default: null, index: true },
    academicYearId: {
      type: Schema.Types.ObjectId,
      ref: "AcademicPeriod",
      required: true,
      index: true,
    },
    termId: {
      type: Schema.Types.ObjectId,
      ref: "AcademicPeriod",
      required: true,
      index: true,
    },
    date: { type: String, required: true, trim: true, index: true },
    timezone: { type: String, required: true, trim: true, default: "Africa/Accra" },
    status: {
      type: String,
      enum: [
        "not_started",
        "in_progress",
        "streak_protected",
        "completed",
        "completed_with_bonus",
        "closed",
      ],
      default: "not_started",
      required: true,
      index: true,
    },
    completionPercent: { type: Number, default: 0, min: 0, max: 100 },
    requiredCompletionPercent: { type: Number, default: 100, min: 0, max: 100 },
    streakProtectionPercent: { type: Number, default: 80, min: 0, max: 100 },
    completedRequiredWeight: { type: Number, default: 0, min: 0 },
    totalRequiredWeight: { type: Number, default: 0, min: 0 },
    completedItems: { type: Number, default: 0, min: 0 },
    totalItems: { type: Number, default: 0, min: 0 },
    requiredItems: { type: Number, default: 0, min: 0 },
    completedRequiredItems: { type: Number, default: 0, min: 0 },
    totalEstimatedMinutes: { type: Number, default: 0, min: 0 },
    totalXpAvailable: { type: Number, default: 0, min: 0 },
    xpEarned: { type: Number, default: 0, min: 0 },
    generatedFromLessonIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "LessonSession" }],
      default: [],
    },
    generatedFromBoardIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "DailyQuestBoard" }],
      default: [],
    },
    recommendedNextItemId: {
      type: Schema.Types.ObjectId,
      ref: "DailyQuestItem",
      default: null,
    },
    backlogPressure: {
      type: String,
      enum: ["none", "light", "moderate", "recovery"],
      default: "none",
      required: true,
      index: true,
    },
    recoveryModeEnabled: { type: Boolean, default: false },
    generationMeta: { type: generationMetaSchema, required: true, default: () => ({}) },
    rewards: { type: dailyQuestRewardsSchema, required: true, default: () => ({}) },
    closedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

dailyQuestBoardSchema.index(
  { schoolId: 1, studentId: 1, date: 1 },
  { unique: true }
);
dailyQuestBoardSchema.index({ schoolId: 1, classGroupId: 1, date: 1 });
dailyQuestBoardSchema.index({ studentId: 1, status: 1, date: -1 });

export const DailyQuestBoard: Model<IDailyQuestBoard> =
  (models.DailyQuestBoard as Model<IDailyQuestBoard>) ||
  model<IDailyQuestBoard>("DailyQuestBoard", dailyQuestBoardSchema);
