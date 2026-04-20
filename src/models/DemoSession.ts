import { Schema, model, models, Types, type Model } from "mongoose";

export type DemoSessionStatus =
  | "active"
  | "expired"
  | "ended"
  | "capacity_blocked"
  | "abandoned";

export interface IDemoSession {
  _id: Types.ObjectId;
  leadId: Types.ObjectId;
  sandboxId: Types.ObjectId | null;
  sandboxSchoolId: Types.ObjectId | null;
  sessionTokenHash: string;
  status: DemoSessionStatus;
  activePersonaRole: string;
  activePersonaUserId: Types.ObjectId | null;
  startedAt: Date;
  expiresAt: Date;
  lastActiveAt: Date;
  lastInteractionAt: Date;
  endedAt?: Date | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  resumeNonceHash?: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const demoSessionSchema = new Schema<IDemoSession>(
  {
    leadId: {
      type: Schema.Types.ObjectId,
      ref: "DemoLead",
      required: true,
    },
    sandboxId: {
      type: Schema.Types.ObjectId,
      ref: "DemoSandbox",
      default: null,
    },
    sandboxSchoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      default: null,
    },
    sessionTokenHash: { type: String, required: true },
    status: {
      type: String,
      enum: ["active", "expired", "ended", "capacity_blocked", "abandoned"],
      default: "active",
    },
    activePersonaRole: { type: String, default: "school_admin" },
    activePersonaUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    startedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    lastActiveAt: { type: Date, default: Date.now },
    lastInteractionAt: { type: Date, default: Date.now },
    endedAt: { type: Date, default: null },
    ipAddress: { type: String, default: null },
    userAgent: { type: String, default: null },
    resumeNonceHash: { type: String, default: null },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

demoSessionSchema.index({ sessionTokenHash: 1 }, { unique: true });
demoSessionSchema.index({ leadId: 1, status: 1 });
demoSessionSchema.index({ status: 1, expiresAt: 1 });
demoSessionSchema.index({ status: 1, lastInteractionAt: 1 });
demoSessionSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 86400 }
);

export const DemoSession: Model<IDemoSession> =
  (models.DemoSession as Model<IDemoSession>) ||
  model<IDemoSession>("DemoSession", demoSessionSchema);
