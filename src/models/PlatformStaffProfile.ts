import { Schema, model, models, type Model, type Types } from "mongoose";
import {
  PLATFORM_STAFF_ROLE_PRESETS,
  type PlatformStaffRolePreset,
} from "@/lib/platform/permissions/presets";

export type PlatformStaffStatus = "invited" | "active" | "suspended";
export type PlatformStaffAccessMode = "all_schools" | "delegated_only";

export interface IPlatformStaffProfile {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  clerkUserId?: string | null;
  email: string;
  fullName: string;
  jobTitle: string;
  rolePreset: PlatformStaffRolePreset;
  permissions: string[];
  status: PlatformStaffStatus;
  accessMode: PlatformStaffAccessMode;
  invitedByUserId?: Types.ObjectId | null;
  invitedAt?: Date | null;
  suspendedByUserId?: Types.ObjectId | null;
  suspendedAt?: Date | null;
  suspensionReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const PlatformStaffProfileSchema = new Schema<IPlatformStaffProfile>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    clerkUserId: { type: String, trim: true, default: null, index: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    fullName: { type: String, required: true, trim: true, maxlength: 180 },
    jobTitle: { type: String, required: true, trim: true, maxlength: 120 },
    rolePreset: {
      type: String,
      enum: PLATFORM_STAFF_ROLE_PRESETS,
      required: true,
      default: "custom",
      index: true,
    },
    permissions: { type: [{ type: String, trim: true }], default: [] },
    status: {
      type: String,
      enum: ["invited", "active", "suspended"],
      default: "invited",
      index: true,
    },
    accessMode: {
      type: String,
      enum: ["all_schools", "delegated_only"],
      default: "delegated_only",
      index: true,
    },
    invitedByUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    invitedAt: { type: Date, default: null },
    suspendedByUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    suspendedAt: { type: Date, default: null },
    suspensionReason: { type: String, trim: true, maxlength: 1000, default: null },
  },
  { timestamps: true }
);

PlatformStaffProfileSchema.index({ status: 1, rolePreset: 1 });
PlatformStaffProfileSchema.index({ email: 1, status: 1 });

export const PlatformStaffProfile: Model<IPlatformStaffProfile> =
  (models.PlatformStaffProfile as Model<IPlatformStaffProfile>) ||
  model<IPlatformStaffProfile>("PlatformStaffProfile", PlatformStaffProfileSchema);
