import { Schema, model, models, type Model, type Types } from "mongoose";
import type { LeoActionKey } from "@/lib/leo/types";

export type LeoActionConfirmationState =
  | "not_required"
  | "pending"
  | "confirmed"
  | "cancelled";
export type LeoActionRunStatus = "previewed" | "executed" | "failed";

export interface ILeoActionRun {
  _id: Types.ObjectId;
  schoolId?: Types.ObjectId | null;
  conversationId?: Types.ObjectId | null;
  messageId?: Types.ObjectId | null;
  actorUserId: Types.ObjectId;
  actorRole: string;
  actionKey: LeoActionKey;
  scopeType?: string | null;
  scopeId?: string | null;
  previewInput: Record<string, unknown>;
  previewOutput?: Record<string, unknown> | null;
  executeInput?: Record<string, unknown> | null;
  executeOutput?: Record<string, unknown> | null;
  confirmationState: LeoActionConfirmationState;
  status: LeoActionRunStatus;
  auditEventId?: Types.ObjectId | null;
  errorMessage?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const LeoActionRunSchema = new Schema<ILeoActionRun>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", default: null, index: true },
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "LeoConversation",
      default: null,
      index: true,
    },
    messageId: { type: Schema.Types.ObjectId, ref: "LeoMessage", default: null },
    actorUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    actorRole: { type: String, required: true, trim: true },
    actionKey: { type: String, required: true, trim: true, index: true },
    scopeType: { type: String, default: null, trim: true },
    scopeId: { type: String, default: null, trim: true },
    previewInput: { type: Schema.Types.Mixed, required: true },
    previewOutput: { type: Schema.Types.Mixed, default: null },
    executeInput: { type: Schema.Types.Mixed, default: null },
    executeOutput: { type: Schema.Types.Mixed, default: null },
    confirmationState: {
      type: String,
      enum: ["not_required", "pending", "confirmed", "cancelled"] satisfies LeoActionConfirmationState[],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["previewed", "executed", "failed"] satisfies LeoActionRunStatus[],
      required: true,
      index: true,
    },
    auditEventId: { type: Schema.Types.ObjectId, ref: "AuditEvent", default: null },
    errorMessage: { type: String, default: null },
  },
  { timestamps: true }
);

LeoActionRunSchema.index({ actorUserId: 1, createdAt: -1 });
LeoActionRunSchema.index({ schoolId: 1, actionKey: 1, createdAt: -1 });

export const LeoActionRun: Model<ILeoActionRun> =
  (models.LeoActionRun as Model<ILeoActionRun>) ||
  model<ILeoActionRun>("LeoActionRun", LeoActionRunSchema);
