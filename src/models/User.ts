// src/models/User.ts
import { Schema, model, models, Types, type Model } from "mongoose";
import type { AppRole } from "@/lib/roles";

export interface IUser {
  _id: Types.ObjectId;
  // Make optional here
  clerkUserId?: string;
  email: string;
  name?: string; // keep this since you set `name` in routes
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatarUrl?: string;
  avatarPublicId?: string;
  /**
   * @deprecated Use `UserMembership.roles` for school tenant access. Retained for
   * platform operators (`platform_admin`) and migration compatibility only.
   */
  role?: AppRole;
  /**
   * @deprecated Use active school context from `UserMembership`. Retained as a
   * default-school hint during migration only; not a tenant access source of truth.
   */
  schoolId?: Types.ObjectId | null;
  pendingOnboarding?: boolean;
  termsAccepted?: boolean;
  privacyAccepted?: boolean;
  termsVersion?: string;
  privacyVersion?: string;
  policyAcceptedAt?: Date | null;
  policyAcceptedIp?: string | null;
  policyAcceptedUserAgent?: string | null;
  dateOfBirth?: Date;
  address?: string;
  /** Platform-only capability keys for granular operator permissions. When absent/empty, platform admins retain full legacy access. */
  platformPermissionKeys?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    // was: required: true — remove required
    // important: unique + sparse so multiple docs without this field are allowed
    clerkUserId: { type: String, unique: true, sparse: true },

    email: { type: String, required: true, lowercase: true },

    name: String, // add this so your approve route writes don't get dropped
    firstName: String,
    lastName: String,
    phone: String,
    avatarUrl: String,
    avatarPublicId: String,

    role: {
      type: String,
      enum: [
        "platform_admin",
        "school_admin",
        "billing_owner",
        "bursar",
        "staff",
        "teacher",
        "parent",
        "student",
      ],
      default: undefined,
    },

    schoolId: { type: Schema.Types.ObjectId, ref: "School", default: null },
    pendingOnboarding: { type: Boolean, default: false },
    termsAccepted: { type: Boolean, default: false },
    privacyAccepted: { type: Boolean, default: false },
    termsVersion: { type: String, default: null },
    privacyVersion: { type: String, default: null },
    policyAcceptedAt: { type: Date, default: null },
    policyAcceptedIp: { type: String, default: null },
    policyAcceptedUserAgent: { type: String, default: null },
    dateOfBirth: Date,
    address: String,
    platformPermissionKeys: {
      type: [{ type: String, trim: true }],
      default: undefined,
    },
  },
  { timestamps: true }
);

// Non-unique: fast lookup by email alone
userSchema.index({ email: 1 });
userSchema.index({ email: 1, clerkUserId: 1 });

/**
 * One email may exist per school (multi-tenant). Platform users with no schoolId
 * are excluded so they are not covered by this constraint.
 * If Mongo still has a legacy unique index on { email: 1 }, drop it after deploy:
 * db.users.dropIndex("email_1")
 */
userSchema.index(
  { schoolId: 1, email: 1 },
  {
    unique: true,
    partialFilterExpression: { schoolId: { $type: "objectId" } },
  }
);

export const User: Model<IUser> =
  (models.User as Model<IUser>) || model<IUser>("User", userSchema);
