// src/models/User.ts
import { Schema, model, models, Types } from "mongoose";
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
  /** Demo tenant ID - only set for demo environment data */
  demoTenantId?: string | null;
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
    // Demo tenant ID for demo environment isolation
    demoTenantId: { type: String, default: null, index: true, sparse: true },
  },
  { timestamps: true }
);

// keep simple indexes
userSchema.index({ email: 1 });
// optional compound index if you want faster lookups when both exist:
userSchema.index({ email: 1, clerkUserId: 1 });

export const User = models.User || model<IUser>("User", userSchema);
