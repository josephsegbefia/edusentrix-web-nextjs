import { Schema, model, models, type Types } from "mongoose";
import type { DelegationModule, DelegationStatus } from "@/lib/delegations/types";

export interface IDelegation {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  staffUserId: Types.ObjectId;
  staffTeacherId?: Types.ObjectId | null;
  module: DelegationModule;
  preset: string;
  permissions: string[];
  status: DelegationStatus;
  startsAt: Date;
  expiresAt?: Date | null;
  revokedAt?: Date | null;
  revokedByUserId?: Types.ObjectId | null;
  revokeReason?: string | null;
  grantedByUserId: Types.ObjectId;
  grantNote?: string | null;
  lastActivityAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const delegationSchema = new Schema<IDelegation>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true },
    staffUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    staffTeacherId: { type: Schema.Types.ObjectId, ref: "Teacher", default: null },
    module: { type: String, required: true, index: true },
    preset: { type: String, required: true },
    permissions: { type: [String], default: [] },
    status: {
      type: String,
      enum: ["active", "expired", "revoked"],
      default: "active",
      index: true,
    },
    startsAt: { type: Date, default: () => new Date() },
    expiresAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
    revokedByUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    revokeReason: { type: String, default: null },
    grantedByUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    grantNote: { type: String, default: null },
    lastActivityAt: { type: Date, default: null },
  },
  { timestamps: true }
);

delegationSchema.index({ schoolId: 1, staffUserId: 1, module: 1, status: 1 });
delegationSchema.index({ schoolId: 1, module: 1, status: 1 });
delegationSchema.index({ schoolId: 1, status: 1, expiresAt: 1 });

export const Delegation =
  models.Delegation || model<IDelegation>("Delegation", delegationSchema);
