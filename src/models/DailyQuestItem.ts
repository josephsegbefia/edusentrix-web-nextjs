import { Schema, model, models, Types, type Model } from "mongoose";

export type DailyQuestItemStatus =
  | "locked"
  | "available"
  | "not_started"
  | "in_progress"
  | "completed"
  | "carried_forward"
  | "moved_to_revision_bank"
  | "expired"
  | "skipped_by_system";

export type QuestItemLifecycle =
  | "today_active"
  | "catch_up"
  | "revision_bank"
  | "expired"
  | "completed";

export type DailyQuestItemType =
  | "lesson_review"
  | "quick_check"
  | "weak_spot_rescue"
  | "catch_up_review"
  | "spaced_repetition"
  | "explore_unlock";

export type DailyQuestPriorityReason =
  | "taught_today"
  | "not_reviewed"
  | "weak_topic"
  | "spaced_repetition"
  | "teacher_priority"
  | "started_but_incomplete"
  | "bonus_explore"
  | "system_recovery";

export type DailyQuestSourceType =
  | "covered_lesson"
  | "lesson_note"
  | "scheme_topic"
  | "revision_bank"
  | "weak_topic";

export type DailyQuestExploreUnlockStatus =
  | "locked"
  | "available"
  | "generating"
  | "ready"
  | "completed";

export type DailyQuestExploreUnlockReason =
  | "score_ready"
  | "needs_rescue"
  | "teacher_priority"
  | "bonus";

export interface DailyQuestRecapContent {
  lessonTitle: string;
  teacherName?: string;
  coveredDate: string;
  summary: string;
}

export interface DailyQuestFlashcardContent {
  id: string;
  front: string;
  back: string;
}

export interface DailyQuestQuizOptionContent {
  id: string;
  letter: "A" | "B" | "C" | "D";
  label: string;
}

export interface DailyQuestQuizQuestionContent {
  id: string;
  prompt: string;
  options: DailyQuestQuizOptionContent[];
  correctOptionId: string;
  explanation: string;
  weakConceptTags?: string[];
  misconceptionTags?: string[];
}

