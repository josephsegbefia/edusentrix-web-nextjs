import { Schema, model, models, Types } from "mongoose";
import type { MembershipRole } from "@/lib/roles";

export interface IUserMembership {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  schoolId: Types.ObjectId;
  roles: MembershipRole[];
  status: "active" | "invited" | "suspended";
  createdAt: Date;
  updatedAt: Date;
}

const membershipSchema = new Schema<IUserMembership>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true },
    roles: {
      type: [String],
      enum: ["school_admin", "bursar", "teacher", "parent", "student"],
      default: [],
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "invited", "suspended"],
      default: "active",
    },
  },
  { timestamps: true }
);

membershipSchema.index({ userId: 1, schoolId: 1 }, { unique: true });

export const UserMembership =
  models.UserMembership ||
  model<IUserMembership>("UserMembership", membershipSchema);
