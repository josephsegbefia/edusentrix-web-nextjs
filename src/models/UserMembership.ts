import { Schema, model, models, Types } from "mongoose";
export interface IUserMembership {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  schoolId: Types.ObjectId;
  roles: Array<"school_admin" | "teacher" | "student" | "parent" | "bursar">;
  status: "active" | "invited" | "suspended";
  createdAt: Date;
  updatedAt: Date;
}

const membershipSchema = new Schema<IUserMembership>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true },
    roles: { type: [String], default: [], index: true },
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
