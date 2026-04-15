import { Schema, model, models, Types, type Model } from "mongoose";

export type DemoSandboxState =
  | "available"
  | "allocated"
  | "resetting"
  | "tainted"
  | "disabled";

export interface IDemoSandbox {
  _id: Types.ObjectId;
  templateKey: string;
  templateVersion: number;
  schoolId: Types.ObjectId;
  state: DemoSandboxState;
  allocatedSessionId?: Types.ObjectId | null;
  allocatedLeadId?: Types.ObjectId | null;
  allocatedAt?: Date | null;
  expiresAt?: Date | null;
  lastResetAt?: Date | null;
  lastResetDurationMs?: number | null;
  lastResetError?: string | null;
  seedFingerprint?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const demoSandboxSchema = new Schema<IDemoSandbox>(
  {
    templateKey: { type: String, required: true, trim: true },
    templateVersion: { type: Number, required: true },
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    state: {
      type: String,
      enum: ["available", "allocated", "resetting", "tainted", "disabled"],
      default: "available",
    },
    allocatedSessionId: {
      type: Schema.Types.ObjectId,
      ref: "DemoSession",
      default: null,
    },
    allocatedLeadId: {
      type: Schema.Types.ObjectId,
      ref: "DemoLead",
      default: null,
    },
    allocatedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    lastResetAt: { type: Date, default: null },
    lastResetDurationMs: { type: Number, default: null },
    lastResetError: { type: String, default: null },
    seedFingerprint: { type: String, default: null },
  },
  { timestamps: true }
);

demoSandboxSchema.index({ state: 1, lastResetAt: 1 });
demoSandboxSchema.index({ schoolId: 1 }, { unique: true });
demoSandboxSchema.index({ allocatedSessionId: 1 });

export const DemoSandbox: Model<IDemoSandbox> =
  (models.DemoSandbox as Model<IDemoSandbox>) ||
  model<IDemoSandbox>("DemoSandbox", demoSandboxSchema);
