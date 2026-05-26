import { Schema, model, models, Types, type Model } from "mongoose";

export interface DailyQuestAttemptAnswer {
  questionId: string;
  optionId: string;
  correct: boolean;
}

export interface IDailyQuestAttempt {
  _id: Types.ObjectId;
  boardId: Types.ObjectId;
  itemId: Types.ObjectId;
  schoolId: Types.ObjectId;
  studentId: Types.ObjectId;
  answers: DailyQuestAttemptAnswer[];
  correctCount: number;
  totalCount: number;
  scorePercent: number;
  elapsedSeconds?: number | null;
  xpAwarded: number;
  weakConcepts: string[];
  misconceptionTags: string[];
  boardCompletionBefore: number;
  boardCompletionAfter: number;
  exploreRecommendation?: {
    shouldUnlock: boolean;
    mode: "go_deeper" | "leo_rescue";
    reason: string;
  } | null;
  submittedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const dailyQuestAttemptAnswerSchema = new Schema<DailyQuestAttemptAnswer>(
  {
    questionId: { type: String, required: true, trim: true },
    optionId: { type: String, required: true, trim: true },
    correct: { type: Boolean, required: true },
  },
  { _id: false }
);

const dailyQuestExploreRecommendationSchema = new Schema<
  NonNullable<IDailyQuestAttempt["exploreRecommendation"]>
>(
  {
    shouldUnlock: { type: Boolean, default: false },
    mode: { type: String, enum: ["go_deeper", "leo_rescue"], required: true },
    reason: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const dailyQuestAttemptSchema = new Schema<IDailyQuestAttempt>(
  {
    boardId: {
      type: Schema.Types.ObjectId,
      ref: "DailyQuestBoard",
      required: true,
      index: true,
    },
    itemId: {
      type: Schema.Types.ObjectId,
      ref: "DailyQuestItem",
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
    answers: { type: [dailyQuestAttemptAnswerSchema], default: [] },
    correctCount: { type: Number, default: 0, min: 0 },
    totalCount: { type: Number, default: 0, min: 0 },
    scorePercent: { type: Number, default: 0, min: 0, max: 100 },
    elapsedSeconds: { type: Number, default: null, min: 0 },
    xpAwarded: { type: Number, default: 0, min: 0 },
    weakConcepts: { type: [String], default: [] },
    misconceptionTags: { type: [String], default: [] },
    boardCompletionBefore: { type: Number, default: 0, min: 0, max: 100 },
    boardCompletionAfter: { type: Number, default: 0, min: 0, max: 100 },
    exploreRecommendation: {
      type: dailyQuestExploreRecommendationSchema,
      default: null,
    },
    submittedAt: { type: Date, required: true, default: () => new Date(), index: true },
  },
  { timestamps: true }
);

dailyQuestAttemptSchema.index({ itemId: 1, studentId: 1, submittedAt: -1 });
dailyQuestAttemptSchema.index({ schoolId: 1, studentId: 1, submittedAt: -1 });

export const DailyQuestAttempt: Model<IDailyQuestAttempt> =
  (models.DailyQuestAttempt as Model<IDailyQuestAttempt>) ||
  model<IDailyQuestAttempt>("DailyQuestAttempt", dailyQuestAttemptSchema);