export interface IDailyQuestItem {
  _id: Types.ObjectId;
  boardId: Types.ObjectId;
  schoolId: Types.ObjectId;
  studentId: Types.ObjectId;
  classGroupId: Types.ObjectId;
  gradeId?: Types.ObjectId | null;
  lessonId?: Types.ObjectId | null;
  subjectOfferingId?: Types.ObjectId | null;
  subjectId?: Types.ObjectId | null;
  subjectName: string;
  displayOrder: number;
  type: DailyQuestItemType;
  title: string;
  description: string;
  required: boolean;
  weight: number;
  completionPercent: number;
  status: DailyQuestItemStatus;
  lifecycle: QuestItemLifecycle;
  priorityReason: DailyQuestPriorityReason;
  priorityScore: number;
  priorityLabel: string;
  estimatedMinutes: number;
  xpReward: number;
  xpAwarded: number;
  recap?: DailyQuestRecapContent | null;
  flashcards?: DailyQuestFlashcardContent[];
  quizQuestions?: DailyQuestQuizQuestionContent[];
  source: {
    sourceType: DailyQuestSourceType;
    sourceLessonId?: Types.ObjectId | null;
    sourceBoardId?: Types.ObjectId | null;
    sourceItemId?: Types.ObjectId | null;
    coveredAt?: Date | null;
    teacherId?: Types.ObjectId | null;
  };
  explore: {
    canUnlockExplore: boolean;
    unlockStatus: DailyQuestExploreUnlockStatus;
    adventureId?: Types.ObjectId | null;
    unlockReason?: DailyQuestExploreUnlockReason | null;
  };
  startedAt?: Date | null;
  completedAt?: Date | null;
  lastActivityAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const dailyQuestRecapSchema = new Schema<DailyQuestRecapContent>(
  {
    lessonTitle: { type: String, required: true, trim: true },
    teacherName: { type: String, default: null, trim: true },
    coveredDate: { type: String, required: true, trim: true },
    summary: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const dailyQuestFlashcardSchema = new Schema<DailyQuestFlashcardContent>(
  {
    id: { type: String, required: true, trim: true },
    front: { type: String, required: true, trim: true },
    back: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const dailyQuestQuizOptionSchema = new Schema<DailyQuestQuizOptionContent>(
  {
    id: { type: String, required: true, trim: true },
    letter: { type: String, enum: ["A", "B", "C", "D"], required: true },
    label: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const dailyQuestQuizQuestionSchema = new Schema<DailyQuestQuizQuestionContent>(
  {
    id: { type: String, required: true, trim: true },
    prompt: { type: String, required: true, trim: true },
    options: { type: [dailyQuestQuizOptionSchema], default: [] },
    correctOptionId: { type: String, required: true, trim: true },
    explanation: { type: String, required: true, trim: true },
    weakConceptTags: { type: [String], default: [] },
    misconceptionTags: { type: [String], default: [] },
  },
  { _id: false }
);

const dailyQuestItemSourceSchema = new Schema<IDailyQuestItem["source"]>(
  {
    sourceType: {
      type: String,
      enum: ["covered_lesson", "lesson_note", "scheme_topic", "revision_bank", "weak_topic"],
      required: true,
    },
    sourceLessonId: { type: Schema.Types.ObjectId, ref: "LessonSession", default: null },
    sourceBoardId: { type: Schema.Types.ObjectId, ref: "DailyQuestBoard", default: null },
    sourceItemId: { type: Schema.Types.ObjectId, ref: "DailyQuestItem", default: null },
    coveredAt: { type: Date, default: null },
    teacherId: { type: Schema.Types.ObjectId, ref: "Teacher", default: null },
  },
  { _id: false }
);

const dailyQuestItemExploreSchema = new Schema<IDailyQuestItem["explore"]>(
  {
    canUnlockExplore: { type: Boolean, default: false },
    unlockStatus: {
      type: String,
      enum: ["locked", "available", "generating", "ready", "completed"],
      default: "locked",
      required: true,
    },
    adventureId: { type: Schema.Types.ObjectId, ref: "ExploreAdventure", default: null },
    unlockReason: {
      type: String,
      enum: ["score_ready", "needs_rescue", "teacher_priority", "bonus", null],
      default: null,
    },
  },
  { _id: false }
);

const dailyQuestItemSchema = new Schema<IDailyQuestItem>(
  {
    boardId: {
      type: Schema.Types.ObjectId,
      ref: "DailyQuestBoard",
      required: true,
      index: true,
    },
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
    classGroupId: {
      type: Schema.Types.ObjectId,
      ref: "ClassGroup",
      required: true,
      index: true,
    },
    gradeId: { type: Schema.Types.ObjectId, ref: "Grade", default: null, index: true },
    lessonId: { type: Schema.Types.ObjectId, ref: "LessonSession", default: null, index: true },
    subjectOfferingId: {
      type: Schema.Types.ObjectId,
      ref: "SubjectOffering",
      default: null,
      index: true,
    },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject", default: null, index: true },
    subjectName: { type: String, required: true, trim: true },
    displayOrder: { type: Number, default: 0, index: true },
    type: {
      type: String,
      enum: [
        "lesson_review",
        "quick_check",
        "weak_spot_rescue",
        "catch_up_review",
        "spaced_repetition",
        "explore_unlock",
      ],
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    required: { type: Boolean, default: true, index: true },
    weight: { type: Number, default: 1, min: 0 },
    completionPercent: { type: Number, default: 0, min: 0, max: 100 },
    status: {
      type: String,
      enum: [
        "locked",
        "available",
        "not_started",
        "in_progress",
        "completed",
        "carried_forward",
        "moved_to_revision_bank",
        "expired",
        "skipped_by_system",
      ],
      default: "not_started",
      required: true,
      index: true,
    },
    lifecycle: {
      type: String,
      enum: ["today_active", "catch_up", "revision_bank", "expired", "completed"],
      default: "today_active",
      required: true,
      index: true,
    },
    priorityReason: {
      type: String,
      enum: [
        "taught_today",
        "not_reviewed",
        "weak_topic",
        "spaced_repetition",
        "teacher_priority",
        "started_but_incomplete",
        "bonus_explore",
        "system_recovery",
      ],
      required: true,
      index: true,
    },
    priorityScore: { type: Number, default: 0 },
    priorityLabel: { type: String, required: true, trim: true },
    estimatedMinutes: { type: Number, default: 5, min: 1 },
    xpReward: { type: Number, default: 0, min: 0 },
    xpAwarded: { type: Number, default: 0, min: 0 },
    recap: { type: dailyQuestRecapSchema, default: null },
    flashcards: { type: [dailyQuestFlashcardSchema], default: [] },
    quizQuestions: { type: [dailyQuestQuizQuestionSchema], default: [] },
    source: { type: dailyQuestItemSourceSchema, required: true },
    explore: { type: dailyQuestItemExploreSchema, required: true, default: () => ({}) },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    lastActivityAt: { type: Date, default: null },
  },
  { timestamps: true }
);

dailyQuestItemSchema.index({ boardId: 1, displayOrder: 1 });
dailyQuestItemSchema.index({ schoolId: 1, studentId: 1, status: 1 });
dailyQuestItemSchema.index({ schoolId: 1, lessonId: 1, studentId: 1 });
dailyQuestItemSchema.index({ lifecycle: 1, status: 1, updatedAt: -1 });

export const DailyQuestItem: Model<IDailyQuestItem> =
  (models.DailyQuestItem as Model<IDailyQuestItem>) ||
  model<IDailyQuestItem>("DailyQuestItem", dailyQuestItemSchema);
