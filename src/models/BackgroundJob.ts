import { Schema, model, models, Types, type Model } from "mongoose";
import {
  BACKGROUND_JOB_KINDS,
  type BackgroundJobKind,
} from "@/lib/background/job-kinds";
import {
  BACKGROUND_JOB_STATUSES,
  type BackgroundJobStatus,
} from "@/lib/background/job-status";
import { BACKGROUND_ERROR_CATEGORIES } from "@/lib/background/errors";

export type BackgroundJobTenantKey = `school:${string}` | "platform";

export interface IBackgroundJob {
  _id: Types.ObjectId;
  kind: BackgroundJobKind;
  version: number;
  schoolId?: Types.ObjectId | null;
  initiatedByUserId?: Types.ObjectId | null;
  targetUserId?: Types.ObjectId | null;
  platformScope: boolean;
  tenantKey: BackgroundJobTenantKey;
  subjectType?: string | null;
  subjectId?: Types.ObjectId | null;
  correlationId?: string | null;
  idempotencyKey?: string | null;
  status: BackgroundJobStatus;
  progressPercent: number;
  progressStage?: string | null;
  progressMessage?: string | null;
  progressUpdatedAt?: Date | null;
  queuedAt: Date;
  startedAt?: Date | null;
  completedAt?: Date | null;
  failedAt?: Date | null;
  cancelledAt?: Date | null;
  inngestEventId?: string | null;
  inngestRunId?: string | null;
  currentAttempt: number;
  maxAttempts: number;
  lastHeartbeatAt?: Date | null;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
  failureCategory?: (typeof BACKGROUND_ERROR_CATEGORIES)[number] | null;
  input?: Record<string, unknown>;
  result?: Record<string, unknown>;
  notifyOnSuccess: boolean;
  notifyOnFailure: boolean;
  notificationTargetUserId?: Types.ObjectId | null;
  cancelRequestedAt?: Date | null;
  cancelRequestedByUserId?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export function backgroundJobTenantKey(schoolId?: Types.ObjectId | string | null): BackgroundJobTenantKey {
  if (!schoolId) return "platform";
  return `school:${String(schoolId)}`;
}

const backgroundJobSchema = new Schema<IBackgroundJob>(
  {
    kind: {
      type: String,
      enum: [...BACKGROUND_JOB_KINDS],
      required: true,
    },
    version: { type: Number, default: 1, min: 1 },
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      default: null,
      index: true,
    },
    initiatedByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    targetUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    platformScope: { type: Boolean, default: false },
    tenantKey: {
      type: String,
      required: true,
      trim: true,
    },
    subjectType: { type: String, default: null, trim: true },
    subjectId: { type: Schema.Types.ObjectId, default: null },
    correlationId: { type: String, default: null, trim: true },
    idempotencyKey: { type: String, default: null, trim: true },
    status: {
      type: String,
      enum: [...BACKGROUND_JOB_STATUSES],
      default: "queued",
      required: true,
    },
    progressPercent: { type: Number, default: 0, min: 0, max: 100 },
    progressStage: { type: String, default: null, trim: true },
    progressMessage: { type: String, default: null, trim: true },
    progressUpdatedAt: { type: Date, default: null },
    queuedAt: { type: Date, required: true },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    inngestEventId: { type: String, default: null, trim: true },
    inngestRunId: { type: String, default: null, trim: true },
    currentAttempt: { type: Number, default: 0, min: 0 },
    maxAttempts: { type: Number, default: 3, min: 1 },
    lastHeartbeatAt: { type: Date, default: null },
    lastErrorCode: { type: String, default: null, trim: true },
    lastErrorMessage: { type: String, default: null, trim: true },
    failureCategory: {
      type: String,
      enum: [...BACKGROUND_ERROR_CATEGORIES, null],
      default: null,
    },
    input: { type: Schema.Types.Mixed, default: undefined },
    result: { type: Schema.Types.Mixed, default: undefined },
    notifyOnSuccess: { type: Boolean, default: false },
    notifyOnFailure: { type: Boolean, default: false },
    notificationTargetUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    cancelRequestedAt: { type: Date, default: null },
    cancelRequestedByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

backgroundJobSchema.index({ status: 1, queuedAt: 1 });
backgroundJobSchema.index({ schoolId: 1, status: 1, createdAt: -1 });
backgroundJobSchema.index({ initiatedByUserId: 1, status: 1, createdAt: -1 });
backgroundJobSchema.index({ kind: 1, createdAt: -1 });
backgroundJobSchema.index({ status: 1, lastHeartbeatAt: 1 });
backgroundJobSchema.index({ status: 1, inngestEventId: 1 });
backgroundJobSchema.index(
  { tenantKey: 1, kind: 1, idempotencyKey: 1 },
  {
    unique: true,
    name: "unique_background_job_idempotency",
    partialFilterExpression: { idempotencyKey: { $type: "string" } },
  }
);

export const BackgroundJob: Model<IBackgroundJob> =
  (models.BackgroundJob as Model<IBackgroundJob>) ||
  model<IBackgroundJob>("BackgroundJob", backgroundJobSchema);
