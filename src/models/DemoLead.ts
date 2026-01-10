// src/models/DemoLead.ts
// Demo lead model - tracks prospective customers who sign up for demo

import mongoose, { Schema, Document, Model } from "mongoose";

export interface IDemoLead extends Document {
  email: string;
  fullName: string;
  organization: string;
  role: "admin" | "teacher" | "finance" | "it" | "other";
  schoolSize?: "small" | "medium" | "large" | "xlarge";
  phone?: string;
  country?: string;
  ipAddress?: string;

  // Verification
  magicLinkToken?: string;
  magicLinkExpiresAt?: Date;
  verifiedAt?: Date;

  // Status tracking
  status:
    | "pending_verification"
    | "verified"
    | "session_active"
    | "session_completed"
    | "converted"
    | "expired";

  // Analytics
  sessionsCount: number;
  lastSessionAt?: Date;
  totalTimeSpentSeconds: number;
  featuresExplored: string[];
  highIntentSignals: string[];

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const DemoLeadSchema = new Schema<IDemoLead>(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    organization: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      required: true,
      enum: ["admin", "teacher", "finance", "it", "other"],
    },
    schoolSize: {
      type: String,
      enum: ["small", "medium", "large", "xlarge"],
    },
    phone: {
      type: String,
      trim: true,
    },
    country: {
      type: String,
      trim: true,
    },
    ipAddress: {
      type: String,
    },

    // Verification
    magicLinkToken: {
      type: String,
      index: true,
    },
    magicLinkExpiresAt: {
      type: Date,
    },
    verifiedAt: {
      type: Date,
    },

    // Status
    status: {
      type: String,
      required: true,
      enum: [
        "pending_verification",
        "verified",
        "session_active",
        "session_completed",
        "converted",
        "expired",
      ],
      default: "pending_verification",
    },

    // Analytics
    sessionsCount: {
      type: Number,
      default: 0,
    },
    lastSessionAt: {
      type: Date,
    },
    totalTimeSpentSeconds: {
      type: Number,
      default: 0,
    },
    featuresExplored: {
      type: [String],
      default: [],
    },
    highIntentSignals: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for common queries
DemoLeadSchema.index({ status: 1, createdAt: -1 });
DemoLeadSchema.index({ magicLinkToken: 1, magicLinkExpiresAt: 1 });
DemoLeadSchema.index({ email: 1, createdAt: -1 });

export const DemoLead: Model<IDemoLead> =
  mongoose.models.DemoLead || mongoose.model<IDemoLead>("DemoLead", DemoLeadSchema);
