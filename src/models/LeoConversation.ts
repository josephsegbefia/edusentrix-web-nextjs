import { Schema, model, models, type Model, type Types } from "mongoose";

export type LeoRole =
  | "platform_admin"
  | "school_admin"
  | "bursar"
  | "billing_owner"
  | "teacher"
  | "parent"
  | "student"
  | "staff";

export type LeoSourceApp =
  | "platform"
  | "admin"
  | "teacher"
  | "parent"
  | "student";

export interface ILeoConversation {
  _id: Types.ObjectId;
  schoolId?: Types.ObjectId | null;
  userId: Types.ObjectId;
  role: LeoRole;
  title: string;
  sourceApp: LeoSourceApp;
  sourceRoute?: string | null;
  sourceTab?: string | null;
  pinned: boolean;
  archivedAt?: Date | null;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const LeoConversationSchema = new Schema<ILeoConversation>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", default: null, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    role: {
      type: String,
      enum: [
        "platform_admin",
        "school_admin",
        "bursar",
        "billing_owner",
        "teacher",
        "parent",
        "student",
        "staff",
      ] satisfies LeoRole[],
      required: true,
    },
    title: { type: String, required: true, trim: true, default: "New Leo chat" },
    sourceApp: {
      type: String,
      enum: ["platform", "admin", "teacher", "parent", "student"] satisfies LeoSourceApp[],
      required: true,
    },
    sourceRoute: { type: String, default: null },
    sourceTab: { type: String, default: null },
    pinned: { type: Boolean, default: false },
    archivedAt: { type: Date, default: null, index: true },
    lastMessageAt: { type: Date, required: true, default: Date.now, index: true },
  },
  { timestamps: true }
);

LeoConversationSchema.index({ userId: 1, archivedAt: 1, lastMessageAt: -1 });
LeoConversationSchema.index({ schoolId: 1, role: 1, lastMessageAt: -1 });

export const LeoConversation: Model<ILeoConversation> =
  (models.LeoConversation as Model<ILeoConversation>) ||
  model<ILeoConversation>("LeoConversation", LeoConversationSchema);
