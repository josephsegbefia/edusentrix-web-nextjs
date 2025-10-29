import { Schema, model, models, Types } from "mongoose";

export interface IInvite {
  _id: Types.ObjectId;
  type: "school_admin";
  email: string;
  schoolId: Types.ObjectId;
  status: "pending" | "accepted" | "expired" | "revoked";
  expiresAt: Date;
  prefill?: { firstName?: string; lastName?: string };
  createdBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const inviteSchema = new Schema<IInvite>(
  {
    type: { type: String, enum: ["school_admin"], required: true },
    email: { type: String, required: true, lowercase: true, index: true },
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "expired", "revoked"],
      default: "pending",
    },
    expiresAt: { type: Date, required: true },
    prefill: {
      firstName: String,
      lastName: String,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

inviteSchema.index({ email: 1, schoolId: 1, status: 1 });

export const Invite = models.Invite || model<IInvite>("Invite", inviteSchema);
