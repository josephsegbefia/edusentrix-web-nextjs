import { Schema, model, models, type Model, type Types } from "mongoose";

export type PlatformAssistedAccessStatus = "active" | "ended" | "expired" | "revoked";
export type PlatformAssistedEffectiveRole = "school_admin";

export interface IPlatformAssistedAccessSession {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  actorUserId: Types.ObjectId;
  actorEmail?: string | null;
  actorName?: string | null;
  effectiveRole: PlatformAssistedEffectiveRole;
  reason: string;
  status: PlatformAssistedAccessStatus;
  startedAt: Date;
  expiresAt: Date;
  endedAt?: Date | null;
  endedByUserId?: Types.ObjectId | null;
  endReason?: string | null;
  delegatedGrantId?: Types.ObjectId | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const PlatformAssistedAccessSessionSchema = new Schema<IPlatformAssistedAccessSession>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    actorUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    actorEmail: { type: String, trim: true, lowercase: true, default: null },
    actorName: { type: String, trim: true, default: null },
    effectiveRole: { type: String, enum: ["school_admin"], required: true, default: "school_admin" },
    reason: { type: String, required: true, trim: true, maxlength: 1000 },
    status: {
      type: String,
      enum: ["active", "ended", "expired", "revoked"],
      default: "active",
      index: true,
    },
    startedAt: { type: Date, required: true, default: () => new Date() },
    expiresAt: { type: Date, required: true, index: true },
    endedAt: { type: Date, default: null },
    endedByUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    endReason: { type: String, trim: true, maxlength: 1000, default: null },
    delegatedGrantId: { type: Schema.Types.ObjectId, default: null, index: true },
    ipAddress: { type: String, trim: true, default: null },
    userAgent: { type: String, trim: true, default: null },
  },
  { timestamps: true },
);

PlatformAssistedAccessSessionSchema.index({ actorUserId: 1, status: 1, expiresAt: 1 });
PlatformAssistedAccessSessionSchema.index({ schoolId: 1, status: 1, expiresAt: 1 });

export const PlatformAssistedAccessSession: Model<IPlatformAssistedAccessSession> =
  (models.PlatformAssistedAccessSession as Model<IPlatformAssistedAccessSession>) ||
  model<IPlatformAssistedAccessSession>(
    "PlatformAssistedAccessSession",
    PlatformAssistedAccessSessionSchema,
  );
