// src/models/DemoSession.ts
// Demo session model - tracks individual demo sessions with event logging

import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IDemoSessionEvent {
  type:
    | "session_start"
    | "page_view"
    | "feature_explore"
    | "action_attempted"
    | "action_blocked"
    | "cta_click"
    | "session_end";
  timestamp: Date;
  metadata: Record<string, unknown>;
}

export interface IDemoSession extends Document {
  demoTenantId: string;
  leadId: Types.ObjectId;

  // Session state
  status: "active" | "expired" | "ended" | "cleaned_up";
  startedAt: Date;
  lastActivityAt: Date;
  endedAt?: Date;
  endReason?:
    | "user_ended"
    | "inactivity_timeout"
    | "hard_timeout"
    | "browser_closed"
    | "cleanup_job";

  // Session data
  schoolId?: Types.ObjectId; // Reference to seeded demo school
  events: IDemoSessionEvent[];
  pagesVisited: string[];
  actionsAttempted: string[];

  // Computed
  durationSeconds: number;

  // Cleanup tracking
  dataCleanedUp: boolean;
  cleanedUpAt?: Date;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const DemoSessionEventSchema = new Schema<IDemoSessionEvent>(
  {
    type: {
      type: String,
      required: true,
      enum: [
        "session_start",
        "page_view",
        "feature_explore",
        "action_attempted",
        "action_blocked",
        "cta_click",
        "session_end",
      ],
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { _id: false }
);

const DemoSessionSchema = new Schema<IDemoSession>(
  {
    demoTenantId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    leadId: {
      type: Schema.Types.ObjectId,
      ref: "DemoLead",
      required: true,
      index: true,
    },

    // Session state
    status: {
      type: String,
      required: true,
      enum: ["active", "expired", "ended", "cleaned_up"],
      default: "active",
    },
    startedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    lastActivityAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    endedAt: {
      type: Date,
    },
    endReason: {
      type: String,
      enum: [
        "user_ended",
        "inactivity_timeout",
        "hard_timeout",
        "browser_closed",
        "cleanup_job",
      ],
    },

    // Session data
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
    },
    events: {
      type: [DemoSessionEventSchema],
      default: [],
    },
    pagesVisited: {
      type: [String],
      default: [],
    },
    actionsAttempted: {
      type: [String],
      default: [],
    },

    // Computed
    durationSeconds: {
      type: Number,
      default: 0,
    },

    // Cleanup
    dataCleanedUp: {
      type: Boolean,
      default: false,
    },
    cleanedUpAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for session management and cleanup
DemoSessionSchema.index({ status: 1, lastActivityAt: 1 });
DemoSessionSchema.index({ status: 1, startedAt: 1 });
DemoSessionSchema.index({ dataCleanedUp: 1, status: 1 });

// Pre-save hook to calculate duration
DemoSessionSchema.pre("save", function (next) {
  if (this.endedAt && this.startedAt) {
    this.durationSeconds = Math.floor(
      (this.endedAt.getTime() - this.startedAt.getTime()) / 1000
    );
  } else if (this.startedAt) {
    this.durationSeconds = Math.floor(
      (Date.now() - this.startedAt.getTime()) / 1000
    );
  }
  next();
});

export const DemoSession: Model<IDemoSession> =
  mongoose.models.DemoSession ||
  mongoose.model<IDemoSession>("DemoSession", DemoSessionSchema);
