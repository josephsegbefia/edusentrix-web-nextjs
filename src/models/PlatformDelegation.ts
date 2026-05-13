import { Schema, model, models, type Model, type Types } from "mongoose";
import {
  PLATFORM_DELEGATION_SCOPES,
  type PlatformDelegationScope,
  type PlatformDelegationStatus,
} from "@/lib/platform/delegations/scopes";

export { PLATFORM_DELEGATION_SCOPES };
export type { PlatformDelegationScope, PlatformDelegationStatus };

export interface IPlatformDelegation {
  _id: Types.ObjectId;
  schoolId?: Types.ObjectId | null;
  taskId?: Types.ObjectId | null;
  staffUserId: Types.ObjectId;
  staffProfileId?: Types.ObjectId | null;
  assignedByUserId: Types.ObjectId;
  scope: PlatformDelegationScope;
  permissions: string[];
  startsAt: Date;
  expiresAt?: Date | null;
  status: PlatformDelegationStatus;
  reason?: string | null;
  revokedAt?: Date | null;
  revokedByUserId?: Types.ObjectId | null;
  revokeReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const PlatformDelegationSchema = new Schema<IPlatformDelegation>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", default: null, index: true },
    taskId: { type: Schema.Types.ObjectId, default: null, index: true },
    staffUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    staffProfileId: { type: Schema.Types.ObjectId, ref: "PlatformStaffProfile", default: null, index: true },
    assignedByUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    scope: { type: String, enum: PLATFORM_DELEGATION_SCOPES, required: true, index: true },
    permissions: { type: [{ type: String, trim: true }], default: [] },
    startsAt: { type: Date, required: true, default: () => new Date(), index: true },
    expiresAt: { type: Date, default: null, index: true },
    status: {
      type: String,
      enum: ["active", "expired", "revoked"],
      default: "active",
      index: true,
    },
    reason: { type: String, trim: true, maxlength: 1000, default: null },
    revokedAt: { type: Date, default: null },
    revokedByUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    revokeReason: { type: String, trim: true, maxlength: 1000, default: null },
  },
  { timestamps: true }
);

PlatformDelegationSchema.index({ staffUserId: 1, schoolId: 1, scope: 1, status: 1 });
PlatformDelegationSchema.index({ schoolId: 1, status: 1, expiresAt: 1 });
PlatformDelegationSchema.index({ staffProfileId: 1, status: 1, expiresAt: 1 });

export const PlatformDelegation: Model<IPlatformDelegation> =
  (models.PlatformDelegation as Model<IPlatformDelegation>) ||
  model<IPlatformDelegation>("PlatformDelegation", PlatformDelegationSchema);
