import { Schema, model, models, Types, type Model } from "mongoose";

export type EmailBatchKind = "bulk" | "digest" | "scheduled_reminder";

export type EmailBatchStatus =
  | "draft"
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface IEmailBatch {
  _id: Types.ObjectId;
  schoolId?: Types.ObjectId | null;
  mailboxScope: "platform" | "school";
  kind: EmailBatchKind;
  createdBy: Types.ObjectId;
  subject: string;
  templateKey?: string | null;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  status: EmailBatchStatus;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const emailBatchSchema = new Schema<IEmailBatch>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      default: null,
      index: true,
    },
    mailboxScope: {
      type: String,
      enum: ["platform", "school"],
      required: true,
    },
    kind: {
      type: String,
      enum: ["bulk", "digest", "scheduled_reminder"],
      required: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    subject: { type: String, required: true, trim: true },
    templateKey: { type: String, default: null, trim: true },
    recipientCount: { type: Number, default: 0 },
    sentCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["draft", "queued", "running", "completed", "failed", "cancelled"],
      default: "draft",
    },
    relatedEntityType: { type: String, default: null, trim: true },
    relatedEntityId: { type: String, default: null, trim: true },
  },
  { timestamps: true },
);

emailBatchSchema.index({ status: 1, createdAt: -1 });

export const EmailBatch: Model<IEmailBatch> =
  (models.EmailBatch as Model<IEmailBatch>) ||
  model<IEmailBatch>("EmailBatch", emailBatchSchema);
