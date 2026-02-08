import { Schema, model, models, Types } from "mongoose";
import type { InvitationRole } from "@/lib/roles";

export interface IInvitation {
  _id: Types.ObjectId;
  email: string;
  role: InvitationRole;
  schoolId: Types.ObjectId;
  status: "pending" | "accepted" | "expired" | "revoked" | "failed";
  clerkInvitationId?: string;
  sentAt: Date;
  expiresAt: Date;
  acceptedAt?: Date;
  revokedAt?: Date;
  resendCount: number;
  lastResentAt?: Date;
  invitedBy: Types.ObjectId;
  metadata?: {
    firstName?: string;
    lastName?: string;
    subjectIds?: string[];
    homeroomClassGroupId?: string;
    [key: string]: unknown;
  };
  createdAt: Date;
  updatedAt: Date;
}

const invitationSchema = new Schema<IInvitation>(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["teacher", "staff", "school_admin", "parent", "bursar"],
      required: true,
      index: true,
    },
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "expired", "revoked", "failed"],
      default: "pending",
      index: true,
    },
    clerkInvitationId: {
      type: String,
      index: true,
    },
    sentAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    acceptedAt: Date,
    revokedAt: Date,
    resendCount: {
      type: Number,
      default: 0,
    },
    lastResentAt: Date,
    invitedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

// Compound indexes for efficient queries
invitationSchema.index({ schoolId: 1, status: 1 });
invitationSchema.index({ schoolId: 1, role: 1, status: 1 });
invitationSchema.index({ email: 1, schoolId: 1 });
invitationSchema.index({ expiresAt: 1, status: 1 }); // For expiry job

export const Invitation =
  models.Invitation || model<IInvitation>("Invitation", invitationSchema);
