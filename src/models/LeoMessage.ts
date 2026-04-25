import { Schema, model, models, type Model, type Types } from "mongoose";

export type LeoMessageAuthor = "user" | "assistant" | "system" | "tool";
export type LeoMessageStatus = "complete" | "error" | "cancelled";

export interface ILeoCitation {
  type: "route" | "entity" | "report" | "record";
  label: string;
  ref: string;
}

export interface ILeoMessage {
  _id: Types.ObjectId;
  conversationId: Types.ObjectId;
  schoolId?: Types.ObjectId | null;
  userId: Types.ObjectId;
  role: string;
  author: LeoMessageAuthor;
  contentText: string;
  blocks?: Array<Record<string, unknown>>;
  citations?: ILeoCitation[];
  pageContextSnapshot?: Record<string, unknown> | null;
  toolCalls?: Array<Record<string, unknown>>;
  modelUsed?: string | null;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } | null;
  status: LeoMessageStatus;
  errorMessage?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const LeoCitationSchema = new Schema<ILeoCitation>(
  {
    type: {
      type: String,
      enum: ["route", "entity", "report", "record"],
      required: true,
    },
    label: { type: String, required: true, trim: true },
    ref: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const TokenUsageSchema = new Schema(
  {
    promptTokens: { type: Number, required: true, min: 0 },
    completionTokens: { type: Number, required: true, min: 0 },
    totalTokens: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const LeoMessageSchema = new Schema<ILeoMessage>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "LeoConversation",
      required: true,
      index: true,
    },
    schoolId: { type: Schema.Types.ObjectId, ref: "School", default: null, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    role: { type: String, required: true, trim: true },
    author: {
      type: String,
      enum: ["user", "assistant", "system", "tool"] satisfies LeoMessageAuthor[],
      required: true,
    },
    contentText: { type: String, required: true },
    blocks: { type: [Schema.Types.Mixed], default: undefined },
    citations: { type: [LeoCitationSchema], default: undefined },
    pageContextSnapshot: { type: Schema.Types.Mixed, default: null },
    toolCalls: { type: [Schema.Types.Mixed], default: undefined },
    modelUsed: { type: String, default: null },
    tokenUsage: { type: TokenUsageSchema, default: null },
    status: {
      type: String,
      enum: ["complete", "error", "cancelled"] satisfies LeoMessageStatus[],
      default: "complete",
      required: true,
    },
    errorMessage: { type: String, default: null },
  },
  { timestamps: true }
);

LeoMessageSchema.index({ conversationId: 1, createdAt: 1 });

export const LeoMessage: Model<ILeoMessage> =
  (models.LeoMessage as Model<ILeoMessage>) ||
  model<ILeoMessage>("LeoMessage", LeoMessageSchema);
