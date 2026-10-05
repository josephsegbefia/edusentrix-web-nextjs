import { Schema, model, models, type Model, type Types } from "mongoose";

export const LESSON_ILLUSTRATION_STATUSES = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
] as const;

export type LessonIllustrationStatus = (typeof LESSON_ILLUSTRATION_STATUSES)[number];

export interface ILessonIllustrationRequest {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  teacherUserId: Types.ObjectId;
  teacherId: Types.ObjectId;
  revision: number;
  idempotencyKey: string;
  status: LessonIllustrationStatus;
  prompt?: string | null;
  fact?: string | null;
  detail?: string | null;
  sessionTitle?: string | null;
  imageUrl?: string | null;
  storageKey?: string | null;
  generationPrompt?: string | null;
  usageRecorded: boolean;
  backgroundJobId?: Types.ObjectId | null;
  lastError?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const lessonIllustrationRequestSchema = new Schema<ILessonIllustrationRequest>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    teacherUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    teacherId: { type: Schema.Types.ObjectId, ref: "Teacher", required: true },
    revision: { type: Number, required: true, min: 1, default: 1 },
    idempotencyKey: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: LESSON_ILLUSTRATION_STATUSES,
      default: "queued",
      index: true,
    },
    prompt: { type: String, default: null, maxlength: 1200 },
    fact: { type: String, default: null, maxlength: 500 },
    detail: { type: String, default: null, maxlength: 2000 },
    sessionTitle: { type: String, default: null, maxlength: 220 },
    imageUrl: { type: String, default: null },
    storageKey: { type: String, default: null },
    generationPrompt: { type: String, default: null },
    usageRecorded: { type: Boolean, default: false },
    backgroundJobId: { type: Schema.Types.ObjectId, ref: "BackgroundJob", default: null },
    lastError: { type: String, default: null },
  },
  { timestamps: true }
);

lessonIllustrationRequestSchema.index(
  { schoolId: 1, idempotencyKey: 1 },
  { unique: true, name: "unique_lesson_illustration_idempotency" }
);

export const LessonIllustrationRequest: Model<ILessonIllustrationRequest> =
  (models.LessonIllustrationRequest as Model<ILessonIllustrationRequest>) ||
  model<ILessonIllustrationRequest>(
    "LessonIllustrationRequest",
    lessonIllustrationRequestSchema
  );
