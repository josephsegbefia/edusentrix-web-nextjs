import { Schema, model, models, Types, type Model } from "mongoose";

export type EmailDispatchJobKind =
  | "outbound_single"
  | "batch_chunk"
  | "digest_chunk"
  | "inbound_route"
  | "imap_recovery";

export type EmailDispatchJobStatus =
  | "pending"
  | "running"
  | "failed"
  | "done"
  | "dead_letter";

export type EmailDispatchTrafficClass =
  | "transactional"
  | "manual"
  | "bulk"
  | "digest"
  | "system";

export type EmailDispatchPriority = "critical" | "high" | "normal" | "low";

export type EmailDispatchSenderFamily = "hello" | "billing" | "support";

export interface IEmailDispatchJob {
  _id: Types.ObjectId;
  kind: EmailDispatchJobKind;

  emailMessageId?: Types.ObjectId | null;
  emailBatchId?: Types.ObjectId | null;
  schoolId?: Types.ObjectId | null;

  senderFamily?: EmailDispatchSenderFamily | null;
  trafficClass: EmailDispatchTrafficClass;
  priority: EmailDispatchPriority;

  status: EmailDispatchJobStatus;
  attempts: number;
  maxAttempts: number;
  nextRunAt?: Date | null;
  lastError?: string | null;

  rateScopeKey?: string | null;
  claimedBy?: string | null;
  lockedAt?: Date | null;

  payload?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const emailDispatchJobSchema = new Schema<IEmailDispatchJob>(
  {
    kind: {
      type: String,
      enum: [
        "outbound_single",
        "batch_chunk",
        "digest_chunk",
        "inbound_route",
        "imap_recovery",
      ],
      required: true,
    },

    emailMessageId: {
      type: Schema.Types.ObjectId,
      ref: "EmailMessage",
      default: null,
      index: true,
    },
    emailBatchId: {
      type: Schema.Types.ObjectId,
      ref: "EmailBatch",
      default: null,
    },
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      default: null,
      index: true,
    },

    senderFamily: {
      type: String,
      enum: ["hello", "billing", "support"],
      default: null,
    },
    trafficClass: {
      type: String,
      enum: ["transactional", "manual", "bulk", "digest", "system"],
      required: true,
    },
    priority: {
      type: String,
      enum: ["critical", "high", "normal", "low"],
      default: "normal",
    },

    status: {
      type: String,
      enum: ["pending", "running", "failed", "done", "dead_letter"],
      default: "pending",
    },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 10 },
    nextRunAt: { type: Date, default: null },
    lastError: { type: String, default: null },

    rateScopeKey: { type: String, default: null, trim: true },
    claimedBy: { type: String, default: null, trim: true },
    lockedAt: { type: Date, default: null },

    payload: { type: Schema.Types.Mixed, default: undefined },
  },
  { timestamps: true },
);

emailDispatchJobSchema.index({
  status: 1,
  priority: 1,
  nextRunAt: 1,
  trafficClass: 1,
});
emailDispatchJobSchema.index({ status: 1, kind: 1, updatedAt: 1 });

export const EmailDispatchJob: Model<IEmailDispatchJob> =
  (models.EmailDispatchJob as Model<IEmailDispatchJob>) ||
  model<IEmailDispatchJob>("EmailDispatchJob", emailDispatchJobSchema);
