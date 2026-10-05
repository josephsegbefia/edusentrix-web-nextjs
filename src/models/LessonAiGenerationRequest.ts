import { Schema, model, models, type Model, type Types } from "mongoose";
import type { LessonContentBlock } from "@/types/lesson-content-blocks";

export const LESSON_AI_GENERATION_TARGET_KINDS = [
  "existing_session",
  "week_batch",
  "week_slot",
] as const;

export type LessonAiGenerationTargetKind =
  (typeof LESSON_AI_GENERATION_TARGET_KINDS)[number];

export const LESSON_AI_GENERATION_STATUSES = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
] as const;

export type LessonAiGenerationStatus = (typeof LESSON_AI_GENERATION_STATUSES)[number];

export type LessonAiSlotSnapshot = {
  slotDraftId: string;
  title: string;
  durationMinutes: number;
  noteSectionKeys: string[];
  coverageWeight?: number;
  scheduledDate?: string;
  startTime?: string;
  endTime?: string;
  periodCount?: number;
  isDoublePeriod?: boolean;
  focusSummary?: string;
  sequenceInWeek: number;
  previousSession?: {
    title: string;
    focusSummary?: string;
    keyPointsSummary?: string;
  };
  priorSessions?: Array<{
    title: string;
    focusSummary?: string;
    keyPointsSummary?: string;
  }>;
};

export type LessonAiSlotResult = {
  slotDraftId: string;
  status: "pending" | "succeeded" | "failed";
  contentBlocks?: LessonContentBlock[];
  error?: string | null;
  usageRecorded?: boolean;
};

export type LessonAiProviderCheckpoint = {
  slotDraftId: string;
  raw: unknown;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  usageRecorded: boolean;
};

export interface ILessonAiGenerationRequest {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  teacherUserId: Types.ObjectId;
  teacherId: Types.ObjectId;
  lessonNoteId: Types.ObjectId;
  targetKind: LessonAiGenerationTargetKind;
  sessionId?: Types.ObjectId | null;
  classGroupId?: Types.ObjectId | null;
  weekStartDate?: string | null;
  revision: number;
  idempotencyKey: string;
  status: LessonAiGenerationStatus;
  noteUpdatedAt?: Date | null;
  slots: LessonAiSlotSnapshot[];
  slotResults: LessonAiSlotResult[];
  providerCheckpoints: LessonAiProviderCheckpoint[];
  backgroundJobId?: Types.ObjectId | null;
  lastError?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const slotSnapshotSchema = new Schema<LessonAiSlotSnapshot>(
  {
    slotDraftId: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true, maxlength: 220 },
    durationMinutes: { type: Number, required: true, min: 1, max: 240 },
    noteSectionKeys: { type: [String], default: [] },
    coverageWeight: { type: Number, min: 0, max: 1 },
    scheduledDate: { type: String, trim: true },
    startTime: { type: String, trim: true },
    endTime: { type: String, trim: true },
    periodCount: { type: Number, min: 1, max: 8 },
    isDoublePeriod: { type: Boolean },
    focusSummary: { type: String, trim: true, maxlength: 500 },
    sequenceInWeek: { type: Number, required: true, min: 1, max: 12 },
    previousSession: { type: Schema.Types.Mixed },
    priorSessions: { type: [Schema.Types.Mixed], default: undefined },
  },
  { _id: false }
);

const slotResultSchema = new Schema<LessonAiSlotResult>(
  {
    slotDraftId: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["pending", "succeeded", "failed"],
      default: "pending",
    },
    contentBlocks: { type: [Schema.Types.Mixed], default: undefined },
    error: { type: String, default: null },
    usageRecorded: { type: Boolean, default: false },
  },
  { _id: false }
);

const checkpointSchema = new Schema<LessonAiProviderCheckpoint>(
  {
    slotDraftId: { type: String, required: true, trim: true },
    raw: { type: Schema.Types.Mixed },
    usage: { type: Schema.Types.Mixed },
    usageRecorded: { type: Boolean, default: false },
  },
  { _id: false }
);

const lessonAiGenerationRequestSchema = new Schema<ILessonAiGenerationRequest>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    teacherUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    teacherId: { type: Schema.Types.ObjectId, ref: "Teacher", required: true },
    lessonNoteId: { type: Schema.Types.ObjectId, ref: "LessonNote", required: true, index: true },
    targetKind: {
      type: String,
      enum: LESSON_AI_GENERATION_TARGET_KINDS,
      required: true,
    },
    sessionId: { type: Schema.Types.ObjectId, ref: "LessonSession", default: null, index: true },
    classGroupId: { type: Schema.Types.ObjectId, ref: "ClassGroup", default: null },
    weekStartDate: { type: String, default: null, trim: true },
    revision: { type: Number, required: true, min: 1, default: 1 },
    idempotencyKey: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: LESSON_AI_GENERATION_STATUSES,
      default: "queued",
      index: true,
    },
    noteUpdatedAt: { type: Date, default: null },
    slots: { type: [slotSnapshotSchema], default: [] },
    slotResults: { type: [slotResultSchema], default: [] },
    providerCheckpoints: { type: [checkpointSchema], default: [] },
    backgroundJobId: { type: Schema.Types.ObjectId, ref: "BackgroundJob", default: null },
    lastError: { type: String, default: null },
  },
  { timestamps: true }
);

lessonAiGenerationRequestSchema.index(
  { schoolId: 1, idempotencyKey: 1 },
  { unique: true, name: "unique_lesson_ai_generation_idempotency" }
);

export const LessonAiGenerationRequest: Model<ILessonAiGenerationRequest> =
  (models.LessonAiGenerationRequest as Model<ILessonAiGenerationRequest>) ||
  model<ILessonAiGenerationRequest>(
    "LessonAiGenerationRequest",
    lessonAiGenerationRequestSchema
  );
