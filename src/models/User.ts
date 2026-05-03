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
  role?: AppRole; // single role (you decided to move from roles[] to role)
  schoolId?: Types.ObjectId | null;
  pendingOnboarding?: boolean;
  dateOfBirth?: Date;
  address?: string;
  /** Platform-only capability keys, e.g. `platform.internalTest.manage`. When absent/empty, platform admins retain full legacy access. */
  platformPermissionKeys?: string[];
  /** Synthetic users created under an internal test school (QA / seeding). */
  isTestUser?: boolean;
  testUserSource?: "manual_test_school" | "seeded_test_school";
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
    dateOfBirth: Date,
    address: String,
    platformPermissionKeys: {
      type: [{ type: String, trim: true }],
      default: undefined,
    },
    isTestUser: { type: Boolean, default: false },
    testUserSource: {
      type: String,
      enum: ["manual_test_school", "seeded_test_school"],
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
